import { AppError } from './errors.js';

export const ALLOWED_TRANSITIONS = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function getAllowedTransitions(status, role = 'seller') {
  if (role === 'buyer') {
    return status === 'placed' || status === 'confirmed' ? ['cancelled'] : [];
  }
  return ALLOWED_TRANSITIONS[status] ? [...ALLOWED_TRANSITIONS[status]] : [];
}

export function transitionSellerOrderTx(db, { sellerOrderId, toStatus, actorId, actorRole, orderId }) {
  const tx = db.transaction(() => {
    const so = db
      .prepare(
        `SELECT so.id, so.order_id, so.seller_id, so.status, o.buyer_id
         FROM seller_orders so
         JOIN orders o ON o.id = so.order_id
         WHERE so.id = ?`
      )
      .get(sellerOrderId);

    if (!so) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }

    if (actorRole === 'buyer') {
      if (so.buyer_id !== actorId || (orderId && so.order_id !== orderId)) {
        throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
      }
      if (toStatus !== 'cancelled') {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'Buyers can only cancel orders.');
      }
    } else if (actorRole === 'seller') {
      if (so.seller_id !== actorId) {
        throw new AppError(404, 'ORDER_NOT_FOUND', 'Seller order not found.');
      }
    } else {
      throw new AppError(403, 'FORBIDDEN', 'Invalid role for order status change.');
    }

    const allowed = getAllowedTransitions(so.status, actorRole);
    if (!allowed.includes(toStatus)) {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Cannot transition order from '${so.status}' to '${toStatus}'.`
      );
    }

    const now = new Date().toISOString();

    db.prepare(
      `UPDATE seller_orders SET status = ?, updated_at = ? WHERE id = ?`
    ).run(toStatus, now, so.id);

    db.prepare(
      `INSERT INTO status_history (seller_order_id, from_status, to_status, changed_by, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(so.id, so.status, toStatus, actorId, now);

    if (toStatus === 'cancelled') {
      const items = db
        .prepare(
          `SELECT product_id, quantity FROM order_items WHERE seller_order_id = ?`
        )
        .all(so.id);

      const restoreStock = db.prepare(
        `UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?`
      );
      for (const item of items) {
        restoreStock.run(item.quantity, now, item.product_id);
      }
    }

    return {
      sellerOrderId: so.id,
      orderId: so.order_id,
      fromStatus: so.status,
      toStatus,
      updatedAt: now,
    };
  });

  return tx.immediate();
}
