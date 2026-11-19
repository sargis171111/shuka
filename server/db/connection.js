import fs from 'node:fs';
import { createRequire } from 'node:module';
import { DATA_DIR, DB_PATH, UPLOADS_DIR } from '../config.js';

const connRequire = createRequire(import.meta.url);

let singletonDb = null;

export function ensureDataDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function createNodeSqliteAdapter(dbPath) {
  const { DatabaseSync } = connRequire('node:sqlite');
  const raw = new DatabaseSync(dbPath);
  let txDepth = 0;

  return {
    pragma(stmt, opts) {
      if (opts?.simple) {
        const row = raw.prepare(`PRAGMA ${stmt}`).get();
        return row ? Object.values(row)[0] : undefined;
      }
      raw.exec(`PRAGMA ${stmt}`);
      return undefined;
    },
    exec(sql) {
      return raw.exec(sql);
    },
    prepare(sql) {
      const stmt = raw.prepare(sql);
      return {
        run(...args) {
          const res = stmt.run(...args);
          return {
            changes: Number(res.changes),
            lastInsertRowid: Number(res.lastInsertRowid),
          };
        },
        get(...args) {
          return stmt.get(...args);
        },
        all(...args) {
          return stmt.all(...args);
        },
      };
    },
    transaction(fn) {
      const makeRunner = (beginSql) => (...args) => {
        const nested = txDepth > 0;
        if (!nested) raw.exec(beginSql);
        txDepth += 1;
        try {
          const out = fn(...args);
          txDepth -= 1;
          if (!nested) raw.exec('COMMIT');
          return out;
        } catch (err) {
          txDepth -= 1;
          if (!nested) {
            try {
              raw.exec('ROLLBACK');
            } catch {
              // ignore rollback error
            }
          }
          throw err;
        }
      };
      const fnDefault = makeRunner('BEGIN');
      fnDefault.immediate = makeRunner('BEGIN IMMEDIATE');
      return fnDefault;
    },
    close() {
      raw.close();
    },
  };
}

function openDriver(dbPath) {
  if (!process.env.NETLIFY) {
    try {
      const BetterSqlite3 = connRequire(['better', 'sqlite3'].join('-'));
      return new BetterSqlite3(dbPath);
    } catch {
      // Fallback to built-in node:sqlite when native module isn't compiled for target arch
    }
  }
  return createNodeSqliteAdapter(dbPath);
}

export function openDatabase(dbPath = DB_PATH) {
  ensureDataDirs();
  const db = openDriver(dbPath);
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
