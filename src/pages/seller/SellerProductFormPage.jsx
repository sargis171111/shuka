import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star, Trash2, Upload } from 'lucide-react';
import { apiRequest } from '../../lib/api.js';
import SellerLayout from '../../components/SellerLayout.jsx';

export default function SellerProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [form, setForm] = useState({
    title: '',
    category_id: '',
    description: '',
    price_amd: '',
    stock: '1',
    is_published: true,
  });
  const [images, setImages] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const promises = [apiRequest('/categories')];
    if (isEdit) {
      promises.push(apiRequest(`/seller/products/${id}`));
    }

    Promise.all(promises)
      .then(([catRes, prodRes]) => {
        if (!active) return;
        const cats = catRes.categories || [];
        setCategories(cats);
        if (prodRes?.product) {
          const p = prodRes.product;
          setForm({
            title: p.title,
            category_id: String(p.category_id),
            description: p.description,
            price_amd: String(p.price_amd),
            stock: String(p.stock),
            is_published: p.is_published === 1,
          });
          setImages(p.images || []);
        } else if (cats.length > 0) {
          setForm((prev) => ({ ...prev, category_id: String(cats[0].id) }));
        }
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load product.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, isEdit]);

  const validate = () => {
    const errs = {};
    if (form.title.trim().length < 3) errs.title = 'Title must be at least 3 characters.';
    if (!form.category_id) errs.category_id = 'Category is required.';
    if (form.description.trim().length < 10)
      errs.description = 'Description must be at least 10 characters.';
    const price = Number(form.price_amd);
    if (!Number.isInteger(price) || price <= 0)
      errs.price_amd = 'Price must be a whole number greater than 0 AMD.';
    const stock = Number(form.stock);
    if (!Number.isInteger(stock) || stock < 0)
      errs.stock = 'Stock must be a non-negative integer.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const uploadFilesToProduct = async (productId, files) => {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    for (const f of files) {
      fd.append('images', f);
    }
    const res = await apiRequest(`/seller/products/${productId}/images`, {
      method: 'POST',
      body: fd,
    });
    setImages(res.images || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        category_id: Number(form.category_id),
        description: form.description.trim(),
        price_amd: Number(form.price_amd),
        stock: Number(form.stock),
        is_published: form.is_published ? 1 : 0,
      };

      if (isEdit) {
        await apiRequest(`/seller/products/${id}`, {
          method: 'PATCH',
          body: payload,
        });
        navigate('/seller/products');
      } else {
        const res = await apiRequest('/seller/products', {
          method: 'POST',
          body: payload,
        });
        const newId = res.product.id;
        if (pendingFiles.length > 0) {
          await uploadFilesToProduct(newId, pendingFiles);
        }
        navigate('/seller/products');
      }
    } catch (err) {
      setError(err.message || 'Could not save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileInput = async (e) => {
    const chosen = Array.from(e.target.files || []);
    e.target.value = '';
    if (chosen.length === 0) return;
    setError('');

    if (!isEdit) {
      if (pendingFiles.length + chosen.length > 5) {
        setError('Maximum 5 images per product.');
        return;
      }
      setPendingFiles((prev) => [...prev, ...chosen]);
      return;
    }

    if (images.length + chosen.length > 5) {
      setError(`Maximum 5 images per product (currently ${images.length}).`);
      return;
    }

    setUploading(true);
    try {
      await uploadFilesToProduct(id, chosen);
    } catch (err) {
      setError(err.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const handleSetMain = async (imageId) => {
    setError('');
    try {
      const res = await apiRequest(`/seller/products/${id}`, {
        method: 'PATCH',
        body: { main_image_id: imageId },
      });
      setImages(res.product.images || []);
    } catch (err) {
      setError(err.message || 'Could not update main image.');
    }
  };

  const handleDeleteImage = async (imageId) => {
    setError('');
    try {
      const res = await apiRequest(`/seller/products/${id}/images/${imageId}`, {
        method: 'DELETE',
      });
      setImages(res.images || []);
    } catch (err) {
      setError(err.message || 'Could not delete image.');
    }
  };

  return (
    <SellerLayout>
      <div className="mx-auto max-w-3xl space-y-5">
        <Link
          to="/seller/products"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Products
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-5 text-xl font-extrabold text-slate-900">
            {isEdit ? 'Edit Product' : 'Add New Product'}
          </h2>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-500">Loading form...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Product Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
                />
                {fieldErrors.title && (
                  <p className="mt-1 text-xs text-rose-600">{fieldErrors.title}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Category *
                  </label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.category_id && (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.category_id}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Price (AMD) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.price_amd}
                    onChange={(e) => setForm({ ...form, price_amd: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
                  />
                  {fieldErrors.price_amd && (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.price_amd}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Stock Units *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
                  />
                  {fieldErrors.stock && (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.stock}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Description *
                </label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-shuka-500"
                />
                {fieldErrors.description && (
                  <p className="mt-1 text-xs text-rose-600">{fieldErrors.description}</p>
                )}
              </div>

              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-shuka-600"
                />
                Published (visible in marketplace storefront)
              </label>

              {/* Images */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                      Product Images (up to 5, JPEG/PNG/WebP, max 5MB each)
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-100">
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? 'Uploading...' : 'Select Images'}
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileInput}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </div>

                {isEdit ? (
                  images.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      {images.map((img, idx) => (
                        <div
                          key={img.id}
                          className={`relative overflow-hidden rounded-xl border bg-white p-1.5 ${
                            idx === 0 ? 'border-shuka-500 ring-2 ring-shuka-200' : 'border-slate-200'
                          }`}
                        >
                          <img
                            src={img.thumb_url}
                            alt="Product"
                            className="aspect-square w-full rounded-lg object-cover"
                          />
                          <div className="mt-1.5 flex items-center justify-between gap-1">
                            {idx === 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-shuka-700">
                                <Star className="h-3 w-3 fill-shuka-400" />
                                Main
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSetMain(img.id)}
                                className="text-[10px] font-semibold text-slate-600 hover:text-shuka-700"
                              >
                                Set Main
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteImage(img.id)}
                              className="text-rose-500 hover:text-rose-700"
                              aria-label="Delete image"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  pendingFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {pendingFiles.map((file, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                        >
                          <span className="max-w-[160px] truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="text-rose-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Link
                  to="/seller/products"
                  className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="rounded-xl bg-shuka-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-shuka-600 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
