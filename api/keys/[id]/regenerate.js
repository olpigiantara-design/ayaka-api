import { getDb } from '../../../src/utils/db.js';
import { requireUser } from '../../../src/utils/auth.js';
import { generateApiKey, hashApiKey } from '../../../src/utils/crypto.js';
import { ok, fail } from '../../../src/utils/response.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'POST only');
  const user = await requireUser(req, res);
  if (!user) return;

  const { id } = req.query;
  const sql = getDb();

  const rawKey = generateApiKey();
  const hash = hashApiKey(rawKey);
  const prefix = rawKey.slice(0, 12);

  const rows = await sql`
    UPDATE api_keys SET key_hash = ${hash}, key_prefix = ${prefix},
      status = 'active', requests_used = 0
    WHERE id = ${id} AND user_id = ${user.id}
    RETURNING id, key_prefix, status, quota_limit, requests_used
  `;
  if (!rows.length) return fail(res, 404, 'NOT_FOUND', 'API key not found');
  return ok(res, {
    key: rows[0],
    api_key: rawKey,
    warning: 'Save this new key. It will NEVER be shown again.'
  }, { message: 'API key regenerated' });
}
