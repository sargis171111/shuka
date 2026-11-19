import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Minus, Package, Plus, ShoppingCart, Store } from 'lucide-react';
import { apiRequest, formatAmd, formatDate } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import StarRating from '../components/StarRating.jsx';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setItemQuantity } = useCart();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [addedMsg, setAddedMsg] = useState('');
  const [cartErr, setCartErr] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setActiveImage(0);
    setQuantity(1);
    setAddedMsg('');
    setCartErr('');

    Promise.all([apiRequest(`/products/${id}`), apiRequest(`/products/${id}/reviews`)])
      .then(([pRes, rRes]) => {
        if (!active) return;
        setProduct(pRes.product);
        setReviews(rRes.reviews || []);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Product not found');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const handleAddToCart = async () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/products/${id}`)}`);
      return;
    }
    setAdding(true);
    setCartErr('');
    setAddedMsg('');
    try {
      await setItemQuantity(product.id, quantity, { accept_price: true });
      setAddedMsg('Added to your cart');
    } catch (err) {
      setCartErr(err.message || 'Could not add item to cart');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 text-center text-sm text-slate-500">
        Loading product...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Product not found</h1>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
        <Link
          to="/search"
          className="mt-5 inline-block rounded-xl bg-shuka-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to Marketplace
        </Link>
      </div>
    );
  }

  const images = product.images || [];
  const mainImg = images[activeImage] || images[0];
  const isOwnProduct = user && user.id === product.seller_id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-10">
      <div className="text-xs text-slate-500 flex items-center gap-2">
        <Link to="/" className="hover:text-slate-900">Home</Link>
        <span>/</span>
        <Link
          to={`/search?category=${encodeURIComponent(product.category_slug)}`}
          className="hover:text-slate-900"
        >
          {product.category_name}
        </Link>
        <span>/</span>
        <span className="truncate text-slate-700 font-medium">{product.title}</span>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Image Gallery */}
        <div className="space-y-3">
          <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {mainImg ? (
              <img
                src={mainImg.url}
                alt={product.title}
                className="h-full w-full object-contain bg-slate-50"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300">
                <Package className="h-16 w-16" />
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImage(idx)}
                  className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                    idx === activeImage
                      ? 'border-shuka-500 ring-2 ring-shuka-200'
                      : 'border-slate-200 opacity-75 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img.thumb_url}
                    alt={`${product.title} ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info & Purchase Box */}
        <div className="flex flex-col space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-shuka-600">
              {product.category_name}
            </span>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">{product.title}</h1>

            <div className="mt-2 flex flex-wrap items-center gap-4">
              <StarRating rating={product.rating_avg} count={product.rating_count} size="md" />
              <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                <Store className="h-4 w-4 text-slate-400" />
                Sold by <strong className="text-slate-900">{product.seller_store_name}</strong>
              </span>
            </div>
          </div>

          <div className="border-y border-slate-100 py-4">
            <div className="text-3xl font-extrabold text-slate-900">
              {formatAmd(product.price_amd)}
            </div>
            <div className="mt-2">
              {product.stock === 0 ? (
                <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                  Out of stock
                </span>
              ) : product.stock <= 5 ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  Only {product.stock} left in stock
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  In stock ({product.stock} available)
                </span>
              )}
            </div>
          </div>

          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {product.description}
          </p>

          {/* Quantity + Add to cart */}
          {isOwnProduct ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              This is your own product listing.{' '}
              <Link
                to={`/seller/products/${product.id}/edit`}
                className="font-semibold text-shuka-600 hover:underline"
              >
                Edit in Seller Dashboard
              </Link>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {product.stock > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-700">Quantity</span>
                  <div className="inline-flex items-center rounded-xl border border-slate-300">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="p-2.5 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                      disabled={quantity >= product.stock}
                      className="p-2.5 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={product.stock === 0 || adding}
                onClick={handleAddToCart}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-shuka-500 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-shuka-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <ShoppingCart className="h-4 w-4" />
                {product.stock === 0
                  ? 'Out of Stock'
                  : adding
                  ? 'Adding...'
                  : 'Add to Cart'}
              </button>

              {addedMsg && (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Check className="h-4 w-4" />
                    {addedMsg}
                  </span>
                  <Link to="/cart" className="font-bold underline">
                    View Cart
                  </Link>
                </div>
              )}

              {cartErr && (
                <div className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                  {cartErr}
                </div>
              )}

              <p className="text-xs text-slate-500">
                Payment: Cash on delivery across Armenia.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reviews */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Customer Reviews ({product.rating_count})
          </h2>
          <StarRating rating={product.rating_avg} count={product.rating_count} size="md" />
        </div>

        {reviews.length === 0 ? (
          <p className="text-sm text-slate-500">
            No reviews yet. Customers who receive this product can leave a verified review from their order page.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map((rev) => (
              <div key={rev.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-900">{rev.buyer_name}</span>
                    <StarRating rating={rev.rating} />
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(rev.created_at)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{rev.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
