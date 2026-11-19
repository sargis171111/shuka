import express from 'express';
import multer from 'multer';
import { getDb } from '../db/connection.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { requireAuth, requireSeller } from '../lib/auth.js';
import {
  MAX_IMAGE_BYTES,
  MAX_PRODUCT_IMAGES,
  deleteImageFiles,
  formatImage,
  validateAndSaveProductImage,
} from '../lib/images.js';
import { getAllowedTransitions, transitionSellerOrderTx } from '../lib/stateMachine.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: MAX_PRODUCT_IMAGES,
  },
});

function buildSellerProduct(db, productId, sellerId) {
  const product = db
    .prepare(
      `SELECT p.id, p.seller_id, p.category_id, p.title, p.description,
              p.price_amd, p.stock, p.is_published, p.rating_avg, p.rating_count,
              p.created_at, p.updated_at,
              c.name AS category_name, c.slug AS category_slug,
              COALESCE((
                SELECT SUM(oi.quantity)
                FROM order_items oi
                JOIN seller_orders so ON so.id = oi.seller_order_id
                WHERE oi.product_id = p.id AND so.status != 'cancelled'
              ), 0) AS units_sold
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.id = ? AND p.seller_id = ?`
    )
    .get(productId, sellerId);

  if (!product) return null;

  const images = db
    .prepare(
      `SELECT id, file_path, position
       FROM product_images
       WHERE product_id = ?
       ORDER BY position ASC`
    )
    .all(productId)
    .map(formatImage);

  return {
    ...product,
    images,
  };
}

function buildSellerOrderDetail(db, sellerOrderId, sellerId) {
  const so = db
    .prepare(
      `SELECT so.id, so.order_id, so.seller_id, so.status, so.subtotal_amd, so.updated_at,
              o.recipient, o.phone, o.region, o.city, o.street, o.apartment, o.note,
              o.created_at AS order_created_at
       FROM seller_orders so
       JOIN orders o ON o.id = so.order_id
       WHERE so.id = ? AND so.seller_id = ?`
    )
    .get(sellerOrderId, sellerId);

  if (!so) return null;

  const items = db
    .prepare(
      `SELECT oi.id, oi.product_id, oi.title, oi.unit_price_amd, oi.quantity,
              (
                SELECT pi.file_path
                FROM product_images pi
                WHERE pi.product_id = oi.product_id
                ORDER BY pi.position ASC
                LIMIT 1
              ) AS primary_image
       FROM order_items oi
       WHERE oi.seller_order_id = ?
       ORDER BY oi.id ASC`
    )
    .all(so.id)
    .map((it) => ({
      ...it,
      line_total_amd: it.unit_price_amd * it.quantity,
      thumb_url: it.primary_image
        ? `/uploads/${it.primary_image.replace('-large.', '-thumb.')}`
        : null,
    }));

  const statusHistory = db
    .prepare(
      `SELECT sh.id, sh.seller_order_id, sh.from_status, sh.to_status, sh.changed_by, sh.created_at,
              u.name AS changed_by_name
       FROM status_history sh
       JOIN users u ON u.id = sh.changed_by
       WHERE sh.seller_order_id = ?
       ORDER BY sh.id ASC`
    )
    .all(so.id);

  return {
    ...so,
    allowed_transitions: getAllowedTransitions(so.status, 'seller'),
    items,
    status_history: statusHistory,
  };
}

router.post(
  '/seller/activate',
  requireAuth,
  asyncHandler(async (req, res) => {
    const storeName = String(req.body?.store_name || '').trim();
    const phone = String(req.body?.phone || req.user.phone || '').trim();

    if (storeName.length < 2 || storeName.length > 60) {
      throw new AppError(400, 'INVALID_STORE_NAME', 'Store name must be between 2 and 60 characters.');
    }
    if (phone.length < 6 || phone.length > 30) {
      throw new AppError(400, 'INVALID_PHONE', 'Valid contact phone number is required.');
    }

    const db = getDb();
    const duplicate = db
      .prepare(`SELECT id FROM users WHERE LOWER(store_name) = LOWER(?) AND id != ?`)
      .get(storeName, req.user.id);

    if (duplicate) {
      throw new AppError(409, 'STORE_NAME_TAKEN', 'That store name is already taken.');
    }

    db.prepare(`UPDATE users SET store_name = ?, phone = ? WHERE id = ?`).run(
      storeName,
      phone,
      req.user.id
    );

    const updated = db
      .prepare(`SELECT id, email, name, phone, store_name, created_at FROM users WHERE id = ?`)
      .get(req.user.id);

    res.json({ user: updated });
  })
);

