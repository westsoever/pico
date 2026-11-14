/* eslint-disable react/only-export-components -- sizedImageUrl is a pure helper kept next to its only user. */
import { useState, type ReactNode } from 'react';

interface CoffeeImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
  loading?: 'eager' | 'lazy';
  /** Display width in CSS pixels; Shopify images are fetched at twice this. */
  width?: number;
}

/** Shopify serves catalog bag shots at 4000px (~8 MB); ask its CDN for a small copy. */
export function sizedImageUrl(src: string, width: number): string {
  try {
    const url = new URL(src);
    if (url.hostname !== 'cdn.shopify.com') return src;
    url.searchParams.set('width', String(width));
    return url.toString();
  } catch {
    return src;
  }
}

/** Remote roaster image that swaps to `fallback` when missing or broken. */
export function CoffeeImage({ src, alt, className, fallback, loading = 'eager', width = 200 }: CoffeeImageProps) {
  const [failedSrc, setFailedSrc] = useState<string>();

  if (!src || failedSrc === src) return <>{fallback}</>;

  return (
    <img
      src={sizedImageUrl(src, width * 2)}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
    />
  );
}
