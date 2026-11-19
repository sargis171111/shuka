import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, Minus, Package, Plus, ShoppingCart, Store, Trash2 } from 'lucide-react';
import { formatAmd } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const { cart, setItemQuantity, removeItem } = useCart();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  if (authLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-slate-500">
        Loading cart...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login?next=/cart" replace />;
  }

  const handleQty = async (productId, nextQty, acceptPrice = false) => {
    setBusyId(productId);
    setError('');
    try {
      await setItemQuantity(productId, nextQty, { accept_price: acceptPrice });
    } catch (err) {
      setError(err.message || 'Could not update cart');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (productId) => {
    setBusyId(productId);
    setError('');
    try {
      await removeItem(productId);
    } catch (err) {
      setError(err.message || 'Could not remove item');
    } finally {
      setBusyId(null);
    }
  };

  if (cart.sellers.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <ShoppingCart className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Your cart is empty</h1>
        <p className="mt-2 text-sm text-slate-500">
          Browse local stores across Armenia and add items to get started.
        </p>
        <Link
          to="/search"
          className="mt-6 inline-block rounded-xl bg-shuka-500 px-6 py-3 text-sm font-bold text-white hover:bg-shuka-600"
        >
          Explore Products
        </Link>
      </div>
    );
  }

  const blockedCheckout = cart.has_price_changes || cart.has_stock_issues;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-extrabold text-slate-900">
        Shopping Cart ({cart.total_items} {cart.total_items === 1 ? 'item' : 'items'})
      </h1>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {cart.has_price_changes && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <strong>Some prices changed</strong> since you added items to your cart. Accept the updated price on highlighted items before checking out.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {cart.sellers.map((group) => (
            <div
              key={group.seller_id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Store className="h-4 w-4 text-shuka-600" />
                  {group.store_name}
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  Subtotal: {formatAmd(group.subtotal_amd)}
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {group.items.map((item) => (
                  <div key={item.product_id} className="p-4 sm:p-5 space-y-3">
                    <div className="flex gap-4">
                      <Link
                        to={`/products/${item.product_id}`}
                        className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                      >
                        {item.thumb_url ? (
                          <img
                            src={item.thumb_url}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-300">
                            <Package className="h-6 w-6" />
                          </div>
                        )}
                      </Link>

                      <div className="flex flex-1 flex-col justify-between">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <Link
                            to={`/products/${item.product_id}`}
                            className="text-sm font-semibold text-slate-900 hover:text-shuka-700"
                          >
                            {item.title}
                          </Link>
                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-900">
                              {formatAmd(item.line_total_amd)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatAmd(item.current_price_amd)} each
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="inline-flex items-center rounded-xl border border-slate-300">
                            <button
                              type="button"
                              disabled={busyId === item.product_id || item.quantity <= 1}
                              onClick={() => handleQty(item.product_id, item.quantity - 1)}
                              className="p-1.5 text-slate-600 disabled:opacity-40"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-8 text-center text-xs font-semibold">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={busyId === item.product_id || item.quantity >= item.stock}
                              onClick={() => handleQty(item.product_id, item.quantity + 1)}
                              className="p-1.5 text-slate-600 disabled:opacity-40"
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={busyId === item.product_id}
                            onClick={() => handleRemove(item.product_id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>

                    {item.price_changed && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                        <span>
                          Price changed from <strong>{formatAmd(item.price_when_added)}</strong> to{' '}
                          <strong>{formatAmd(item.current_price_amd)}</strong>.
                        </span>
                        <button
                          type="button"
                          disabled={busyId === item.product_id}
                          onClick={() => handleQty(item.product_id, item.quantity, true)}
                          className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700"
                        >
                          Accept new price
                        </button>
                      </div>
                    )}

                    {item.out_of_stock && (
                      <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
                        {item.is_published !== 1
                          ? 'This product is no longer published. Remove it to continue.'
                          : item.stock === 0
                          ? 'Out of stock. Remove this item to continue.'
                          : `Only ${item.stock} unit(s) available. Reduce quantity to continue.`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Order Summary</h2>
          <div className="space-y-2 border-b border-slate-100 pb-4 text-sm">
            {cart.sellers.map((g) => (
              <div key={g.seller_id} className="flex justify-between text-slate-600">
                <span className="truncate pr-2">{g.store_name}</span>
                <span className="font-medium text-slate-900">{formatAmd(g.subtotal_amd)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-base font-extrabold text-slate-900">
            <span>Grand Total</span>
            <span>{formatAmd(cart.grand_total_amd)}</span>
          </div>
          <p className="text-xs text-slate-500">Payment method: Cash on delivery</p>

          <button
            type="button"
            disabled={blockedCheckout}
            onClick={() => navigate('/checkout')}
            className="w-full rounded-xl bg-shuka-500 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-shuka-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {blockedCheckout ? 'Resolve cart notices first' : 'Proceed to Checkout'}
          </button>
        </div>
      </div>
    </div>
  );
}
