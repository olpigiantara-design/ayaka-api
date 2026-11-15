import { getDb } from '../utils/db.js';
import { hashApiKey } from '../utils/crypto.js';

export async function apiKeyAuth(req) {
  const rawKey = req.headers['x-api-key'];
  if (!rawKey) {
    return { error: { status: 401, code: 'MISSING_API_KEY', message: 'x-api-key header required' } };
  }
  if (!rawKey.startsWith('AYK_')) {
    return { error: { status: 401, code: 'INVALID_API_KEY', message: 'Invalid API key format' } };
  }

  const sql = getDb();
  const hash = hashApiKey(rawKey);
  const rows = await sql`
    SELECT id, user_id, status, quota_limit, requests_used, expires_at
    FROM api_keys WHERE key_hash = ${hash} LIMIT 1
  `;
  const key = rows[0];
  if (!key) return { error: { status: 401, code: 'INVALID_API_KEY', message: 'API key not found' } };
  if (key.status !== 'active') {
    return { error: { status: 403, code: 'KEY_REVOKED', message: 'API key has been revoked' } };
  }
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return { error: { status: 403, code: 'KEY_EXPIRED', message: 'API key has expired' } };
  }
  if (key.requests_used >= key.quota_limit) {
    return { error: { status: 429, code: 'QUOTA_EXCEEDED', message: 'API key quota exceeded' } };
  }

  const recent = await sql`
    SELECT COUNT(*)::int AS c FROM api_usage
    WHERE api_key_id = ${key.id} AND created_at > NOW() - INTERVAL '1 minute'
  `;
  if (recent[0].c >= 60) {
    return { error: { status: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit: 60 requests/minute' } };
  }

  await sql`UPDATE api_keys SET requests_used = requests_used + 1 WHERE id = ${key.id}`;
  return { apiKey: key };
}

export async function recordUsage({ userId, apiKeyId, endpoint, method, statusCode, responseTime }) {
  try {
    const sql = getDb();
    await sql`
      INSERT INTO api_usage (user_id, api_key_id, endpoint, method, status_code, response_time)
      VALUES (${userId}, ${apiKeyId}, ${endpoint}, ${method}, ${statusCode}, ${responseTime})
    `;
  } catch (e) {
    console.error('Failed to record usage:', e.message);
  }
}
