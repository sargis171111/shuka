import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BACKUPS_DIR } from '../config.js';
import { getDb, closeDb } from './connection.js';

const backupFile = fileURLToPath(import.meta.url);

export function createBackup(targetPath) {
  const db = getDb();
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = targetPath
    ? path.resolve(targetPath)
    : path.join(BACKUPS_DIR, `shuka-backup-${stamp}.db`);

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  db.prepare(`VACUUM INTO ?`).run(dest);
  const stats = fs.statSync(dest);
  console.log(`[backup] Created ${dest} (${stats.size} bytes)`);
  return { path: dest, size: stats.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === backupFile) {
  try {
    createBackup(process.argv[2]);
  } finally {
    closeDb();
  }
}
