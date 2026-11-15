import { getDb } from '../../../src/utils/db.js';
import { requireUser } from '../../../src/utils/auth.js';
import { ok, fail } from '../../../src/utils/response.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'POST only');
  const user = await requireUser(req, res);
  if (!user) return;

  const { id } = req.query;
  const sql = getDb();
  const rows = await sql`
    UPDATE api_keys SET status = 'revoked'
    WHERE id = ${id} AND user_id = ${user.id}
    RETURNING id, status
  `;
  if (!rows.length) return fail(res, 404, 'NOT_FOUND', 'API key not found');
  return ok(res, { key: rows[0] }, { message: 'API key revoked' });
}
