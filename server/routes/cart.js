import express from 'express';
import { getDb } from '../db/connection.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { requireAuth } from '../lib/auth.js';

const router = express.Router();

export function buildCartResponse(db, userId) {
  const rows = db
    .prepare(
      `SELECT ci.product_id, ci.quantity, ci.price_when_added,
              p.title, p.price_amd AS current_price_amd, p.stock, p.is_published,
              p.seller_id, u.store_name AS seller_store_name,
              (
                SELECT pi.file_path
                FROM product_images pi
                WHERE pi.product_id = p.id
                ORDER BY pi.position ASC
                LIMIT 1
              ) AS primary_image
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN users u ON u.id = p.seller_id
       WHERE ci.user_id = ?
       ORDER BY u.id ASC, ci.product_id ASC`
    )
    .all(userId);

  const sellerMap = new Map();
  let grandTotalAmd = 0;
  let totalItems = 0;
  let hasPriceChanges = false;
  let hasStockIssues = false;

  for (const r of rows) {
    const priceChanged = r.price_when_added !== r.current_price_amd;
    const outOfStock = r.is_published !== 1 || r.stock === 0 || r.quantity > r.stock;
    if (priceChanged) hasPriceChanges = true;
    if (outOfStock) hasStockIssues = true;

    const lineTotalAmd = r.current_price_amd * r.quantity;
    grandTotalAmd += lineTotalAmd;
    totalItems += r.quantity;

    if (!sellerMap.has(r.seller_id)) {
      sellerMap.set(r.seller_id, {
        seller_id: r.seller_id,
        store_name: r.seller_store_name || 'Local Seller',
        subtotal_amd: 0,
        items: [],
      });
    }

    const group = sellerMap.get(r.seller_id);
    group.subtotal_amd += lineTotalAmd;
    group.items.push({
      product_id: r.product_id,
      title: r.title,
      quantity: r.quantity,
      price_when_added: r.price_when_added,
      current_price_amd: r.current_price_amd,
      line_total_amd: lineTotalAmd,
      stock: r.stock,
      is_published: r.is_published,
      price_changed: priceChanged,
      out_of_stock: outOfStock,
      thumb_url: r.primary_image
        ? `/uploads/${r.primary_image.replace('-large.', '-thumb.')}`
        : null,
    });
  }

  return {
    sellers: Array.from(sellerMap.values()),
    grand_total_amd: grandTotalAmd,
    total_items: totalItems,
    has_price_changes: hasPriceChanges,
    has_stock_issues: hasStockIssues,
  };
}

router.get(
  '/cart',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = getDb();
    res.json(buildCartResponse(db, req.user.id));
  })
);

router.put(
  '/cart/items/:productId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const productId = parseInt(req.params.productId, 10);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }

    const quantity = Number(req.body?.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError(400, 'INVALID_QUANTITY', 'Quantity must be a positive integer.');
    }

    const acceptPrice = req.body?.accept_price === true;
    const db = getDb();

    const product = db
      .prepare(
        `SELECT id, seller_id, title, price_amd, stock, is_published
         FROM products WHERE id = ?`
      )
      .get(productId);

    if (!product || product.is_published !== 1) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found or unavailable.');
    }

    if (product.seller_id === req.user.id) {
      throw new AppError(403, 'OWN_PRODUCT', 'Sellers cannot add their own products to cart.');
    }

    if (product.stock <= 0 || quantity > product.stock) {
      throw new AppError(
        409,
        'INSUFFICIENT_STOCK',
        `Only ${product.stock} unit(s) of "${product.title}" available in stock.`,
        { available_stock: product.stock }
      );
    }

    const existing = db
      .prepare(`SELECT quantity, price_when_added FROM cart_items WHERE user_id = ? AND product_id = ?`)
      .get(req.user.id, productId);

    if (!existing) {
      db.prepare(
        `INSERT INTO cart_items (user_id, product_id, quantity, price_when_added)
         VALUES (?, ?, ?, ?)`
      ).run(req.user.id, productId, quantity, product.price_amd);
    } else if (acceptPrice) {
      db.prepare(
        `UPDATE cart_items SET quantity = ?, price_when_added = ? WHERE user_id = ? AND product_id = ?`
      ).run(quantity, product.price_amd, req.user.id, productId);
    } else {
      db.prepare(
        `UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?`
      ).run(quantity, req.user.id, productId);
    }

    res.json(buildCartResponse(db, req.user.id));
  })
);

router.delete(
  '/cart/items/:productId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const productId = parseInt(req.params.productId, 10);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }

    const db = getDb();
    db.prepare(`DELETE FROM cart_items WHERE user_id = ? AND product_id = ?`).run(
      req.user.id,
      productId
    );
    res.json(buildCartResponse(db, req.user.id));
  })
);

export default router;
