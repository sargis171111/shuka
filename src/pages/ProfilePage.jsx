import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProfilePage() {
  const { user, loading, updateProfile } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center text-sm text-slate-500">
        Loading profile...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login?next=/profile" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setError('');
    try {
      await updateProfile({ name, phone });
      setMsg('Profile updated.');
    } catch (err) {
      setError(err.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900">Account Profile</h1>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        {msg && (
          <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            {msg}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Email</label>
            <input
              type="email"
              disabled
              value={user.email}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Full Name</label>
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Phone</label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <Store className="h-5 w-5 text-shuka-600" />
          <div>
            <p className="text-sm font-bold text-slate-900">
              {user.store_name ? `Seller Store: ${user.store_name}` : 'Sell on Shuka'}
            </p>
            <p className="text-xs text-slate-500">
              {user.store_name
                ? 'Manage your listings and fulfill customer orders.'
                : 'Open your local storefront in seconds.'}
            </p>
          </div>
        </div>
        <Link
          to={user.store_name ? '/seller' : '/seller/activate'}
          className="rounded-xl bg-shuka-500 px-4 py-2 text-xs font-bold text-white hover:bg-shuka-600"
        >
          {user.store_name ? 'Open Dashboard' : 'Activate Store'}
        </Link>
      </div>
    </div>
  );
}
