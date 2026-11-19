import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronRight, Package } from 'lucide-react';
import { apiRequest, formatAmd, formatDate } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusPill from '../components/StatusPill.jsx';

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    apiRequest('/orders')
      .then((d) => setOrders(d.orders || []))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-slate-500">
        Loading orders...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login?next=/orders" replace />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-extrabold text-slate-900">My Orders</h1>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Package className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">No orders yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            When you place an order on Shuka, you can track its status here.
          </p>
          <Link
            to="/search"
            className="mt-5 inline-block rounded-xl bg-shuka-500 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-shuka-400 hover:shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-sm font-bold text-slate-900">Order #{order.id}</span>
                  <span className="ml-3 text-xs text-slate-500">
                    {formatDate(order.created_at)} • {order.region}, {order.city}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-extrabold text-slate-900">
                    {formatAmd(order.total_amd)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-3">
                {order.seller_orders.map((so) => (
                  <div
                    key={so.id}
                    className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 text-xs"
                  >
                    <span className="font-semibold text-slate-700">{so.seller_store_name}</span>
                    <span className="text-slate-400">({so.item_count})</span>
                    <StatusPill status={so.status} />
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
