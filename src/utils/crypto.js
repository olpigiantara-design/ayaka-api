import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export function generateApiKey() {
  return 'AYK_' + randomBytes(24).toString('hex');
}

export function hashApiKey(key) {
  const pepper = process.env.API_KEY_PEPPER || '';
  return createHash('sha256').update(key + pepper).digest('hex');
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64);
  return salt + ':' + derived.toString('hex');
}

export async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const derived = await scryptAsync(password, salt, 64);
  const hashBuf = Buffer.from(hash, 'hex');
  if (hashBuf.length !== derived.length) return false;
  return timingSafeEqual(hashBuf, derived);
}

export function generateSessionToken() {
  return randomBytes(32).toString('hex');
}

export function generateRequestId() {
  return 'req_' + randomBytes(8).toString('hex');
}
