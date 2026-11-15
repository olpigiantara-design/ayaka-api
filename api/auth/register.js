import { getDb } from '../../src/utils/db.js';
import { hashPassword } from '../../src/utils/crypto.js';
import { ok, fail, readBody } from '../../src/utils/response.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'POST only');

  const body = await readBody(req);
  const { username, email, password } = body;

  if (!username || typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return fail(res, 422, 'INVALID_USERNAME', 'Username 3-30 chars, alphanumeric + underscore');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail(res, 422, 'INVALID_EMAIL', 'Invalid email');
  }
  if (!password || password.length < 8) {
    return fail(res, 422, 'WEAK_PASSWORD', 'Password must be at least 8 characters');
  }

  const sql = getDb();
  try {
    const existing = await sql`
      SELECT 1 FROM users WHERE username = ${username} OR email = ${email} LIMIT 1
    `;
    if (existing.length) return fail(res, 409, 'USER_EXISTS', 'Username or email already in use');

    const hash = await hashPassword(password);
    const rows = await sql`
      INSERT INTO users (username, email, password_hash)
      VALUES (${username}, ${email}, ${hash})
      RETURNING id, username, email, created_at
    `;
    return ok(res, { user: rows[0] }, { status: 201, message: 'Account created' });
  } catch (e) {
    console.error('Register error:', e.message);
    return fail(res, 500, 'INTERNAL_ERROR', 'Registration failed');
  }
}
