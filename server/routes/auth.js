import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/connection.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { clearSessionCookie, requireAuth, setSessionCookie } from '../lib/auth.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    store_name: row.store_name || null,
    created_at: row.created_at,
  };
}

router.post(
  '/auth/register',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();
    const phone = String(req.body?.phone || '').trim();

    if (!EMAIL_RE.test(email)) {
      throw new AppError(400, 'INVALID_EMAIL', 'Please provide a valid email address.');
    }
    if (password.length < 6) {
      throw new AppError(400, 'INVALID_PASSWORD', 'Password must be at least 6 characters.');
    }
    if (name.length < 2 || name.length > 80) {
      throw new AppError(400, 'INVALID_NAME', 'Name must be between 2 and 80 characters.');
    }
    if (phone.length < 6 || phone.length > 30) {
      throw new AppError(400, 'INVALID_PHONE', 'Please provide a valid phone number.');
    }

    const db = getDb();
    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const result = db
      .prepare(
        `INSERT INTO users (email, password_hash, name, phone, store_name, created_at)
         VALUES (?, ?, ?, ?, NULL, ?)`
      )
      .run(email, passwordHash, name, phone, now);

    const user = db
      .prepare(`SELECT id, email, name, phone, store_name, created_at FROM users WHERE id = ?`)
      .get(Number(result.lastInsertRowid));

    setSessionCookie(res, user.id);
    res.status(201).json({ user: sanitizeUser(user) });
  })
);

router.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      throw new AppError(400, 'MISSING_CREDENTIALS', 'Email and password are required.');
    }

    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, email, password_hash, name, phone, store_name, created_at
         FROM users WHERE email = ?`
      )
      .get(email);

    if (!row) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    setSessionCookie(res, row.id);
    res.json({ user: sanitizeUser(row) });
  })
);

router.post('/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.json({ user: null, last_address: null });
    }

    const db = getDb();
    const lastOrder = db
      .prepare(
        `SELECT recipient, phone, region, city, street, apartment, note
         FROM orders WHERE buyer_id = ? ORDER BY id DESC LIMIT 1`
      )
      .get(req.user.id);

    res.json({
      user: sanitizeUser(req.user),
      last_address: lastOrder || null,
    });
  })
);

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const phone = String(req.body?.phone || '').trim();

    if (name.length < 2 || name.length > 80) {
      throw new AppError(400, 'INVALID_NAME', 'Name must be between 2 and 80 characters.');
    }
    if (phone.length < 6 || phone.length > 30) {
      throw new AppError(400, 'INVALID_PHONE', 'Please provide a valid phone number.');
    }

    const db = getDb();
    db.prepare(`UPDATE users SET name = ?, phone = ? WHERE id = ?`).run(name, phone, req.user.id);

    const updated = db
      .prepare(`SELECT id, email, name, phone, store_name, created_at FROM users WHERE id = ?`)
      .get(req.user.id);

    res.json({ user: sanitizeUser(updated) });
  })
);

export default router;
