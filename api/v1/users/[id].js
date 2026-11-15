import { getDb } from '../../../src/utils/db.js';
import { apiKeyAuth, recordUsage } from '../../../src/middleware/apiKeyAuth.js';
import { ok, fail, readBody } from '../../../src/utils/response.js';

export default async function handler(req, res) {
  const start = Date.now();
  const { apiKey, error } = await apiKeyAuth(req);
  if (error) return fail(res, error.status, error.code, error.message);

  const { id } = req.query;
  const sql = getDb();

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT id, name, email, created_at FROM demo_users
      WHERE id = ${id} AND owner_user_id = ${apiKey.user_id}
    `;
    if (!rows.length) return fail(res, 404, 'NOT_FOUND', 'User not found');
    await recordUsage({
      userId: apiKey.user_id, apiKeyId: apiKey.id, endpoint: '/api/v1/users/' + id,
      method: 'GET', statusCode: 200, responseTime: Date.now() - start
    });
    return ok(res, { user: rows[0] });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const { name, email } = await readBody(req);
    const existing = await sql`
      SELECT name, email FROM demo_users
      WHERE id = ${id} AND owner_user_id = ${apiKey.user_id}
    `;
    if (!existing.length) return fail(res, 404, 'NOT_FOUND', 'User not found');

    const newName = req.method === 'PUT' ? (name || null) : (name ?? existing[0].name);
    const newEmail = req.method === 'PUT' ? (email || null) : (email ?? existing[0].email);
    if (!newName || !newEmail) return fail(res, 422, 'VALIDATION_ERROR', 'name and email required');

    const rows = await sql`
      UPDATE demo_users SET name = ${newName}, email = ${newEmail}, updated_at = NOW()
      WHERE id = ${id} AND owner_user_id = ${apiKey.user_id}
      RETURNING id, name, email, created_at
    `;
    await recordUsage({
      userId: apiKey.user_id, apiKeyId: apiKey.id, endpoint: '/api/v1/users/' + id,
      method: req.method, statusCode: 200, responseTime: Date.now() - start
    });
    return ok(res, { user: rows[0] }, { message: 'User updated' });
  }

  if (req.method === 'DELETE') {
    const rows = await sql`
      DELETE FROM demo_users WHERE id = ${id} AND owner_user_id = ${apiKey.user_id}
      RETURNING id
    `;
    if (!rows.length) return fail(res, 404, 'NOT_FOUND', 'User not found');
    await recordUsage({
      userId: apiKey.user_id, apiKeyId: apiKey.id, endpoint: '/api/v1/users/' + id,
      method: 'DELETE', statusCode: 200, responseTime: Date.now() - start
    });
    return ok(res, { deleted: id }, { message: 'User deleted' });
  }

  return fail(res, 405, 'METHOD_NOT_ALLOWED', 'GET, PUT, PATCH, or DELETE only');
}
