import { apiKeyAuth, recordUsage } from '../../src/middleware/apiKeyAuth.js';
import { ok, fail } from '../../src/utils/response.js';

export default async function handler(req, res) {
  const start = Date.now();
  const { apiKey, error } = await apiKeyAuth(req);
  if (error) {
    await recordUsage({
      userId: null, apiKeyId: null, endpoint: '/api/v1',
      method: req.method, statusCode: error.status, responseTime: Date.now() - start
    });
    return fail(res, error.status, error.code, error.message);
  }
  await recordUsage({
    userId: apiKey.user_id, apiKeyId: apiKey.id, endpoint: '/api/v1',
    method: req.method, statusCode: 200, responseTime: Date.now() - start
  });
  return ok(res, {
    name: 'AYAKA API',
    version: '1.0.0',
    endpoints: [
      '/api/v1/health',
      '/api/v1/account',
      '/api/v1/users'
    ]
  });
}
