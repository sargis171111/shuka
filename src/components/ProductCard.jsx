import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { formatAmd } from '../lib/api.js';
import StarRating from './StarRating.jsx';

export default function ProductCard({ product }) {
  return (
    <Link
      to={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-shuka-400 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {product.thumb_url || product.image_url ? (
          <img
            src={product.thumb_url || product.image_url}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            <Package className="h-10 w-10" />
          </div>
        )}
        {product.stock === 0 && (
          <span className="absolute left-2 top-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">
            Out of stock
          </span>
        )}
        {product.stock > 0 && product.stock <= 5 && (
          <span className="absolute left-2 top-2 rounded-md bg-amber-600/90 px-2 py-0.5 text-xs font-medium text-white">
            Only {product.stock} left
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {product.category_name}
        </span>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-shuka-700">
          {product.title}
        </h3>
        <div className="mt-1.5">
          <StarRating rating={product.rating_avg} count={product.rating_count} />
        </div>
        <div className="mt-auto pt-3 flex items-baseline justify-between">
          <span className="text-base font-bold text-slate-900">
            {formatAmd(product.price_amd)}
          </span>
          <span className="truncate max-w-[110px] text-xs text-slate-500">
            {product.seller_store_name}
          </span>
        </div>
      </div>
    </Link>
  );
}
