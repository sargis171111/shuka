import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, ClipboardList } from 'lucide-react';
import { apiRequest, formatAmd, formatDateTime } from '../../lib/api.js';
import SellerLayout from '../../components/SellerLayout.jsx';
import StatusPill from '../../components/StatusPill.jsx';

const TABS = [
  { key: '', label: 'All' },
  { key: 'placed', label: 'Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function SellerOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeStatus = searchParams.get('status') || '';

  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({ all: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = activeStatus ? `?status=${encodeURIComponent(activeStatus)}` : '';
    apiRequest(`/seller/orders${qs}`)
      .then((d) => {
        setOrders(d.orders || []);
        setCounts(d.counts || { all: 0 });
      })
      .finally(() => setLoading(false));
  }, [activeStatus]);

  return (
    <SellerLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const count = t.key ? counts[t.key] || 0 : counts.all || 0;
            const selected = activeStatus === t.key;
            return (
              <button
                key={t.key || 'all'}
                type="button"
                onClick={() => {
                  if (t.key) setSearchParams({ status: t.key });
                  else setSearchParams({});
                }}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                  selected
                    ? 'bg-shuka-500 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {t.label} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-900">No orders in this status</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((so) => (
              <Link
                key={so.id}
                to={`/seller/orders/${so.id}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-shuka-400"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold text-slate-900">
                      Shipment #{so.id} (Order #{so.order_id})
                    </span>
                    <StatusPill status={so.status} />
                  </div>
                  <p className="text-xs text-slate-500">
                    {so.recipient} • {so.region}, {so.city} • {so.item_count} item(s) •{' '}
                    {formatDateTime(so.order_created_at)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-base font-extrabold text-slate-900">
                    {formatAmd(so.subtotal_amd)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
