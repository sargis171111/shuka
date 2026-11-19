import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  LogOut,
  Package,
  Search,
  ShoppingBag,
  ShoppingCart,
  Store,
  User,
} from 'lucide-react';
import { apiRequest } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function Header() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [selectedCat, setSelectedCat] = useState(searchParams.get('category') || '');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
    setSelectedCat(searchParams.get('category') || '');
  }, [searchParams]);

  useEffect(() => {
    apiRequest('/categories')
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (selectedCat) params.set('category', selectedCat);
    navigate(`/search${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Logo */}
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-shuka-500 text-white shadow-sm">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <span className="text-lg font-extrabold tracking-tight text-slate-900">
                Shuka
              </span>
              <span className="hidden text-[11px] font-medium text-slate-500 sm:block">
                Armenia Marketplace
              </span>
            </div>
          </Link>

          {/* Search bar */}
          <form
            onSubmit={handleSearch}
            className="hidden flex-1 max-w-2xl items-center overflow-hidden rounded-xl border border-slate-300 bg-slate-50 focus-within:border-shuka-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-shuka-200 md:flex"
          >
            <select
              aria-label="Category"
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="h-10 border-r border-slate-200 bg-transparent px-3 text-xs font-medium text-slate-700 outline-none"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search electronics, home goods, Armenian crafts..."
              className="h-10 flex-1 bg-transparent px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
            />
            <button
              type="submit"
              className="flex h-10 items-center gap-1.5 bg-shuka-500 px-4 text-sm font-semibold text-white transition hover:bg-shuka-600"
            >
              <Search className="h-4 w-4" />
              <span>Search</span>
            </button>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/cart"
              className="relative flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-shuka-400 hover:text-shuka-700"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Cart</span>
              {cart.total_items > 0 && (
                <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-shuka-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  {cart.total_items}
                </span>
              )}
            </Link>

            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <User className="h-4 w-4 text-shuka-600" />
                  <span className="max-w-[100px] truncate">{user.name.split(' ')[0]}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                    <div className="border-b border-slate-100 px-4 py-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                    </div>
                    <Link
                      to="/orders"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Package className="h-4 w-4 text-slate-400" />
                      My Orders
                    </Link>
                    <Link
                      to={user.store_name ? '/seller' : '/seller/activate'}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Store className="h-4 w-4 text-shuka-500" />
                      {user.store_name ? 'Seller Dashboard' : 'Sell on Shuka'}
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <User className="h-4 w-4 text-slate-400" />
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile search */}
        <form onSubmit={handleSearch} className="pb-3 md:hidden">
          <div className="flex overflow-hidden rounded-xl border border-slate-300 bg-slate-50">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Shuka..."
              className="h-10 flex-1 bg-transparent px-3 text-sm outline-none"
            />
            <button
              type="submit"
              className="flex h-10 items-center justify-center bg-shuka-500 px-4 text-white"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>

        {/* Category Strip */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 py-2 text-xs font-medium text-slate-600">
          <Link
            to="/search"
            className={`shrink-0 rounded-lg px-2.5 py-1 transition hover:bg-slate-100 hover:text-slate-900 ${
              !selectedCat && window.location.pathname === '/search'
                ? 'bg-shuka-50 text-shuka-700 font-semibold'
                : ''
            }`}
          >
            All Products
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/search?category=${encodeURIComponent(cat.slug)}`}
              className={`shrink-0 rounded-lg px-2.5 py-1 transition hover:bg-slate-100 hover:text-slate-900 ${
                selectedCat === cat.slug ? 'bg-shuka-50 text-shuka-700 font-semibold' : ''
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
