import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { UPLOADS_DIR } from '../config.js';
import { AppError } from './errors.js';

const imgRequire = createRequire(import.meta.url);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PRODUCT_IMAGES = 5;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

function getSharp() {
  if (process.env.NETLIFY) return null;
  try {
    return imgRequire(['sh', 'arp'].join(''));
  } catch {
    return null;
  }
}

function detectImageFormatFromMagicBytes(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export function formatImage(row) {
  return {
    id: row.id,
    file_path: row.file_path,
    position: row.position,
    url: `/uploads/${row.file_path}`,
    thumb_url: `/uploads/${row.file_path.replace('-large.', '-thumb.')}`,
  };
}

export async function validateAndSaveProductImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError(400, 'INVALID_IMAGE', 'Empty image file.');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new AppError(400, 'FILE_TOO_LARGE', 'Each image must be 5 MB or smaller.');
  }

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const idPart = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const sharp = getSharp();

  if (sharp) {
    let meta;
    try {
      meta = await sharp(buffer).metadata();
    } catch {
      throw new AppError(
        400,
        'INVALID_IMAGE',
        'File is not a valid image. Allowed formats: JPEG, PNG, WebP.'
      );
    }

    if (!meta || !ALLOWED_FORMATS.has(meta.format) || !meta.width || !meta.height) {
      throw new AppError(
        400,
        'INVALID_IMAGE',
        'Unsupported image format. Only valid JPEG, PNG, and WebP images are accepted.'
      );
    }

    const largeName = `prod-${idPart}-large.webp`;
    const thumbName = `prod-${idPart}-thumb.webp`;
    const largePath = path.join(UPLOADS_DIR, largeName);
    const thumbPath = path.join(UPLOADS_DIR, thumbName);

    try {
      await sharp(buffer)
        .rotate()
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84 })
        .toFile(largePath);

      await sharp(buffer)
        .rotate()
        .resize(400, 400, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(thumbPath);
    } catch {
      unlinkSafe(largePath);
      unlinkSafe(thumbPath);
      throw new AppError(400, 'INVALID_IMAGE', 'Could not decode image bytes.');
    }

    return largeName;
  }

  const fmt = detectImageFormatFromMagicBytes(buffer);
  if (!fmt) {
    throw new AppError(
      400,
      'INVALID_IMAGE',
      'Unsupported image format. Only valid JPEG, PNG, and WebP images are accepted.'
    );
  }

  const ext = fmt === 'jpeg' ? 'jpg' : fmt;
  const largeName = `prod-${idPart}-large.${ext}`;
  const thumbName = `prod-${idPart}-thumb.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, largeName), buffer);
  fs.writeFileSync(path.join(UPLOADS_DIR, thumbName), buffer);
  return largeName;
}

export function deleteImageFiles(filePath) {
  if (!filePath || typeof filePath !== 'string') return;
  const safeBase = path.basename(filePath);
  const largePath = path.join(UPLOADS_DIR, safeBase);
  const thumbPath = path.join(UPLOADS_DIR, safeBase.replace('-large.', '-thumb.'));
  unlinkSafe(largePath);
  if (thumbPath !== largePath) {
    unlinkSafe(thumbPath);
  }
}

function unlinkSafe(targetPath) {
  try {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  } catch {
    // ignore cleanup errors
  }
}
