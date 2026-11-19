import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Store, Truck } from 'lucide-react';
import { apiRequest } from '../lib/api.js';
import ProductCard from '../components/ProductCard.jsx';

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest('/categories'), apiRequest('/products?limit=12&sort=newest')])
      .then(([catData, prodData]) => {
        if (!active) return;
        setCategories(catData.categories || []);
        setProducts(prodData.products || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-10">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 p-6 text-white shadow-lg sm:p-10">
        <div className="relative z-10 max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-shuka-500/20 px-3 py-1 text-xs font-semibold text-shuka-300 ring-1 ring-shuka-400/30">
            Local Armenian Sellers • Pay Cash on Delivery
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Everything from Yerevan &amp; beyond, delivered to your door.
          </h1>
          <p className="text-sm text-slate-300 sm:text-base">
            Shop verified local stores across Armenia for electronics, handmade copperware, outdoor gear, fashion, and more.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/search"
              className="inline-flex items-center gap-2 rounded-xl bg-shuka-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-shuka-400"
            >
              Browse Marketplace
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/seller/activate"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Start Selling
            </Link>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 border-t border-white/10 pt-6 text-xs text-slate-300 sm:grid-cols-3">
          <div className="flex items-center gap-2.5">
            <Truck className="h-4 w-4 text-shuka-400" />
            <span>Delivery across all 11 regions of Armenia</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-shuka-400" />
            <span>Transparent AMD pricing &amp; verified reviews</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Store className="h-4 w-4 text-shuka-400" />
            <span>Direct from trusted local sellers</span>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Shop by Category</h2>
          <Link to="/search" className="text-sm font-semibold text-shuka-600 hover:text-shuka-700">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/search?category=${encodeURIComponent(cat.slug)}`}
              className="flex flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-shuka-400 hover:bg-shuka-50/40 hover:shadow-sm"
            >
              <span className="text-sm font-semibold text-slate-900">{cat.name}</span>
              <span className="mt-2 text-xs text-slate-500">
                {cat.product_count} {cat.product_count === 1 ? 'item' : 'items'}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Newest Products */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Newest Arrivals</h2>
          <Link
            to="/search?sort=newest"
            className="inline-flex items-center gap-1 text-sm font-semibold text-shuka-600 hover:text-shuka-700"
          >
            See all products
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
