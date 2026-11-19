import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Edit, Eye, EyeOff, Package, Plus } from 'lucide-react';
import { apiRequest, formatAmd } from '../../lib/api.js';
import SellerLayout from '../../components/SellerLayout.jsx';

export default function SellerProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const loadProducts = () => {
    setLoading(true);
    apiRequest('/seller/products')
      .then((d) => setProducts(d.products || []))
      .catch((err) => setError(err.message || 'Could not load products'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const togglePublish = async (product) => {
    setBusyId(product.id);
    setError('');
    try {
      const nextPub = product.is_published === 1 ? 0 : 1;
      const res = await apiRequest(`/seller/products/${product.id}`, {
        method: 'PATCH',
        body: { is_published: nextPub },
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_published: res.product.is_published } : p))
      );
    } catch (err) {
      setError(err.message || 'Could not update publish status.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SellerLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Your Products ({products.length})</h2>
          <Link
            to="/seller/products/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-shuka-500 px-4 py-2 text-xs font-bold text-white hover:bg-shuka-600"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {loading ? (
          <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <Package className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-900">No products listed yet</p>
            <Link
              to="/seller/products/new"
              className="mt-4 inline-block rounded-xl bg-shuka-500 px-5 py-2 text-xs font-bold text-white"
            >
              Create your first listing
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Units Sold</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          {p.thumb_url ? (
                            <img
                              src={p.thumb_url}
                              alt={p.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-300">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            to={`/seller/products/${p.id}/edit`}
                            className="block max-w-xs truncate font-semibold text-slate-900 hover:text-shuka-700"
                          >
                            {p.title}
                          </Link>
                          <span className="text-xs text-slate-400">{p.category_name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {formatAmd(p.price_amd)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          p.stock === 0 ? 'text-rose-600' : 'text-slate-700'
                        }`}
                      >
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.is_published === 1 ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          Unpublished
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{p.units_sold}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={`/seller/products/${p.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => togglePublish(p)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          {p.is_published === 1 ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              Publish
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
