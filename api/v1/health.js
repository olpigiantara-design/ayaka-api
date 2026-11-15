import { getDb } from '../../src/utils/db.js';
import { apiKeyAuth, recordUsage } from '../../src/middleware/apiKeyAuth.js';
import { ok, fail } from '../../src/utils/response.js';

export default async function handler(req, res) {
  const start = Date.now();
  const { apiKey, error } = await apiKeyAuth(req);
  if (error) {
    return fail(res, error.status, error.code, error.message);
  }
  try {
    const sql = getDb();
    await sql`SELECT 1`;
    await recordUsage({
      userId: apiKey.user_id, apiKeyId: apiKey.id, endpoint: '/api/v1/health',
      method: req.method, statusCode: 200, responseTime: Date.now() - start
    });
    return ok(res, {
      status: 'operational',
      database: 'connected',
      uptime: 'active',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    return fail(res, 500, 'DB_ERROR', 'Database unavailable');
  }
}
