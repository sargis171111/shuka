import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configFile = fileURLToPath(import.meta.url);
const configDir = path.dirname(configFile);
const candidateRoot = path.resolve(configDir, '..');
export const ROOT_DIR = fs.existsSync(path.join(candidateRoot, 'package.json'))
  ? candidateRoot
  : process.cwd();

export const PORT = Number(process.env.PORT || 3000);
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PROD = NODE_ENV === 'production';
export const IS_NETLIFY = Boolean(process.env.NETLIFY);
export const IS_HTTPS = IS_PROD || IS_NETLIFY;

const DEFAULT_DATA_DIR = IS_NETLIFY ? '/tmp/shuka-data' : './data';
export const DATA_DIR = path.resolve(ROOT_DIR, process.env.DATA_DIR || DEFAULT_DATA_DIR);
export const DB_PATH = path.join(DATA_DIR, 'shuka.db');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

if (IS_PROD && !IS_NETLIFY && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required in production');
}

export const SESSION_SECRET =
  process.env.SESSION_SECRET || 'shuka-dev-only-secret-change-in-production';

export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export const ARMENIA_REGIONS = [
  'Yerevan',
  'Aragatsotn',
  'Ararat',
  'Armavir',
  'Gegharkunik',
  'Kotayk',
  'Lori',
  'Shirak',
  'Syunik',
  'Tavush',
  'Vayots Dzor',
];
