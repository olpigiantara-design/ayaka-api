import { getDb } from '../src/utils/db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=30');
  try {
    const sql = getDb();
    const [reqCount] = await sql`SELECT COUNT(*)::int AS c FROM api_usage`;
    const [avg] = await sql`SELECT COALESCE(AVG(response_time),0)::int AS ms FROM api_usage`;
    const [usersCount] = await sql`SELECT COUNT(*)::int AS c FROM users`;
    const [keysCount] = await sql`SELECT COUNT(*)::int AS c FROM api_keys WHERE status='active'`;
    return res.status(200).json({
      success: true,
      data: {
        total_requests: reqCount.c,
        avg_response_time: avg.ms,
        total_users: usersCount.c,
        active_keys: keysCount.c,
        total_endpoints: 7
      }
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Stats unavailable' });
  }
}
