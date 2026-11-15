import { getDb } from '../../../src/utils/db.js';
import { apiKeyAuth, recordUsage } from '../../../src/middleware/apiKeyAuth.js';
import { ok, fail, readBody } from '../../../src/utils/response.js';

export default async function handler(req, res) {
  const start = Date.now();
  const { apiKey, error } = await apiKeyAuth(req);
  if (error) return fail(res, error.status, error.code, error.message);

  const sql = getDb();

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT id, name, email, created_at FROM demo_users
      WHERE owner_user_id = ${apiKey.user_id} ORDER BY created_at DESC
    `;
    await recordUsage({
      userId: apiKey.user_id, apiKeyId: apiKey.id, endpoint: '/api/v1/users',
      method: 'GET', statusCode: 200, responseTime: Date.now() - start
    });
    return ok(res, { users: rows, count: rows.length });
  }

  if (req.method === 'POST') {
    const { name, email } = await readBody(req);
    if (!name || !email) {
      return fail(res, 422, 'VALIDATION_ERROR', 'name and email required');
    }
    const rows = await sql`
      INSERT INTO demo_users (owner_user_id, name, email)
      VALUES (${apiKey.user_id}, ${name}, ${email})
      RETURNING id, name, email, created_at
    `;
    await recordUsage({
      userId: apiKey.user_id, apiKeyId: apiKey.id, endpoint: '/api/v1/users',
      method: 'POST', statusCode: 201, responseTime: Date.now() - start
    });
    return ok(res, { user: rows[0] }, { status: 201, message: 'User created' });
  }

  return fail(res, 405, 'METHOD_NOT_ALLOWED', 'GET or POST only');
}
