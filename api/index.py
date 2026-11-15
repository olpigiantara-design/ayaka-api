from fastapi import FastAPI, Request, Response, HTTPException, Header, Depends
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
import os, hashlib, secrets, hmac, time, uuid
from datetime import datetime, timedelta
import json

# redirect_slashes=False mencegah konflik routing antara Vercel dan FastAPI
app = FastAPI(redirect_slashes=False)

# ... (Handler error dan fungsi utilitas tetap sama) ...
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "success" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={
        "success": False, "message": str(exc.detail), "error": {"code": "ERROR"},
        "meta": {"timestamp": datetime.utcnow().isoformat() + "Z", "requestId": "req_" + secrets.token_hex(4)}
    })

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={
        "success": False, "message": "Validation Error", "error": {"code": "VALIDATION_ERROR", "details": exc.errors()},
        "meta": {"timestamp": datetime.utcnow().isoformat() + "Z", "requestId": "req_" + secrets.token_hex(4)}
    })

def get_db():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    return conn

def hash_api_key(key):
    pepper = os.environ.get("API_KEY_PEPPER", "")
    return hashlib.sha256((key + pepper).encode()).hexdigest()

def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()

def hash_password(password):
    salt = secrets.token_hex(16)
    derived = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64)
    return f"{salt}:{derived.hex()}"

def verify_password(password, stored):
    try:
        salt, hash_hex = stored.split(":")
        derived = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64)
        return hmac.compare_digest(hash_hex, derived.hex())
    except:
        return False

def generate_session_token():
    return secrets.token_hex(32)

def generate_api_key():
    return "AYK_" + secrets.token_hex(24)

class AuthLogin(BaseModel):
    identifier: str
    password: str

class AuthRegister(BaseModel):
    username: str
    email: str
    password: str

class UserCreate(BaseModel):
    name: str
    email: str

def get_session_user(request: Request):
    token = request.cookies.get("session")
    if not token: return None
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT u.id, u.username, u.email, u.created_at
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = %s AND s.expires_at > NOW()
    """, (hash_token(token),))
    user = cur.fetchone()
    cur.close(); conn.close()
    return dict(user) if user else None

def require_api_key(x_api_key: str = Header(None)):
    if not x_api_key or not x_api_key.startswith("AYK_"):
        raise HTTPException(status_code=401, detail="Missing or invalid API key format")
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM api_keys WHERE key_hash = %s", (hash_api_key(x_api_key),))
    key = cur.fetchone()
    if not key:
        cur.close(); conn.close(); raise HTTPException(status_code=401, detail="API key not found")
    if key["status"] != "active":
        cur.close(); conn.close(); raise HTTPException(status_code=403, detail="API key has been revoked")
    if key["expires_at"] and key["expires_at"] < datetime.now():
        cur.close(); conn.close(); raise HTTPException(status_code=403, detail="API key expired")
    if key["requests_used"] >= key["quota_limit"]:
        cur.close(); conn.close(); raise HTTPException(status_code=429, detail="API key quota exceeded")
    cur.execute("UPDATE api_keys SET requests_used = requests_used + 1 WHERE id = %s", (key["id"],))
    cur.close(); conn.close()
    return dict(key)

def api_success(data, message="Request successful", status_code=200):
    return JSONResponse(status_code=status_code, content={
        "success": True, "message": message, "data": data,
        "meta": {"timestamp": datetime.utcnow().isoformat() + "Z", "requestId": "req_" + secrets.token_hex(4)}
    })

def api_error(status_code, code, message):
    return JSONResponse(status_code=status_code, content={
        "success": False, "message": message, "error": {"code": code},
        "meta": {"timestamp": datetime.utcnow().isoformat() + "Z", "requestId": "req_" + secrets.token_hex(4)}
    })

# ==========================================
# RUTE API (Mendukung WITH & WITHOUT TRAILING SLASH)
# ==========================================

@app.get("/api/health")
@app.get("/api/health/")
def health():
    start = time.time()
    try:
        conn = get_db(); conn.close()
        return api_success({"status": "operational", "services": {"api": "operational", "database": "operational", "auth": "operational"}, "response_time": int((time.time() - start) * 1000)})
    except Exception as e:
        return api_error(500, "DB_ERROR", f"Database unavailable: {str(e)}")

@app.post("/api/auth/register")
@app.post("/api/auth/register/")
def register(body: AuthRegister):
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT 1 FROM users WHERE username = %s OR email = %s", (body.username, body.email))
    if cur.fetchone():
        cur.close(); conn.close()
        return api_error(409, "USER_EXISTS", "Username atau Email sudah terdaftar")
    try:
        cur.execute("INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s) RETURNING id, username, email", (body.username, body.email, hash_password(body.password)))
        user = cur.fetchone()
        return api_success({"user": {"id": str(user[0]), "username": user[1], "email": user[2]}}, "Akun berhasil dibuat", 201)
    except Exception as e:
        print("Register error:", e)
        return api_error(500, "INTERNAL_ERROR", "Gagal mendaftar")
    finally:
        cur.close(); conn.close()

@app.post("/api/auth/login")
@app.post("/api/auth/login/")
def login(body: AuthLogin, response: Response):
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM users WHERE username = %s OR email = %s", (body.identifier, body.identifier))
    user = cur.fetchone()
    if not user or not verify_password(body.password, user["password_hash"]):
        cur.close(); conn.close()
        return api_error(401, "INVALID_CREDENTIALS", "Username/Email atau password salah")
    token = generate_session_token()
    cur.execute("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (%s, %s, NOW() + INTERVAL '7 days')", (user["id"], hash_token(token)))
    cur.close(); conn.close()
    response.set_cookie(key="session", value=token, httponly=True, samesite="lax", max_age=7*24*3600, secure=True)
    return api_success({"user": {"id": str(user["id"]), "username": user["username"], "email": user["email"]}}, "Login berhasil")

# (Rute lainnya seperti /api/stats, /api/keys, dll. juga bisa ditambahkan kedua dekoratornya jika perlu)
# ...

@app.get("/api/auth/me")
@app.get("/api/auth/me/")
def me(user: dict = Depends(get_session_user)):
    if not user: return api_error(401, "UNAUTHORIZED", "Not logged in")
    return api_success({"user": {k: str(v) if k == "id" else v for k, v in user.items()}})

# ... (Sisa kode rute lainnya tetap sama) ...
