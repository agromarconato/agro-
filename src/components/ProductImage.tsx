import { Package } from 'lucide-react';
import { useEffect, useState } from 'react';

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

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-neutral-50 text-emerald-900/45 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Package className="h-11 w-11 stroke-[1.5]" />
        <span className="mt-2 px-4 text-center text-xs font-medium text-neutral-500 line-clamp-2">
          {failed ? 'Imagem indisponível' : alt}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${className}`}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={
          fit === 'contain'
            ? 'catalog-card-img select-none'
            : 'h-full w-full object-cover select-none'
        }
      />
    </div>
  );
}
