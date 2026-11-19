import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { PORT, ROOT_DIR, UPLOADS_DIR } from './config.js';
import { getDb, closeDb } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { seedIfEmpty } from './db/seed.js';
import { attachUser } from './lib/auth.js';
import { AppError, errorMiddleware } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import sellerRoutes from './routes/seller.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(attachUser);

  app.use('/api', authRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api', cartRoutes);
  app.use('/api', orderRoutes);
  app.use('/api', sellerRoutes);

  app.use('/api/*', (_req, _res, next) => {
    next(new AppError(404, 'NOT_FOUND', 'API endpoint not found.'));
  });

  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      maxAge: '7d',
      fallthrough: false,
    })
  );

  // Also handle missing uploaded file cleanly
  app.use('/uploads', (_err, _req, res, _next) => {
    res.status(404).json({
      error: { code: 'FILE_NOT_FOUND', message: 'Uploaded image not found.' },
    });
  });

  const distDir = path.join(ROOT_DIR, 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      if (fs.existsSync(indexHtmlPath)) {
        return res.sendFile(indexHtmlPath);
      }
      return next();
    });
  }

  app.use(errorMiddleware);
  return app;
}

async function start() {
  const db = getDb();
  runMigrations(db);
  await seedIfEmpty(db);

  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`[shuka] Server listening on http://localhost:${PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('[shuka] Failed to start server:', err);
  process.exit(1);
});
