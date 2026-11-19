import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Banknote, MapPin, Package } from 'lucide-react';
import { apiRequest, formatAmd, formatDateTime } from '../../lib/api.js';
import SellerLayout from '../../components/SellerLayout.jsx';
import StatusPill from '../../components/StatusPill.jsx';

const ACTION_META = {
  confirmed: {
    label: 'Confirm Order',
    cls: 'bg-sky-600 text-white hover:bg-sky-700',
  },
  shipped: {
    label: 'Mark as Shipped',
    cls: 'bg-indigo-600 text-white hover:bg-indigo-700',
  },
  delivered: {
    label: 'Mark as Delivered',
    cls: 'bg-emerald-600 text-white hover:bg-emerald-700',
  },
  cancelled: {
    label: 'Cancel Order',
    cls: 'border border-rose-300 bg-white text-rose-600 hover:bg-rose-50',
  },
};

export default function SellerOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    apiRequest(`/seller/orders/${id}`)
      .then((d) => setOrder(d.order))
      .catch((err) => setError(err.message || 'Order not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleTransition = async (to) => {
    setBusy(true);
    setError('');
    try {
      const res = await apiRequest(`/seller/orders/${id}/status`, {
        method: 'POST',
        body: { to },
      });
      setOrder(res.order);
    } catch (err) {
      setError(err.message || 'Could not update status.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SellerLayout>
      <div className="space-y-6">
        <Link
          to="/seller/orders"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Seller Orders
        </Link>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading order details...</p>
        ) : !order ? (
          <p className="text-sm text-slate-500">Seller order not found.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-extrabold text-slate-900">
                    Shipment #{order.id} (Order #{order.order_id})
                  </h2>
                  <StatusPill status={order.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Placed {formatDateTime(order.order_created_at)}
                </p>
              </div>

              {order.allowed_transitions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {order.allowed_transitions.map((to) => {
                    const meta = ACTION_META[to] || {
                      label: to,
                      cls: 'bg-slate-900 text-white',
                    };
                    return (
                      <button
                        key={to}
                        type="button"
                        disabled={busy}
                        onClick={() => handleTransition(to)}
                        className={`rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${meta.cls}`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <MapPin className="h-4 w-4 text-shuka-600" />
                  Recipient &amp; Delivery Address
                </h3>
                <p className="text-sm font-semibold text-slate-900">{order.recipient}</p>
                <p className="text-sm text-slate-700">{order.phone}</p>
                <p className="text-sm text-slate-600">
                  {order.street}
                  {order.apartment ? `, ${order.apartment}` : ''}, {order.city}, {order.region}
                </p>
                {order.note && (
                  <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
                    Note: {order.note}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                  Cash to Collect on Delivery
                </h3>
                <p className="text-3xl font-extrabold text-slate-900">
                  {formatAmd(order.subtotal_amd)}
                </p>
                <p className="text-xs text-slate-500">
                  {order.status === 'cancelled'
                    ? 'Order cancelled — stock has been restored.'
                    : 'Collect this exact AMD subtotal from the buyer upon delivery.'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-bold text-slate-900">
                Items at Purchase Snapshot Price
              </h3>
              <div className="divide-y divide-slate-100">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {item.thumb_url ? (
                          <img
                            src={item.thumb_url}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-300">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500">
                          {item.quantity} × {formatAmd(item.unit_price_amd)}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-900">
                      {formatAmd(item.line_total_amd)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-bold text-slate-900">Status History</h3>
              <div className="space-y-2">
                {order.status_history.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"
                  >
                    <span>
                      {h.from_status ? `${h.from_status} → ` : ''}
                      <strong className="capitalize text-slate-900">{h.to_status}</strong> by{' '}
                      {h.changed_by_name}
                    </span>
                    <span className="text-slate-400">{formatDateTime(h.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </SellerLayout>
  );
}
