import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function SellerActivatePage() {
  const { user, loading, activateSeller } = useAuth();
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && !phone) {
      setPhone(user.phone || '');
    }
  }, [user, phone]);

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login?next=/seller/activate" replace />;
  }

  if (user.store_name) {
    return <Navigate to="/seller" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await activateSeller({ store_name: storeName, phone });
      navigate('/seller', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not activate seller store.');
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-shuka-100 text-shuka-700">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Sell on Shuka</h1>
            <p className="text-xs text-slate-500">
              Open your storefront immediately and list products across Armenia.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Store Name *</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={60}
              placeholder="e.g. Dilijan Crafts"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Store Contact Phone *
            </label>
            <input
              type="text"
              required
              placeholder="+374 91 000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-shuka-500 py-3 text-sm font-bold text-white hover:bg-shuka-600 disabled:opacity-50"
          >
            {submitting ? 'Activating Store...' : 'Activate Seller Store'}
          </button>
        </form>
      </div>
    </div>
  );
}
