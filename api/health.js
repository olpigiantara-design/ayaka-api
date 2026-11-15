import { getDb } from '../src/utils/db.js';

export default async function handler(req, res) {
  const start = Date.now();
  const services = { api: 'operational', database: 'operational', auth: 'operational' };

  try {
    const sql = getDb();
    await sql`SELECT 1`;
  } catch (e) {
    services.database = 'degraded';
  }

  const responseTime = Date.now() - start;
  res.status(200).json({
    success: true,
    message: 'Health check',
    data: {
      status: services.database === 'operational' ? 'operational' : 'degraded',
      services,
      response_time: responseTime,
      timestamp: new Date().toISOString()
    }
  });
}
