import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, Box, Clock, Truck } from 'lucide-react';
import { apiRequest, formatAmd } from '../../lib/api.js';
import SellerLayout from '../../components/SellerLayout.jsx';

export default function SellerOverviewPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/seller/overview')
      .then((d) => setStats(d))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SellerLayout>
      {loading || !stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link
              to="/seller/orders?status=placed"
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-amber-400"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Orders to Confirm
                </span>
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <p className="mt-3 text-3xl font-extrabold text-slate-900">{stats.placed_count}</p>
              <p className="mt-1 text-xs text-slate-500">Placed orders waiting for confirmation</p>
            </Link>

            <Link
              to="/seller/orders?status=confirmed"
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-sky-400"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ready to Ship
                </span>
                <Truck className="h-5 w-5 text-sky-500" />
              </div>
              <p className="mt-3 text-3xl font-extrabold text-slate-900">{stats.confirmed_count}</p>
              <p className="mt-1 text-xs text-slate-500">Confirmed orders awaiting dispatch</p>
            </Link>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  30-Day Delivered Revenue
                </span>
                <Banknote className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="mt-3 text-3xl font-extrabold text-slate-900">
                {formatAmd(stats.revenue_30d_amd)}
              </p>
              <p className="mt-1 text-xs text-slate-500">From delivered orders in last 30 days</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <Box className="h-5 w-5 text-slate-500" />
              <div className="text-sm text-slate-700">
                You have <strong>{stats.published_products}</strong> published listings out of{' '}
                <strong>{stats.total_products}</strong> total products.
              </div>
            </div>
            <Link
              to="/seller/products"
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Manage Catalog
            </Link>
          </div>
        </div>
      )}
    </SellerLayout>
  );
}
