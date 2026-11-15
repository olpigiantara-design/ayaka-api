import { getDb } from '../src/utils/db.js';
import { requireUser } from '../src/utils/auth.js';
import { ok } from '../src/utils/response.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const sql = getDb();
  const recent = await sql`
    SELECT id, endpoint, method, status_code, response_time, created_at
    FROM api_usage WHERE user_id = ${user.id}
    ORDER BY created_at DESC LIMIT 50
  `;
  return ok(res, { usage: recent });
}
