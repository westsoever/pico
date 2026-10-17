import { useState, type ReactNode } from 'react';

interface CoffeeImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
  loading?: 'eager' | 'lazy';
}

/** Remote roaster image that swaps to `fallback` when missing or broken. */
export function CoffeeImage({ src, alt, className, fallback, loading = 'eager' }: CoffeeImageProps) {
  const [failedSrc, setFailedSrc] = useState<string>();

  if (!src || failedSrc === src) return <>{fallback}</>;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
    />
  );
}
