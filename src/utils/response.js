import { generateRequestId } from './crypto.js';

export function ok(res, data, { status = 200, message = 'Request successful' } = {}) {
  return res.status(status).json({
    success: true,
    message,
    data,
    meta: { timestamp: new Date().toISOString(), requestId: generateRequestId() }
  });
}

export function fail(res, status, code, message, extra = null) {
  const body = {
    success: false,
    message,
    error: { code },
    meta: { timestamp: new Date().toISOString(), requestId: generateRequestId() }
  };
  if (extra) body.error.details = extra;
  return res.status(status).json(body);
}

export async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
  });
}
