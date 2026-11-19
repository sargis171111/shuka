import express from 'express';
import { ARMENIA_REGIONS } from '../config.js';
import { getDb } from '../db/connection.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { requireAuth } from '../lib/auth.js';
import { getAllowedTransitions, transitionSellerOrderTx } from '../lib/stateMachine.js';

const router = express.Router();

function buildBuyerOrderDetail(db, orderId, buyerId) {
  const order = db
    .prepare(
      `SELECT id, buyer_id, recipient, phone, region, city, street, apartment, note,
              total_amd, request_key, created_at
       FROM orders
       WHERE id = ? AND buyer_id = ?`
    )
    .get(orderId, buyerId);

  if (!order) return null;

  const sellerOrders = db
    .prepare(
      `SELECT so.id, so.order_id, so.seller_id, so.status, so.subtotal_amd, so.updated_at,
              u.store_name AS seller_store_name
       FROM seller_orders so
       JOIN users u ON u.id = so.seller_id
       WHERE so.order_id = ?
       ORDER BY so.id ASC`
    )
    .all(order.id);

  const itemsStmt = db.prepare(
    `SELECT oi.id, oi.seller_order_id, oi.product_id, oi.title, oi.unit_price_amd, oi.quantity,
            (
              SELECT pi.file_path
              FROM product_images pi
              WHERE pi.product_id = oi.product_id
              ORDER BY pi.position ASC
              LIMIT 1
            ) AS primary_image,
            r.id AS review_id, r.rating AS review_rating, r.body AS review_body, r.created_at AS review_created_at
     FROM order_items oi
     LEFT JOIN reviews r ON r.product_id = oi.product_id AND r.buyer_id = ?
     WHERE oi.seller_order_id = ?
     ORDER BY oi.id ASC`
  );

  const historyStmt = db.prepare(
    `SELECT sh.id, sh.seller_order_id, sh.from_status, sh.to_status, sh.changed_by, sh.created_at,
            u.name AS changed_by_name
     FROM status_history sh
     JOIN users u ON u.id = sh.changed_by
     WHERE sh.seller_order_id = ?
     ORDER BY sh.id ASC`
  );

  const detailedSellerOrders = sellerOrders.map((so) => {
    const items = itemsStmt.all(buyerId, so.id).map((it) => ({
      id: it.id,
      product_id: it.product_id,
      title: it.title,
      unit_price_amd: it.unit_price_amd,
      quantity: it.quantity,
      line_total_amd: it.unit_price_amd * it.quantity,
      thumb_url: it.primary_image
        ? `/uploads/${it.primary_image.replace('-large.', '-thumb.')}`
        : null,
      can_review: so.status === 'delivered' && !it.review_id,
      existing_review: it.review_id
        ? {
            id: it.review_id,
            rating: it.review_rating,
            body: it.review_body,
            created_at: it.review_created_at,
          }
        : null,
    }));

    return {
      ...so,
      can_cancel: getAllowedTransitions(so.status, 'buyer').includes('cancelled'),
      items,
      status_history: historyStmt.all(so.id),
    };
  });

  return {
    ...order,
    seller_orders: detailedSellerOrders,
  };
}

