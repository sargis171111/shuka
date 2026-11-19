import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Banknote, Lock, Store } from 'lucide-react';
import { ARMENIA_REGIONS, apiRequest, formatAmd } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

function makeRequestKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function CheckoutPage() {
  const { user, lastAddress, loading: authLoading } = useAuth();
  const { cart, refreshCart, clearLocalCart } = useCart();
  const navigate = useNavigate();

  const requestKeyRef = useRef(makeRequestKey());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    recipient: '',
    phone: '',
    region: 'Yerevan',
    city: '',
    street: '',
    apartment: '',
    note: '',
  });
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (!user || prefilled) return;
    setForm({
      recipient: lastAddress?.recipient || user.name || '',
      phone: lastAddress?.phone || user.phone || '',
      region: lastAddress?.region || 'Yerevan',
      city: lastAddress?.city || 'Yerevan',
      street: lastAddress?.street || '',
      apartment: lastAddress?.apartment || '',
      note: lastAddress?.note || '',
    });
    setPrefilled(true);
  }, [user, lastAddress, prefilled]);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-slate-500">
        Loading checkout...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login?next=/checkout" replace />;
  }

  if (cart.sellers.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await apiRequest('/orders', {
        method: 'POST',
        body: {
          ...form,
          request_key: requestKeyRef.current,
        },
      });
      clearLocalCart();
      navigate(`/orders/${res.order.id}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not place order.');
      if (err.code === 'PRICE_CHANGED' || err.code === 'OUT_OF_STOCK') {
        await refreshCart().catch(() => {});
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-extrabold text-slate-900">Checkout</h1>

      {error && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{error}</span>
          <Link to="/cart" className="font-bold underline">
            Return to Cart
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-900">Delivery Details</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Recipient Full Name *
              </label>
              <input
                type="text"
                required
                value={form.recipient}
                onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Phone Number *
              </label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+374 99 000000"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Region (Marz) *
              </label>
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
              >
                {ARMENIA_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                City / Village *
              </label>
              <input
                type="text"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Yerevan, Gyumri, Dilijan..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Street &amp; Building *
              </label>
              <input
                type="text"
                required
                value={form.street}
                onChange={(e) => setForm({ ...form, street: e.target.value })}
                placeholder="Abovyan St 22"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Apartment / Entrance
              </label>
              <input
                type="text"
                value={form.apartment}
                onChange={(e) => setForm({ ...form, apartment: e.target.value })}
                placeholder="Apt 14"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Delivery Note (Optional)
            </label>
            <textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Intercom code, preferred delivery time..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
            />
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <Banknote className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <strong>Payment: Cash on delivery</strong> — pay in AMD directly to the courier when your items arrive.
            </div>
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">Items by Seller</h2>

          <div className="space-y-4 divide-y divide-slate-100">
            {cart.sellers.map((group) => (
              <div key={group.seller_id} className="pt-3 first:pt-0">
                <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Store className="h-3.5 w-3.5 text-shuka-600" />
                    {group.store_name}
                  </span>
                  <span>{formatAmd(group.subtotal_amd)}</span>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {group.items.map((item) => (
                    <li key={item.product_id} className="flex justify-between gap-2 text-slate-700">
                      <span className="truncate">
                        {item.quantity} × {item.title}
                      </span>
                      <span className="shrink-0 font-medium">
                        {formatAmd(item.line_total_amd)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between text-lg font-extrabold text-slate-900">
              <span>Total</span>
              <span>{formatAmd(cart.grand_total_amd)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-shuka-500 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-shuka-600 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <Lock className="h-4 w-4" />
            {submitting ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
