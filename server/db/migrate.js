import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, closeDb } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

export function runMigrations(db = getDb()) {
  const currentVersion = db.pragma('user_version', { simple: true });
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/i.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  let applied = 0;

  for (const file of files) {
    const version = parseInt(file.split('_')[0], 10);
    if (version <= currentVersion) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${version}`);
    });
    applyMigration();
    applied += 1;
    console.log(`[migrate] Applied ${file} (user_version=${version})`);
  }

  return applied;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    const db = getDb();
    const applied = runMigrations(db);
    if (applied === 0) {
      console.log('[migrate] Database schema is up to date.');
    }
  } finally {
    closeDb();
  }
}
