import { getDb } from '../../src/utils/db.js';
import { verifyPassword, generateSessionToken, hashToken } from '../../src/utils/crypto.js';
import { ok, fail, readBody } from '../../src/utils/response.js';
import { setSessionCookie } from '../../src/utils/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'POST only');

  const { identifier, password } = await readBody(req);
  if (!identifier || !password) {
    return fail(res, 422, 'MISSING_FIELDS', 'identifier and password required');
  }

  const sql = getDb();
  try {
    const rows = await sql`
      SELECT id, username, email, password_hash FROM users
      WHERE username = ${identifier} OR email = ${identifier} LIMIT 1
    `;
    const user = rows[0];
    if (!user) return fail(res, 401, 'INVALID_CREDENTIALS', 'Wrong username or password');

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return fail(res, 401, 'INVALID_CREDENTIALS', 'Wrong username or password');

    const token = generateSessionToken();
    const tokenHash = hashToken(token);
    await sql`
      INSERT INTO sessions (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${tokenHash}, NOW() + INTERVAL '7 days')
    `;
    setSessionCookie(res, token);
    return ok(res, {
      user: { id: user.id, username: user.username, email: user.email }
    }, { message: 'Login successful' });
  } catch (e) {
    console.error('Login error:', e.message);
    return fail(res, 500, 'INTERNAL_ERROR', 'Login failed');
  }
}
