from fastapi import FastAPI, Request, Response, HTTPException, Header, Depends
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
import os, hashlib, secrets, hmac, time, uuid
from datetime import datetime, timedelta
import json

app = FastAPI()

# ==== DATABASE UTILS ====
def get_db():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    return conn

# ==== CRYPTO UTILS ====
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

# ==== MODELS ====
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

# ==== MIDDLEWARES ====
def get_session_user(request: Request):
    token = request.cookies.get("session")
    if not token: return None
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
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
    
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM api_keys WHERE key_hash = %s", (hash_api_key(x_api_key),))
    key = cur.fetchone()
    
    if not key:
        cur.close(); conn.close()
        raise HTTPException(status_code=401, detail="API key not found")
    if key["status"] != "active":
        cur.close(); conn.close()
        raise HTTPException(status_code=403, detail="API key has been revoked")
    if key["expires_at"] and key["expires_at"] < datetime.now():
        cur.close(); conn.close()
        raise HTTPException(status_code=403, detail="API key expired")
    if key["requests_used"] >= key["quota_limit"]:
        cur.close(); conn.close()
        raise HTTPException(status_code=429, detail="API key quota exceeded")
        
    cur.execute("UPDATE api_keys SET requests_used = requests_used + 1 WHERE id = %s", (key["id"],))
    cur.close(); conn.close()
    return dict(key)

# ==== STANDARD RESPONSE ====
def api_success(data, message="Request successful", status_code=200):
    return {
        "success": True, "message": message, "data": data,
        "meta": {"timestamp": datetime.utcnow().isoformat() + "Z", "requestId": "req_" + secrets.token_hex(4)}
    }

def api_error(status_code, code, message):
    return HTTPException(status_code=status_code, detail={
        "success": False, "message": message, "error": {"code": code},
        "meta": {"timestamp": datetime.utcnow().isoformat() + "Z", "requestId": "req_" + secrets.token_hex(4)}
    })

# ==== ROUTES: HEALTH & PUBLIC ====
@app.get("/health")
@app.get("/v1/health")
def health():
    start = time.time()
    try:
        conn = get_db(); conn.close()
        return api_success({"status": "operational", "services": {"api": "operational", "database": "operational", "auth": "operational"}, "response_time": int((time.time() - start) * 1000)})
    except:
        return api_error(500, "DB_ERROR", "Database unavailable")

@app.get("/public-stats")
def public_stats():
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT COUNT(*) as c FROM api_usage"); req = cur.fetchone()["c"]
    cur.execute("SELECT COALESCE(AVG(response_time),0) as ms FROM api_usage"); avg = cur.fetchone()["ms"]
    cur.execute("SELECT COUNT(*) as c FROM users"); users = cur.fetchone()["c"]
    cur.close(); conn.close()
    return api_success({"total_requests": req, "avg_response_time": int(avg), "total_users": users, "total_endpoints": 7})

# ==== ROUTES: AUTH ====
@app.post("/auth/register")
def register(body: AuthRegister):
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT 1 FROM users WHERE username = %s OR email = %s", (body.username, body.email))
    if cur.fetchone(): cur.close(); conn.close(); return api_error(409, "USER_EXISTS", "Username or email already used")
    
    try:
        cur.execute("INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s) RETURNING id, username, email", 
                    (body.username, body.email, hash_password(body.password)))
        user = cur.fetchone()
        return api_success({"user": {"id": user[0], "username": user[1], "email": user[2]}}, "Account created", 201)
    except Exception as e:
        return api_error(500, "INTERNAL_ERROR", "Registration failed")
    finally:
        cur.close(); conn.close()

@app.post("/auth/login")
def login(body: AuthLogin, response: Response):
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM users WHERE username = %s OR email = %s", (body.identifier, body.identifier))
    user = cur.fetchone()
    
    if not user or not verify_password(body.password, user["password_hash"]):
        cur.close(); conn.close(); return api_error(401, "INVALID_CREDENTIALS", "Wrong username or password")
    
    token = generate_session_token()
    cur.execute("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (%s, %s, NOW() + INTERVAL '7 days')", 
                (user["id"], hash_token(token)))
    cur.close(); conn.close()
    
    response.set_cookie(key="session", value=token, httponly=True, samesite="lax", max_age=7*24*3600, secure=os.environ.get("NODE_ENV")=="production")
    return api_success({"user": {"id": user["id"], "username": user["username"], "email": user["email"]}}, "Login successful")

