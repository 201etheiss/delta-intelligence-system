'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

export function StarRating({ rating, onRate }: { rating?: number; onRate?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const display = hover || Math.round(rating ?? 0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          onClick={(e) => { e.stopPropagation(); onRate?.(v); }}
          onMouseEnter={() => setHover(v)}
          onMouseLeave={() => setHover(0)}
          className="p-0 focus:outline-none"
        >
          <Star
            size={14}
            className={v <= display ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-300'}
          />
        </button>
      ))}
      {rating != null && (
        <span className="ml-1 text-[10px] text-zinc-400 tabular-nums">{rating.toFixed(1)}</span>
      )}
    </div>
  );
}
