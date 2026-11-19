import express from 'express';
import { getDb } from '../db/connection.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { formatImage } from '../lib/images.js';

const router = express.Router();

function escapeLike(str) {
  return str.replace(/[\\%_]/g, '\\$&');
}

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const db = getDb();
    const categories = db
      .prepare(
        `SELECT c.id, c.name, c.slug,
                COUNT(CASE WHEN p.is_published = 1 THEN 1 END) AS product_count
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id
         GROUP BY c.id
         ORDER BY c.id ASC`
      )
      .all();
    res.json({ categories });
  })
);

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const q = String(req.query.q || '').trim();
    const category = String(req.query.category || '').trim();
    const minPriceRaw = req.query.minPrice;
    const maxPriceRaw = req.query.maxPrice;
    const sort = String(req.query.sort || 'newest');
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(48, Math.max(1, parseInt(String(req.query.limit || '12'), 10) || 12));
    const offset = (page - 1) * limit;

    const where = ['p.is_published = 1'];
    const params = [];

    if (q) {
      const escaped = `%${escapeLike(q)}%`;
      where.push(`(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')`);
      params.push(escaped, escaped);
    }

    if (category) {
      if (/^\d+$/.test(category)) {
        where.push('c.id = ?');
        params.push(Number(category));
      } else {
        where.push('c.slug = ?');
        params.push(category);
      }
    }

    if (minPriceRaw !== undefined && minPriceRaw !== '') {
      const minPrice = Number(minPriceRaw);
      if (Number.isFinite(minPrice) && minPrice >= 0) {
        where.push('p.price_amd >= ?');
        params.push(Math.floor(minPrice));
      }
    }

    if (maxPriceRaw !== undefined && maxPriceRaw !== '') {
      const maxPrice = Number(maxPriceRaw);
      if (Number.isFinite(maxPrice) && maxPrice >= 0) {
        where.push('p.price_amd <= ?');
        params.push(Math.floor(maxPrice));
      }
    }

    const orderMap = {
      newest: 'p.created_at DESC, p.id DESC',
      price_asc: 'p.price_amd ASC, p.id DESC',
      price_desc: 'p.price_amd DESC, p.id DESC',
      rating: 'p.rating_avg DESC, p.rating_count DESC, p.id DESC',
    };
    const orderBy = orderMap[sort] || orderMap.newest;
    const whereSql = where.join(' AND ');

    const countRow = db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE ${whereSql}`
      )
      .get(...params);

    const rows = db
      .prepare(
        `SELECT p.id, p.seller_id, p.category_id, p.title, p.description,
                p.price_amd, p.stock, p.is_published, p.rating_avg, p.rating_count,
                p.created_at, p.updated_at,
                c.name AS category_name, c.slug AS category_slug,
                u.store_name AS seller_store_name,
                (
                  SELECT pi.file_path
                  FROM product_images pi
                  WHERE pi.product_id = p.id
                  ORDER BY pi.position ASC
                  LIMIT 1
                ) AS primary_image
         FROM products p
         JOIN categories c ON c.id = p.category_id
         JOIN users u ON u.id = p.seller_id
         WHERE ${whereSql}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    const products = rows.map((r) => ({
      ...r,
      image_url: r.primary_image ? `/uploads/${r.primary_image}` : null,
      thumb_url: r.primary_image
        ? `/uploads/${r.primary_image.replace('-large.', '-thumb.')}`
        : null,
    }));

    const total = countRow.total;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.json({
      products,
      total,
      page,
      limit,
      totalPages,
    });
  })
);

router.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }

    const db = getDb();
    const row = db
      .prepare(
        `SELECT p.id, p.seller_id, p.category_id, p.title, p.description,
                p.price_amd, p.stock, p.is_published, p.rating_avg, p.rating_count,
                p.created_at, p.updated_at,
                c.name AS category_name, c.slug AS category_slug,
                u.store_name AS seller_store_name
         FROM products p
         JOIN categories c ON c.id = p.category_id
         JOIN users u ON u.id = p.seller_id
         WHERE p.id = ?`
      )
      .get(productId);

    if (!row) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }

    if (row.is_published !== 1 && (!req.user || req.user.id !== row.seller_id)) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }

    const images = db
      .prepare(
        `SELECT id, file_path, position
         FROM product_images
         WHERE product_id = ?
         ORDER BY position ASC`
      )
      .all(productId)
      .map(formatImage);

    res.json({
      product: {
        ...row,
        images,
      },
    });
  })
);

router.get(
  '/products/:id/reviews',
  asyncHandler(async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }

    const db = getDb();
    const product = db
      .prepare(`SELECT id, seller_id, is_published FROM products WHERE id = ?`)
      .get(productId);

    if (!product || (product.is_published !== 1 && (!req.user || req.user.id !== product.seller_id))) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }

    const reviews = db
      .prepare(
        `SELECT r.id, r.product_id, r.buyer_id, r.rating, r.body, r.created_at,
                u.name AS buyer_name
         FROM reviews r
         JOIN users u ON u.id = r.buyer_id
         WHERE r.product_id = ?
         ORDER BY r.created_at DESC, r.id DESC`
      )
      .all(productId);

    res.json({ reviews });
  })
);

export default router;