router.post(
  '/orders',
  requireAuth,
  asyncHandler(async (req, res) => {
    const requestKey = String(req.body?.request_key || '').trim();
    const recipient = String(req.body?.recipient || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const region = String(req.body?.region || '').trim();
    const city = String(req.body?.city || '').trim();
    const street = String(req.body?.street || '').trim();
    const apartment = req.body?.apartment ? String(req.body.apartment).trim() : null;
    const note = req.body?.note ? String(req.body.note).trim() : null;

    if (!requestKey || requestKey.length > 128) {
      throw new AppError(400, 'INVALID_REQUEST_KEY', 'A valid checkout request_key is required.');
    }
    if (recipient.length < 2 || recipient.length > 100) {
      throw new AppError(400, 'INVALID_RECIPIENT', 'Recipient name is required.');
    }
    if (phone.length < 6 || phone.length > 30) {
      throw new AppError(400, 'INVALID_PHONE', 'Valid delivery phone number is required.');
    }
    if (!ARMENIA_REGIONS.includes(region)) {
      throw new AppError(400, 'INVALID_REGION', 'Please select a valid region.');
    }
    if (city.length < 2 || city.length > 80) {
      throw new AppError(400, 'INVALID_CITY', 'City or village is required.');
    }
    if (street.length < 2 || street.length > 150) {
      throw new AppError(400, 'INVALID_STREET', 'Street address is required.');
    }

    const db = getDb();

    const checkoutTx = db.transaction(() => {
      // 1. Idempotency check
      const existingOrder = db
        .prepare(`SELECT id, buyer_id FROM orders WHERE request_key = ?`)
        .get(requestKey);

      if (existingOrder) {
        if (existingOrder.buyer_id !== req.user.id) {
          throw new AppError(409, 'REQUEST_KEY_CONFLICT', 'Order request key already used.');
        }
        return { existing: true, orderId: existingOrder.id };
      }

      // 2. Load cart items + current product state
      const cartRows = db
        .prepare(
          `SELECT ci.product_id, ci.quantity, ci.price_when_added,
                  p.seller_id, p.title, p.price_amd AS current_price_amd, p.stock, p.is_published
           FROM cart_items ci
           JOIN products p ON p.id = ci.product_id
           WHERE ci.user_id = ?
           ORDER BY ci.product_id ASC`
        )
        .all(req.user.id);

      if (cartRows.length === 0) {
        throw new AppError(400, 'EMPTY_CART', 'Your cart is empty.');
      }

      // 3. Ownership and publish check
      for (const row of cartRows) {
        if (row.seller_id === req.user.id) {
          throw new AppError(403, 'OWN_PRODUCT', `You cannot buy your own product "${row.title}".`);
        }
        if (row.is_published !== 1) {
          throw new AppError(
            409,
            'PRODUCT_UNAVAILABLE',
            `"${row.title}" is no longer available for purchase.`
          );
        }
      }

      // 4. Price-change guard
      const changedItems = cartRows
        .filter((row) => row.price_when_added !== row.current_price_amd)
        .map((row) => ({
          product_id: row.product_id,
          title: row.title,
          old_price_amd: row.price_when_added,
          new_price_amd: row.current_price_amd,
        }));

      if (changedItems.length > 0) {
        const first = changedItems[0];
        throw new AppError(
          409,
          'PRICE_CHANGED',
          `Price changed for "${first.title}" (now ${first.new_price_amd} AMD). Review your cart before placing the order.`,
          { changed_items: changedItems }
        );
      }

      // 5. Atomic stock deduction (plain SQL, rolls back whole order on failure)
      const now = new Date().toISOString();
      const deductStmt = db.prepare(
        `UPDATE products
         SET stock = stock - ?, updated_at = ?
         WHERE id = ? AND stock >= ? AND is_published = 1`
      );

      for (const row of cartRows) {
        const result = deductStmt.run(row.quantity, now, row.product_id, row.quantity);
        if (result.changes !== 1) {
          throw new AppError(
            409,
            'OUT_OF_STOCK',
            `Insufficient stock for "${row.title}".`,
            { product_id: row.product_id, title: row.title }
          );
        }
      }

      // 6. Multi-seller split: 1 orders row + 1 seller_orders row per distinct seller
      const totalAmd = cartRows.reduce(
        (sum, row) => sum + row.current_price_amd * row.quantity,
        0
      );

      const orderInsert = db
        .prepare(
          `INSERT INTO orders (
             buyer_id, recipient, phone, region, city, street, apartment, note,
             total_amd, request_key, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          req.user.id,
          recipient,
          phone,
          region,
          city,
          street,
          apartment,
          note,
          totalAmd,
          requestKey,
          now
        );

      const orderId = Number(orderInsert.lastInsertRowid);

      const sellerGroups = new Map();
      for (const row of cartRows) {
        if (!sellerGroups.has(row.seller_id)) {
          sellerGroups.set(row.seller_id, []);
        }
        sellerGroups.get(row.seller_id).push(row);
      }

      const insertSellerOrder = db.prepare(
        `INSERT INTO seller_orders (order_id, seller_id, status, subtotal_amd, updated_at)
         VALUES (?, ?, 'placed', ?, ?)`
      );
      const insertHistory = db.prepare(
        `INSERT INTO status_history (seller_order_id, from_status, to_status, changed_by, created_at)
         VALUES (?, NULL, 'placed', ?, ?)`
      );
      const insertOrderItem = db.prepare(
        `INSERT INTO order_items (seller_order_id, product_id, title, unit_price_amd, quantity)
         VALUES (?, ?, ?, ?, ?)`
      );

      for (const [sellerId, items] of sellerGroups.entries()) {
        const subtotalAmd = items.reduce(
          (sum, it) => sum + it.current_price_amd * it.quantity,
          0
        );
        const soRes = insertSellerOrder.run(orderId, sellerId, subtotalAmd, now);
        const sellerOrderId = Number(soRes.lastInsertRowid);

        insertHistory.run(sellerOrderId, req.user.id, now);

        for (const it of items) {
          insertOrderItem.run(
            sellerOrderId,
            it.product_id,
            it.title,
            it.current_price_amd,
            it.quantity
          );
        }
      }

      // 7. Clear buyer's cart
      db.prepare(`DELETE FROM cart_items WHERE user_id = ?`).run(req.user.id);

      return { existing: false, orderId };
    });

    const outcome = checkoutTx.immediate();
    const order = buildBuyerOrderDetail(db, outcome.orderId, req.user.id);
    res.status(outcome.existing ? 200 : 201).json({ order });
  })
);

router.get(
  '/orders',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = getDb();
    const orders = db
      .prepare(
        `SELECT o.id, o.recipient, o.region, o.city, o.total_amd, o.created_at
         FROM orders o
         WHERE o.buyer_id = ?
         ORDER BY o.id DESC`
      )
      .all(req.user.id);

    const sellerOrdersStmt = db.prepare(
      `SELECT so.id, so.seller_id, so.status, so.subtotal_amd, u.store_name AS seller_store_name,
              (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.seller_order_id = so.id) AS item_count
       FROM seller_orders so
       JOIN users u ON u.id = so.seller_id
       WHERE so.order_id = ?
       ORDER BY so.id ASC`
    );

    const enriched = orders.map((o) => ({
      ...o,
      seller_orders: sellerOrdersStmt.all(o.id),
    }));

    res.json({ orders: enriched });
  })
);

router.get(
  '/orders/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }

    const db = getDb();
    const order = buildBuyerOrderDetail(db, orderId, req.user.id);
    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }

    res.json({ order });
  })
);

router.post(
  '/orders/:id/sellers/:sellerOrderId/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const sellerOrderId = parseInt(req.params.sellerOrderId, 10);
    if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(sellerOrderId) || sellerOrderId <= 0) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }

    const db = getDb();
    transitionSellerOrderTx(db, {
      sellerOrderId,
      orderId,
      toStatus: 'cancelled',
      actorId: req.user.id,
      actorRole: 'buyer',
    });

    const order = buildBuyerOrderDetail(db, orderId, req.user.id);
    res.json({ order });
  })
);

router.post(
  '/products/:id/reviews',
  requireAuth,
  asyncHandler(async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }

    const rating = Number(req.body?.rating);
    const body = String(req.body?.body || '').trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new AppError(400, 'INVALID_RATING', 'Rating must be an integer between 1 and 5.');
    }
    if (body.length < 3 || body.length > 2000) {
      throw new AppError(400, 'INVALID_REVIEW_BODY', 'Review text must be between 3 and 2000 characters.');
    }

    const db = getDb();

    const createReviewTx = db.transaction(() => {
      const product = db.prepare(`SELECT id FROM products WHERE id = ?`).get(productId);
      if (!product) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
      }

      const deliveredPurchase = db
        .prepare(
          `SELECT oi.id
           FROM order_items oi
           JOIN seller_orders so ON so.id = oi.seller_order_id
           JOIN orders o ON o.id = so.order_id
           WHERE o.buyer_id = ? AND oi.product_id = ? AND so.status = 'delivered'
           LIMIT 1`
        )
        .get(req.user.id, productId);

      if (!deliveredPurchase) {
        throw new AppError(
          403,
          'REVIEW_NOT_ELIGIBLE',
          'You can only review products from orders that have been delivered to you.'
        );
      }

      const existing = db
        .prepare(`SELECT id FROM reviews WHERE product_id = ? AND buyer_id = ?`)
        .get(productId, req.user.id);

      if (existing) {
        throw new AppError(409, 'ALREADY_REVIEWED', 'You have already reviewed this product.');
      }

      const now = new Date().toISOString();
      const insertRes = db
        .prepare(
          `INSERT INTO reviews (product_id, buyer_id, rating, body, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(productId, req.user.id, rating, body, now);

      const stats = db
        .prepare(
          `SELECT COUNT(*) AS cnt, COALESCE(AVG(rating), 0) AS avg_rating
           FROM reviews WHERE product_id = ?`
        )
        .get(productId);

      const ratingAvg = Number(stats.avg_rating.toFixed(2));
      const ratingCount = stats.cnt;

      db.prepare(`UPDATE products SET rating_avg = ?, rating_count = ? WHERE id = ?`).run(
        ratingAvg,
        ratingCount,
        productId
      );

      const review = db
        .prepare(
          `SELECT r.id, r.product_id, r.buyer_id, r.rating, r.body, r.created_at,
                  u.name AS buyer_name
           FROM reviews r
           JOIN users u ON u.id = r.buyer_id
           WHERE r.id = ?`
        )
        .get(Number(insertRes.lastInsertRowid));

      return { review, rating_avg: ratingAvg, rating_count: ratingCount };
    });

    const result = createReviewTx.immediate();
    res.status(201).json(result);
  })
);

export default router;
