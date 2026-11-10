import Image from 'next/image';
import type { SyntheticEvent } from 'react';
import { cn } from '@/lib/cn';

/** Sources the Next.js image optimiser may fetch (must match next.config.ts). */
const OPTIMISABLE_REMOTE =
  /^https:\/\/(img\.youtube\.com|i\.ytimg\.com|[a-z0-9-]+\.public\.blob\.vercel-storage\.com)\//i;

function canOptimise(src: string): boolean {
  if (/\.(svg|gif)(\?.*)?$/i.test(src)) return false;
  if (src.startsWith('/') && !src.startsWith('//')) return true;
  return OPTIMISABLE_REMOTE.test(src);
}

type FillImageProps = {
  src: string;
  alt: string;
  /** Rendered width hint for responsive loading, e.g. "(max-width: 640px) 100vw, 320px". */
  sizes: string;
  priority?: boolean;
  className?: string;
  onError?: (e: SyntheticEvent<HTMLImageElement>) => void;
};

/**
 * Image that fills its (positioned) parent. Uses next/image when the source can be
 * optimised, and a plain <img> for anything else — an arbitrary URL typed into the admin
 * must not crash the page because its host is not on the optimiser's allow-list.
 */
export function FillImage({ src, alt, sizes, priority, className, onError }: FillImageProps) {
  if (canOptimise(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={className}
        onError={onError}
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('absolute inset-0 h-full w-full', className)}
      onError={onError}
    />
  );
}
