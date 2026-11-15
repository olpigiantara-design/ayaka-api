import { getDb } from '../../src/utils/db.js';
import { hashToken } from '../../src/utils/crypto.js';
import { ok, fail } from '../../src/utils/response.js';
import { parseCookies, clearSessionCookie } from '../../src/utils/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'POST only');
  const cookies = parseCookies(req.headers.cookie || '');
  if (cookies.session) {
    try {
      const sql = getDb();
      await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(cookies.session)}`;
    } catch (e) { /* noop */ }
  }
  clearSessionCookie(res);
  return ok(res, {}, { message: 'Logged out' });
}
