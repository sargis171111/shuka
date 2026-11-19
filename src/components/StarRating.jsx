import { Star } from 'lucide-react';

export default function StarRating({ rating = 0, count = null, size = 'sm' }) {
  const rounded = Math.round(Number(rating || 0) * 2) / 2;
  const iconClass = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <div className="inline-flex items-center gap-1">
      <div className="flex items-center text-shuka-500" aria-label={`Rated ${rating} out of 5`}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= Math.round(rounded);
          return (
            <Star
              key={n}
              className={`${iconClass} ${
                filled ? 'fill-shuka-400 text-shuka-500' : 'text-slate-300'
              }`}
            />
          );
        })}
      </div>
      {count !== null && (
        <span className="text-xs text-slate-500">
          {Number(rating || 0) > 0 ? Number(rating).toFixed(1) : 'New'} ({count})
        </span>
      )}
    </div>
  );
}
