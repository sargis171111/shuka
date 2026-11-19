import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message || 'Sign in failed.');
      setSubmitting(false);
    }
  };

  const quickFill = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Sign in to Shuka</h1>
          <p className="mt-1 text-sm text-slate-500">
            Access your orders, cart, or seller storefront.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-shuka-500 py-3 text-sm font-bold text-white hover:bg-shuka-600 disabled:opacity-50"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600 space-y-2">
          <p className="font-semibold text-slate-800">Demo Quick-Fill Accounts:</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => quickFill('narek@demo.am', 'Buyer123!')}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 hover:border-shuka-400"
            >
              Buyer: Narek
            </button>
            <button
              type="button"
              onClick={() => quickFill('aram@yerevantech.am', 'Seller123!')}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 hover:border-shuka-400"
            >
              Seller: Yerevan Tech
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-slate-600">
          New to Shuka?{' '}
          <Link to="/register" className="font-semibold text-shuka-600 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
