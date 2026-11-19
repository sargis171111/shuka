import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { UPLOADS_DIR } from '../config.js';
import { AppError } from './errors.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PRODUCT_IMAGES = 5;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

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

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const idPart = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
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
