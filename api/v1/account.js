import { getDb } from '../../src/utils/db.js';
import { apiKeyAuth, recordUsage } from '../../src/middleware/apiKeyAuth.js';
import { ok, fail } from '../../src/utils/response.js';

export default async function handler(req, res) {
  const start = Date.now();
  const { apiKey, error } = await apiKeyAuth(req);
  if (error) return fail(res, error.status, error.code, error.message);

  const sql = getDb();
  const userRows = await sql`SELECT id, username, email, created_at FROM users WHERE id = ${apiKey.user_id}`;
  const keyRows = await sql`
    SELECT id, key_prefix, status, quota_limit, requests_used, expires_at, created_at
    FROM api_keys WHERE user_id = ${apiKey.user_id}
  `;

  await recordUsage({
    userId: apiKey.user_id, apiKeyId: apiKey.id, endpoint: '/api/v1/account',
    method: req.method, statusCode: 200, responseTime: Date.now() - start
  });

  return ok(res, {
    user: userRows[0],
    keys: keyRows
  });
}
