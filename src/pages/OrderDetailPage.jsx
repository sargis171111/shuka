import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MapPin, Package, Store } from 'lucide-react';
import { apiRequest, formatAmd, formatDateTime } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusPill from '../components/StatusPill.jsx';
import StarRating from '../components/StarRating.jsx';

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [reviewBusy, setReviewBusy] = useState(null);

  const loadOrder = () => {
    setLoading(true);
    setError('');
    apiRequest(`/orders/${id}`)
      .then((d) => setOrder(d.order))
      .catch((err) => setError(err.message || 'Order not found'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) loadOrder();
  }, [user, id]);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-slate-500">
        Loading order...
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(`/orders/${id}`)}`} replace />;
  }

  const handleCancel = async (sellerOrderId) => {
    setCancellingId(sellerOrderId);
    setError('');
    try {
      const res = await apiRequest(`/orders/${order.id}/sellers/${sellerOrderId}/cancel`, {
        method: 'POST',
      });
      setOrder(res.order);
    } catch (err) {
      setError(err.message || 'Could not cancel shipment.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleReviewSubmit = async (e, productId) => {
    e.preventDefault();
    const draft = reviewDrafts[productId] || { rating: 5, body: '' };
    setReviewBusy(productId);
    setError('');
    try {
      await apiRequest(`/products/${productId}/reviews`, {
        method: 'POST',
        body: {
          rating: Number(draft.rating || 5),
          body: draft.body || '',
        },
      });
      loadOrder();
    } catch (err) {
      setError(err.message || 'Failed to submit review.');
    } finally {
      setReviewBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-slate-500">
        Loading order #{id}...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Order not found</h1>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
        <Link to="/orders" className="mt-5 inline-block text-sm font-semibold text-shuka-600">
          Back to My Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to="/orders"
            className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Orders
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900">Order #{order.id}</h1>
          <p className="text-xs text-slate-500">Placed on {formatDateTime(order.created_at)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-right">
          <p className="text-xs text-slate-500">Order Total (Cash on Delivery)</p>
          <p className="text-xl font-extrabold text-slate-900">{formatAmd(order.total_amd)}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Delivery Address */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
          <MapPin className="h-4 w-4 text-shuka-600" />
          Delivery Address
        </h2>
        <div className="text-sm text-slate-700">
          <p className="font-semibold">
            {order.recipient} • {order.phone}
          </p>
          <p className="mt-0.5 text-slate-600">
            {order.street}
            {order.apartment ? `, ${order.apartment}` : ''}, {order.city}, {order.region}
          </p>
          {order.note && <p className="mt-1 text-xs text-slate-500">Note: {order.note}</p>}
        </div>
      </div>

      {/* Seller Sub-orders */}
      <div className="space-y-5">
        {order.seller_orders.map((so) => (
          <div
            key={so.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <Store className="h-4 w-4 text-shuka-600" />
                <span className="text-sm font-bold text-slate-900">{so.seller_store_name}</span>
                <StatusPill status={so.status} />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-900">
                  {formatAmd(so.subtotal_amd)}
                </span>
                {so.can_cancel && (
                  <button
                    type="button"
                    disabled={cancellingId === so.id}
                    onClick={() => handleCancel(so.id)}
                    className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    {cancellingId === so.id ? 'Cancelling...' : 'Cancel Order'}
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100 p-5">
              {so.items.map((item) => {
                const draft = reviewDrafts[item.product_id] || { rating: 5, body: '' };
                return (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Link
                          to={`/products/${item.product_id}`}
                          className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                        >
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
                        </Link>
                        <div>
                          <Link
                            to={`/products/${item.product_id}`}
                            className="text-sm font-semibold text-slate-900 hover:text-shuka-700"
                          >
                            {item.title}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {item.quantity} × {formatAmd(item.unit_price_amd)}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-slate-900">
                        {formatAmd(item.line_total_amd)}
                      </span>
                    </div>

                    {item.existing_review && (
                      <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">
                        <div className="flex items-center gap-2 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Your Review:
                          <StarRating rating={item.existing_review.rating} />
                        </div>
                        <p className="mt-1 text-emerald-800">{item.existing_review.body}</p>
                      </div>
                    )}

                    {item.can_review && (
                      <form
                        onSubmit={(e) => handleReviewSubmit(e, item.product_id)}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800">
                            Write a review for this delivered item
                          </span>
                          <select
                            value={draft.rating}
                            onChange={(e) =>
                              setReviewDrafts((prev) => ({
                                ...prev,
                                [item.product_id]: { ...draft, rating: Number(e.target.value) },
                              }))
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium"
                          >
                            <option value={5}>5 Stars — Excellent</option>
                            <option value={4}>4 Stars — Good</option>
                            <option value={3}>3 Stars — Average</option>
                            <option value={2}>2 Stars — Poor</option>
                            <option value={1}>1 Star — Terrible</option>
                          </select>
                        </div>
                        <textarea
                          rows={2}
                          required
                          minLength={3}
                          placeholder="Share your experience with the product quality and delivery..."
                          value={draft.body}
                          onChange={(e) =>
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [item.product_id]: { ...draft, body: e.target.value },
                            }))
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-shuka-500"
                        />
                        <button
                          type="submit"
                          disabled={reviewBusy === item.product_id}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          {reviewBusy === item.product_id ? 'Submitting...' : 'Submit Review'}
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Status History Timeline */}
            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3.5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Status History
              </p>
              <div className="space-y-1.5">
                {so.status_history.map((h) => (
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
          </div>
        ))}
      </div>
    </div>
  );
}
