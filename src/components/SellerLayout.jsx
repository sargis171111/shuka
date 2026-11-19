import { Link, Navigate, useLocation } from 'react-router-dom';
import { BarChart3, Box, ClipboardList, Plus, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function SellerLayout({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center text-sm text-slate-500">
        Loading seller workspace...
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!user.store_name) {
    return <Navigate to="/seller/activate" replace />;
  }

  const navItems = [
    { to: '/seller', label: 'Overview', icon: BarChart3, exact: true },
    { to: '/seller/products', label: 'Products', icon: Box },
    { to: '/seller/orders', label: 'Orders', icon: ClipboardList },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shuka-100 text-shuka-700">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Seller Storefront
            </p>
            <h1 className="text-lg font-bold text-slate-900">{user.store_name}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <Link
            to="/seller/products/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-shuka-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-shuka-600"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        </div>
      </div>

      {children}
    </div>
  );
}
