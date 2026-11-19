import crypto from 'node:crypto';
import { IS_PROD, SESSION_SECRET, SESSION_TTL_MS } from '../config.js';
import { getDb } from '../db/connection.js';
import { AppError } from './errors.js';

export const COOKIE_NAME = 'shuka_session';

function signPayload(payloadB64) {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
}

export function createSessionToken(userId) {
  const payload = {
    userId,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signPayload(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;

  const payloadB64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!payloadB64 || !sig) return null;

  const expected = signPayload(payloadB64);
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const data = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!data || typeof data.userId !== 'number' || typeof data.exp !== 'number') {
      return null;
    }
    if (Date.now() > data.exp) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function setSessionCookie(res, userId) {
  const token = createSessionToken(userId);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    path: '/',
  });
}

export function attachUser(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();

  const session = verifySessionToken(token);
  if (!session) return next();

  const db = getDb();
  const user = db
    .prepare(
      `SELECT id, email, name, phone, store_name, created_at
       FROM users WHERE id = ?`
    )
    .get(session.userId);

  if (user) {
    req.user = user;
  }
  return next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required. Please sign in.'));
  }
  return next();
}

export function requireSeller(req, _res, next) {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required. Please sign in.'));
  }
  if (!req.user.store_name) {
    return next(
      new AppError(403, 'SELLER_REQUIRED', 'Activate a seller store before accessing seller tools.')
    );
  }
  return next();
}
