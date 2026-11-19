import fs from 'node:fs';
import Database from 'better-sqlite3';
import { DATA_DIR, DB_PATH, UPLOADS_DIR } from '../config.js';

let singletonDb = null;

export function ensureDataDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function openDatabase(dbPath = DB_PATH) {
  ensureDataDirs();
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

export function getDb() {
  if (!singletonDb) {
    singletonDb = openDatabase();
  }
  return singletonDb;
}

export function closeDb() {
  if (singletonDb) {
    singletonDb.close();
    singletonDb = null;
  }
}
