import { getDb } from '../src/utils/db.js';
import { requireUser } from '../src/utils/auth.js';
import { ok, fail } from '../src/utils/response.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const sql = getDb();

  const [total] = await sql`
    SELECT COUNT(*)::int AS c FROM api_usage WHERE user_id = ${user.id}
  `;
  const [successReq] = await sql`
    SELECT COUNT(*)::int AS c FROM api_usage
    WHERE user_id = ${user.id} AND status_code < 400
  `;
  const [failedReq] = await sql`
    SELECT COUNT(*)::int AS c FROM api_usage
    WHERE user_id = ${user.id} AND status_code >= 400
  `;
  const [avg] = await sql`
    SELECT COALESCE(AVG(response_time), 0)::int AS ms FROM api_usage WHERE user_id = ${user.id}
  `;
  const [keys] = await sql`
    SELECT
      COUNT(*)::int AS total,
      COALESCE(SUM(quota_limit - requests_used), 0)::int AS remaining,
      COUNT(*) FILTER (WHERE status = 'active')::int AS active
    FROM api_keys WHERE user_id = ${user.id}
  `;

  const chart = await sql`
    SELECT
      to_char(date_trunc('hour', created_at), 'HH24:00') AS hour,
      COUNT(*)::int AS count
    FROM api_usage
    WHERE user_id = ${user.id} AND created_at > NOW() - INTERVAL '24 hours'
    GROUP BY date_trunc('hour', created_at)
    ORDER BY date_trunc('hour', created_at)
  `;

  return ok(res, {
    total_requests: total.c,
    successful_requests: successReq.c,
    failed_requests: failedReq.c,
    avg_response_time: avg.ms,
    keys_total: keys.total,
    keys_active: keys.active,
    remaining_quota: keys.remaining,
    chart
  });
}
