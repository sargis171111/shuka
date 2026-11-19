import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, SearchX, SlidersHorizontal } from 'lucide-react';
import { apiRequest } from '../lib/api.js';
import ProductCard from '../components/ProductCard.jsx';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const sort = searchParams.get('sort') || 'newest';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const [categories, setCategories] = useState([]);
  const [data, setData] = useState({ products: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [minInput, setMinInput] = useState(minPrice);
  const [maxInput, setMaxInput] = useState(maxPrice);

  useEffect(() => {
    setMinInput(minPrice);
    setMaxInput(maxPrice);
  }, [minPrice, maxPrice]);

  useEffect(() => {
    apiRequest('/categories')
      .then((res) => setCategories(res.categories || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (sort) params.set('sort', sort);
    params.set('page', String(page));
    params.set('limit', '12');

    apiRequest(`/products?${params.toString()}`)
      .then((res) => {
        if (active) setData(res);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [q, category, minPrice, maxPrice, sort, page]);

  const updateParam = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    });
    if (!('page' in updates)) {
      next.delete('page');
    }
    setSearchParams(next);
  };

  const applyPriceFilter = (e) => {
    e.preventDefault();
    updateParam({ minPrice: minInput.trim(), maxPrice: maxInput.trim() });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {q
              ? `Results for "${q}"`
              : category
              ? categories.find((c) => c.slug === category)?.name || 'Category'
              : 'All Products'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? 'Searching...' : `${data.total} product${data.total === 1 ? '' : 's'} found`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="sort-select" className="text-sm font-medium text-slate-600">
            Sort:
          </label>
          <select
            id="sort-select"
            value={sort}
            onChange={(e) => updateParam({ sort: e.target.value })}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-shuka-500"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Sidebar Filters */}
        <aside className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 h-fit">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <SlidersHorizontal className="h-4 w-4 text-shuka-600" />
              Filters
            </h2>
            {(q || category || minPrice || maxPrice) && (
              <Link
                to="/search"
                className="text-xs font-semibold text-shuka-600 hover:underline"
              >
                Reset
              </Link>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => updateParam({ category: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-shuka-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={applyPriceFilter} className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Price Range (AMD)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                placeholder="Min ֏"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-shuka-500"
              />
              <input
                type="number"
                min="0"
                placeholder="Max ֏"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-shuka-500"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Apply Price
            </button>
          </form>
        </aside>

        {/* Product Grid */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-72 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
                />
              ))}
            </div>
          ) : data.products.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <SearchX className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-bold text-slate-900">No products match your search</h3>
              <p className="mt-1 text-sm text-slate-500">
                Try clearing your filters or searching with different keywords.
              </p>
              <Link
                to="/search"
                className="mt-5 rounded-xl bg-shuka-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-shuka-600"
              >
                View all products
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {data.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {data.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => updateParam({ page: page - 1 })}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </button>
                  <span className="px-3 text-sm font-medium text-slate-600">
                    Page {page} of {data.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= data.totalPages}
                    onClick={() => updateParam({ page: page + 1 })}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