router.get(
  '/seller/overview',
  requireSeller,
  asyncHandler(async (req, res) => {
    const db = getDb();
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const placedRow = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM seller_orders
         WHERE seller_id = ? AND status = 'placed'`
      )
      .get(req.user.id);

    const confirmedRow = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM seller_orders
         WHERE seller_id = ? AND status = 'confirmed'`
      )
      .get(req.user.id);

    const revenueRow = db
      .prepare(
        `SELECT COALESCE(SUM(subtotal_amd), 0) AS revenue_30d_amd
         FROM seller_orders
         WHERE seller_id = ? AND status = 'delivered' AND updated_at >= ?`
      )
      .get(req.user.id, sinceIso);

    const productsRow = db
      .prepare(
        `SELECT COUNT(*) AS total_products,
                COALESCE(SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END), 0) AS published_products
         FROM products
         WHERE seller_id = ?`
      )
      .get(req.user.id);

    res.json({
      placed_count: placedRow.count,
      confirmed_count: confirmedRow.count,
      revenue_30d_amd: revenueRow.revenue_30d_amd,
      total_products: productsRow.total_products,
      published_products: productsRow.published_products,
    });
  })
);

router.get(
  '/seller/products',
  requireSeller,
  asyncHandler(async (req, res) => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT p.id, p.seller_id, p.category_id, p.title, p.description,
                p.price_amd, p.stock, p.is_published, p.rating_avg, p.rating_count,
                p.created_at, p.updated_at,
                c.name AS category_name, c.slug AS category_slug,
                (
                  SELECT pi.file_path
                  FROM product_images pi
                  WHERE pi.product_id = p.id
                  ORDER BY pi.position ASC
                  LIMIT 1
                ) AS primary_image,
                COALESCE((
                  SELECT SUM(oi.quantity)
                  FROM order_items oi
                  JOIN seller_orders so ON so.id = oi.seller_order_id
                  WHERE oi.product_id = p.id AND so.status != 'cancelled'
                ), 0) AS units_sold
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.seller_id = ?
         ORDER BY p.created_at DESC, p.id DESC`
      )
      .all(req.user.id);

    const products = rows.map((r) => ({
      ...r,
      thumb_url: r.primary_image
        ? `/uploads/${r.primary_image.replace('-large.', '-thumb.')}`
        : null,
    }));

    res.json({ products });
  })
);

router.get(
  '/seller/products/:id',
  requireSeller,
  asyncHandler(async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }

    const db = getDb();
    const product = buildSellerProduct(db, productId, req.user.id);
    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }

    res.json({ product });
  })
);

router.post(
  '/seller/products',
  requireSeller,
  asyncHandler(async (req, res) => {
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const categoryId = Number(req.body?.category_id);
    const priceAmd = Number(req.body?.price_amd);
    const stock = Number(req.body?.stock);
    const isPublished = req.body?.is_published === undefined ? 1 : req.body.is_published ? 1 : 0;

    if (title.length < 3 || title.length > 140) {
      throw new AppError(400, 'INVALID_TITLE', 'Product title must be between 3 and 140 characters.');
    }
    if (description.length < 10 || description.length > 4000) {
      throw new AppError(400, 'INVALID_DESCRIPTION', 'Description must be between 10 and 4000 characters.');
    }
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new AppError(400, 'INVALID_CATEGORY', 'Please select a valid category.');
    }
    if (!Number.isInteger(priceAmd) || priceAmd <= 0) {
      throw new AppError(400, 'INVALID_PRICE', 'Price must be a positive integer in AMD.');
    }
    if (!Number.isInteger(stock) || stock < 0) {
      throw new AppError(400, 'INVALID_STOCK', 'Stock must be a non-negative integer.');
    }

    const db = getDb();
    const category = db.prepare(`SELECT id FROM categories WHERE id = ?`).get(categoryId);
    if (!category) {
      throw new AppError(400, 'INVALID_CATEGORY', 'Selected category does not exist.');
    }

    const now = new Date().toISOString();
    const insertRes = db
      .prepare(
        `INSERT INTO products (
           seller_id, category_id, title, description, price_amd, stock,
           is_published, rating_avg, rating_count, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.0, 0, ?, ?)`
      )
      .run(req.user.id, categoryId, title, description, priceAmd, stock, isPublished, now, now);

    const product = buildSellerProduct(db, Number(insertRes.lastInsertRowid), req.user.id);
    res.status(201).json({ product });
  })
);

router.patch(
  '/seller/products/:id',
  requireSeller,
  asyncHandler(async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }

    const db = getDb();
    const existing = db
      .prepare(`SELECT * FROM products WHERE id = ? AND seller_id = ?`)
      .get(productId, req.user.id);

    if (!existing) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }

    const title = req.body?.title !== undefined ? String(req.body.title).trim() : existing.title;
    const description =
      req.body?.description !== undefined ? String(req.body.description).trim() : existing.description;
    const categoryId =
      req.body?.category_id !== undefined ? Number(req.body.category_id) : existing.category_id;
    const priceAmd =
      req.body?.price_amd !== undefined ? Number(req.body.price_amd) : existing.price_amd;
    const stock = req.body?.stock !== undefined ? Number(req.body.stock) : existing.stock;
    const isPublished =
      req.body?.is_published !== undefined
        ? req.body.is_published
          ? 1
          : 0
        : existing.is_published;
    const mainImageId =
      req.body?.main_image_id !== undefined ? Number(req.body.main_image_id) : null;

    if (title.length < 3 || title.length > 140) {
      throw new AppError(400, 'INVALID_TITLE', 'Product title must be between 3 and 140 characters.');
    }
    if (description.length < 10 || description.length > 4000) {
      throw new AppError(400, 'INVALID_DESCRIPTION', 'Description must be between 10 and 4000 characters.');
    }
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new AppError(400, 'INVALID_CATEGORY', 'Please select a valid category.');
    }
    const category = db.prepare(`SELECT id FROM categories WHERE id = ?`).get(categoryId);
    if (!category) {
      throw new AppError(400, 'INVALID_CATEGORY', 'Selected category does not exist.');
    }
    if (!Number.isInteger(priceAmd) || priceAmd <= 0) {
      throw new AppError(400, 'INVALID_PRICE', 'Price must be a positive integer in AMD.');
    }
    if (!Number.isInteger(stock) || stock < 0) {
      throw new AppError(400, 'INVALID_STOCK', 'Stock must be a non-negative integer.');
    }

    const updateTx = db.transaction(() => {
      const now = new Date().toISOString();
      db.prepare(
        `UPDATE products
         SET category_id = ?, title = ?, description = ?, price_amd = ?, stock = ?,
             is_published = ?, updated_at = ?
         WHERE id = ? AND seller_id = ?`
      ).run(categoryId, title, description, priceAmd, stock, isPublished, now, productId, req.user.id);

      if (mainImageId !== null) {
        const images = db
          .prepare(
            `SELECT id, position FROM product_images WHERE product_id = ? ORDER BY position ASC`
          )
          .all(productId);
        const target = images.find((img) => img.id === mainImageId);
        if (!target) {
          throw new AppError(404, 'IMAGE_NOT_FOUND', 'Selected main image not found on product.');
        }

        // Shift positions out of collision range before reassigning 0..N-1
        db.prepare(`UPDATE product_images SET position = position + 1000 WHERE product_id = ?`).run(
          productId
        );
        const ordered = [target, ...images.filter((img) => img.id !== mainImageId)];
        const setPos = db.prepare(`UPDATE product_images SET position = ? WHERE id = ?`);
        ordered.forEach((img, idx) => {
          setPos.run(idx, img.id);
        });
      }
    });

    updateTx.immediate();
    const product = buildSellerProduct(db, productId, req.user.id);
    res.json({ product });
  })
);

function verifyProductOwnershipBeforeUpload(req, _res, next) {
  const productId = parseInt(req.params.id, 10);
  if (!Number.isInteger(productId) || productId <= 0) {
    return next(new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.'));
  }
  const db = getDb();
  const product = db
    .prepare(`SELECT id FROM products WHERE id = ? AND seller_id = ?`)
    .get(productId, req.user.id);
  if (!product) {
    return next(new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.'));
  }
  return next();
}

router.post(
  '/seller/products/:id/images',
  requireSeller,
  verifyProductOwnershipBeforeUpload,
  upload.array('images', MAX_PRODUCT_IMAGES),
  asyncHandler(async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const files = req.files || [];

    if (files.length === 0) {
      throw new AppError(400, 'NO_FILES', 'Please upload at least one image file.');
    }

    const db = getDb();
    const existingImages = db
      .prepare(`SELECT id, position FROM product_images WHERE product_id = ? ORDER BY position ASC`)
      .all(productId);

    if (existingImages.length + files.length > MAX_PRODUCT_IMAGES) {
      throw new AppError(
        400,
        'TOO_MANY_IMAGES',
        `A product can have at most ${MAX_PRODUCT_IMAGES} images (currently ${existingImages.length}).`
      );
    }

    const savedNames = [];
    try {
      for (const file of files) {
        const saved = await validateAndSaveProductImage(file.buffer);
        savedNames.push(saved);
      }
    } catch (err) {
      for (const name of savedNames) {
        deleteImageFiles(name);
      }
      throw err;
    }

    const insertTx = db.transaction(() => {
      const currentMax = db
        .prepare(`SELECT COALESCE(MAX(position), -1) AS max_pos FROM product_images WHERE product_id = ?`)
        .get(productId).max_pos;

      const insertImg = db.prepare(
        `INSERT INTO product_images (product_id, file_path, position) VALUES (?, ?, ?)`
      );
      savedNames.forEach((name, idx) => {
        insertImg.run(productId, name, currentMax + 1 + idx);
      });
    });

    try {
      insertTx.immediate();
    } catch (err) {
      for (const name of savedNames) {
        deleteImageFiles(name);
      }
      throw err;
    }

    const product = buildSellerProduct(db, productId, req.user.id);
    res.status(201).json({ images: product.images, product });
  })
);

router.delete(
  '/seller/products/:id/images/:imageId',
  requireSeller,
  asyncHandler(async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const imageId = parseInt(req.params.imageId, 10);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(imageId) || imageId <= 0) {
      throw new AppError(404, 'IMAGE_NOT_FOUND', 'Image not found.');
    }

    const db = getDb();
    let deletedFilePath = null;

    const deleteTx = db.transaction(() => {
      const product = db
        .prepare(`SELECT id FROM products WHERE id = ? AND seller_id = ?`)
        .get(productId, req.user.id);
      if (!product) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
      }

      const image = db
        .prepare(`SELECT id, file_path FROM product_images WHERE id = ? AND product_id = ?`)
        .get(imageId, productId);
      if (!image) {
        throw new AppError(404, 'IMAGE_NOT_FOUND', 'Image not found.');
      }

      deletedFilePath = image.file_path;
      db.prepare(`DELETE FROM product_images WHERE id = ?`).run(imageId);

      const remaining = db
        .prepare(`SELECT id FROM product_images WHERE product_id = ? ORDER BY position ASC`)
        .all(productId);
      db.prepare(`UPDATE product_images SET position = position + 1000 WHERE product_id = ?`).run(
        productId
      );
      const setPos = db.prepare(`UPDATE product_images SET position = ? WHERE id = ?`);
      remaining.forEach((row, idx) => setPos.run(idx, row.id));
    });

    deleteTx.immediate();
    if (deletedFilePath) {
      deleteImageFiles(deletedFilePath);
    }

    const product = buildSellerProduct(db, productId, req.user.id);
    res.json({ images: product.images, product });
  })
);

router.get(
  '/seller/orders',
  requireSeller,
  asyncHandler(async (req, res) => {
    const db = getDb();
    const statusFilter = String(req.query.status || '').trim();
    const validStatuses = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'];

    const countRows = db
      .prepare(
        `SELECT status, COUNT(*) AS count
         FROM seller_orders
         WHERE seller_id = ?
         GROUP BY status`
      )
      .all(req.user.id);

    const counts = {
      all: 0,
      placed: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const row of countRows) {
      counts[row.status] = row.count;
      counts.all += row.count;
    }

    const where = ['so.seller_id = ?'];
    const params = [req.user.id];
    if (statusFilter && validStatuses.includes(statusFilter)) {
      where.push('so.status = ?');
      params.push(statusFilter);
    }

    const orders = db
      .prepare(
        `SELECT so.id, so.order_id, so.status, so.subtotal_amd, so.updated_at,
                o.recipient, o.phone, o.region, o.city, o.created_at AS order_created_at,
                (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.seller_order_id = so.id) AS item_count
         FROM seller_orders so
         JOIN orders o ON o.id = so.order_id
         WHERE ${where.join(' AND ')}
         ORDER BY o.created_at DESC, so.id DESC`
      )
      .all(...params);

    res.json({ orders, counts });
  })
);

router.get(
  '/seller/orders/:id',
  requireSeller,
  asyncHandler(async (req, res) => {
    const sellerOrderId = parseInt(req.params.id, 10);
    if (!Number.isInteger(sellerOrderId) || sellerOrderId <= 0) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Seller order not found.');
    }

    const db = getDb();
    const order = buildSellerOrderDetail(db, sellerOrderId, req.user.id);
    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Seller order not found.');
    }

    res.json({ order });
  })
);

router.post(
  '/seller/orders/:id/status',
  requireSeller,
  asyncHandler(async (req, res) => {
    const sellerOrderId = parseInt(req.params.id, 10);
    if (!Number.isInteger(sellerOrderId) || sellerOrderId <= 0) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Seller order not found.');
    }

    const toStatus = String(req.body?.to || '').trim();
    if (!toStatus) {
      throw new AppError(400, 'INVALID_STATUS', 'Target status "to" is required.');
    }

    const db = getDb();
    transitionSellerOrderTx(db, {
      sellerOrderId,
      toStatus,
      actorId: req.user.id,
      actorRole: 'seller',
    });

    const order = buildSellerOrderDetail(db, sellerOrderId, req.user.id);
    res.json({ order });
  })
);

export default router;
