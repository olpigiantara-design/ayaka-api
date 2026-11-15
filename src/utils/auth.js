import { getDb } from './db.js';
import { hashToken } from './crypto.js';

export function parseCookies(header = '') {
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > -1) {
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  });
  return out;
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    'session=' + token + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + (7 * 24 * 3600) + secure
  );
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0' + secure);
}

export async function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.session;
  if (!token) return null;
  const sql = getDb();
  const hash = hashToken(token);
  const rows = await sql`
    SELECT u.id, u.username, u.email, u.created_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hash} AND s.expires_at > NOW()
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function requireUser(req, res) {
  const user = await getSessionUser(req);
  if (!user) {
    const { fail } = await import('./response.js');
    fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    return null;
  }
  return user;
}