@app.post("/auth/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get("session")
    if token:
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM sessions WHERE token_hash = %s", (hash_token(token),))
        cur.close(); conn.close()
    response.delete_cookie("session")
    return api_success({}, "Logged out")

@app.get("/auth/me")
def me(user: dict = Depends(get_session_user)):
    if not user: return api_error(401, "UNAUTHORIZED", "Not logged in")
    return api_success({"user": user})

# ==== ROUTES: DASHBOARD STATS ====
@app.get("/stats")
def stats(user: dict = Depends(get_session_user)):
    if not user: return api_error(401, "UNAUTHORIZED", "Not logged in")
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("SELECT COUNT(*) as c FROM api_usage WHERE user_id = %s", (user["id"],)); total = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) as c FROM api_usage WHERE user_id = %s AND status_code < 400", (user["id"],)); succ = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) as c FROM api_usage WHERE user_id = %s AND status_code >= 400", (user["id"],)); fail = cur.fetchone()["c"]
    cur.execute("SELECT COALESCE(AVG(response_time),0) as ms FROM api_usage WHERE user_id = %s", (user["id"],)); avg = cur.fetchone()["ms"]
    cur.execute("SELECT COUNT(*) as total, COALESCE(SUM(quota_limit - requests_used), 0) as rem, COUNT(*) FILTER (WHERE status = 'active') as act FROM api_keys WHERE user_id = %s", (user["id"],)); keys = cur.fetchone()
    
    cur.close(); conn.close()
    return api_success({
        "total_requests": total, "successful_requests": succ, "failed_requests": fail,
        "avg_response_time": int(avg), "keys_total": keys["total"], "keys_active": keys["act"],
        "remaining_quota": keys["rem"], "chart": []
    })

# ==== ROUTES: API KEYS ====
@app.get("/keys")
def get_keys(user: dict = Depends(get_session_user)):
    if not user: return api_error(401, "UNAUTHORIZED", "Not logged in")
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, key_prefix, status, quota_limit, requests_used, expires_at, created_at FROM api_keys WHERE user_id = %s ORDER BY created_at DESC", (user["id"],))
    keys = cur.fetchall()
    cur.close(); conn.close()
    return api_success({"keys": keys})

@app.post("/keys")
def create_key(user: dict = Depends(get_session_user)):
    if not user: return api_error(401, "UNAUTHORIZED", "Not logged in")
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT COUNT(*) as c FROM api_keys WHERE user_id = %s", (user["id"],))
    if cur.fetchone()["c"] >= 5:
        cur.close(); conn.close(); return api_error(409, "LIMIT_REACHED", "Max 5 keys")
    
    raw_key = generate_api_key()
    cur.execute("INSERT INTO api_keys (user_id, key_prefix, key_hash) VALUES (%s, %s, %s) RETURNING id, key_prefix", (user["id"], raw_key[:12], hash_api_key(raw_key)))
    new_key = cur.fetchone()
    cur.close(); conn.close()
    return api_success({"key": new_key, "api_key": raw_key}, "API key created", 201)

# ==== ROUTES: V1 USERS (PROTECTED) ====
@app.get("/v1/users")
def v1_get_users(api_key: dict = Depends(require_api_key)):
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, name, email, created_at FROM demo_users WHERE owner_user_id = %s", (api_key["user_id"],))
    users = cur.fetchall()
    cur.close(); conn.close()
    return api_success({"users": users, "count": len(users)})

@app.post("/v1/users")
def v1_create_user(body: UserCreate, api_key: dict = Depends(require_api_key)):
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("INSERT INTO demo_users (owner_user_id, name, email) VALUES (%s, %s, %s) RETURNING id, name, email, created_at", 
                (api_key["user_id"], body.name, body.email))
    new_user = cur.fetchone()
    cur.close(); conn.close()
    return api_success({"user": new_user}, "User created", 201)
