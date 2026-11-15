import { getDb } from '../../src/utils/db.js';
import { requireUser } from '../../src/utils/auth.js';
import { generateApiKey, hashApiKey } from '../../src/utils/crypto.js';
import { ok, fail } from '../../src/utils/response.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const sql = getDb();

  if (req.method === 'GET') {
    const keys = await sql`
      SELECT id, key_prefix, status, quota_limit, requests_used, expires_at, created_at
      FROM api_keys WHERE user_id = ${user.id} ORDER BY created_at DESC
    `;
    return ok(res, { keys });
  }

  if (req.method === 'POST') {
    const existing = await sql`SELECT COUNT(*)::int AS c FROM api_keys WHERE user_id = ${user.id}`;
    if (existing[0].c >= 5) return fail(res, 409, 'LIMIT_REACHED', 'Maximum 5 API keys per account');

    const rawKey = generateApiKey();
    const hash = hashApiKey(rawKey);
    const prefix = rawKey.slice(0, 12);
    const rows = await sql`
      INSERT INTO api_keys (user_id, key_prefix, key_hash, quota_limit)
      VALUES (${user.id}, ${prefix}, ${hash}, 1000)
      RETURNING id, key_prefix, status, quota_limit, requests_used, created_at
    `;
    return ok(res, {
      key: rows[0],
      api_key: rawKey,
      warning: 'Save this key now. It will NEVER be shown again.'
    }, { status: 201, message: 'API key created' });
  }

  return fail(res, 405, 'METHOD_NOT_ALLOWED', 'GET or POST only');
}
