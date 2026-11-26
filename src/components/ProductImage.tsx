import { Package } from 'lucide-react';
import { useState } from 'react';

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fit?: 'contain' | 'cover';
}

export function ProductImage({
  src,
  alt,
  className = '',
  fit = 'contain',
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-emerald-950/[0.04] text-emerald-900/50 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Package className="h-11 w-11 stroke-[1.5]" />
        <span className="mt-2 px-4 text-center text-xs font-medium text-emerald-950/60 line-clamp-1">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${fit === 'contain' ? 'object-contain p-2' : 'object-cover'} ${className}`}
    />
  );
}
