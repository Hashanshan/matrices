'use client';

import { useState, useEffect, useRef } from 'react';
import { getCachedImageUrlSync, getCachedImageUrl, evictFromImageMemoryMap, isLocalUri } from '@/lib/offline/image-cache';
import { resolveApiUrl } from '@/lib/utils';

interface SmartImageProps {
  src: string | null | undefined;
  alt?: string;
  fallbackSrc?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLImageElement>;
  /** Set true to mark as high-priority (eager loading) */
  priority?: boolean;
  /** When true, shows a shimmer placeholder while loading */
  showShimmer?: boolean;
  fill?: boolean;
  sizes?: string;
}

export default function SmartImage({
  src,
  alt = 'Product Image',
  fallbackSrc = '/placeholder.png',
  className = '',
  style,
  onClick,
  priority = false,
  showShimmer = false,
  fill,
  sizes,
}: SmartImageProps) {
  const getOnlineUrl = (url: string | null | undefined): string => {
    if (!url) return fallbackSrc;
    if (isLocalUri(url)) return url;
    return resolveApiUrl(url) || url;
  };

  // Try synchronous lookup first so we can start with the correct src immediately
  const getInitialSrc = () => {
    const raw = src || fallbackSrc;
    if (!raw) return fallbackSrc;
    if (isLocalUri(raw)) return raw;

    // Try the in-memory map (O(1), synchronous)
    const synced = getCachedImageUrlSync(raw);
    if (synced) return synced;

    // Prevent 30-second browser socket hang when device is offline
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      return fallbackSrc;
    }

    return getOnlineUrl(raw);
  };

  const [imgSrc, setImgSrc] = useState<string>(getInitialSrc);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const triedOnlineFallbackRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Async resolution — queries IndexedDB / CacheStorage if synchronous lookup returned null
  useEffect(() => {
    const raw = src || fallbackSrc;
    if (!raw) {
      setImgSrc(fallbackSrc);
      return;
    }

    if (isLocalUri(raw)) {
      if (imgSrc !== raw) setImgSrc(raw);
      setFailed(false);
      return;
    }

    const synced = getCachedImageUrlSync(raw);
    if (synced && synced !== imgSrc) {
      setImgSrc(synced);
      setFailed(false);
      return;
    }

    let cancelled = false;
    getCachedImageUrl(raw)
      .then((resolved) => {
        if (!cancelled && mountedRef.current) {
          if (resolved && (resolved !== raw || isLocalUri(resolved))) {
            if (resolved !== imgSrc) {
              setImgSrc(resolved);
            }
            setFailed(false);
          } else if (!resolved || (resolved === raw && typeof navigator !== 'undefined' && !navigator.onLine)) {
            // Offline and no local cached copy available in IndexedDB
            setFailed(true);
          } else if (resolved === raw && typeof navigator !== 'undefined' && navigator.onLine) {
            // Online mode - resolve full URL
            const onlineUrl = getOnlineUrl(raw);
            if (onlineUrl !== imgSrc) {
              setImgSrc(onlineUrl);
            }
            setFailed(false);
          }
        }
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) {
          const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
          if (isOnline) {
            setImgSrc(getOnlineUrl(raw));
            setFailed(false);
          } else {
            setFailed(true);
          }
        }
      });

    return () => { cancelled = true; };
  }, [src, fallbackSrc]);

  // When src changes reset failed state and set initial src
  useEffect(() => {
    setFailed(false);
    setLoading(true);
    triedOnlineFallbackRef.current = false;
    const initial = getInitialSrc();
    if (initial !== imgSrc) {
      setImgSrc(initial);
    }
  }, [src]);

  const handleError = () => {
    const raw = src || fallbackSrc;
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    const onlineUrl = getOnlineUrl(raw);

    // If a cached/local image failed to load while online, fall back to live server URL
    if (isOnline && raw && !triedOnlineFallbackRef.current && imgSrc !== onlineUrl) {
      triedOnlineFallbackRef.current = true;
      evictFromImageMemoryMap(raw).catch(() => {});
      setImgSrc(onlineUrl);
      setLoading(true);
      return;
    }

    // If live server URL or fallback also failed
    if (fallbackSrc && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
      setLoading(false);
      return;
    }

    setFailed(true);
    setLoading(false);
  };

  if (failed) {
    // Silent grey placeholder — no noisy "IMAGE OFFLINE" text
    return (
      <div
        className={`bg-gray-100 flex items-center justify-center ${className}`}
        style={style}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-8 h-8 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  const containerClass = fill
    ? `absolute inset-0 w-full h-full ${className}`
    : `relative ${className}`;

  return (
    <div className={containerClass} style={style}>
      {showShimmer && loading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-inherit" />
      )}
      {/* Using plain <img> avoids Next.js image optimizer rejecting local/native URIs */}
      <img
        src={imgSrc || fallbackSrc}
        alt={alt}
        className={`w-full h-full object-contain ${showShimmer && loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-150`}
        style={{ display: 'block' }}
        loading={priority ? 'eager' : 'lazy'}
        {...(priority ? ({ fetchPriority: 'high' } as any) : {})}
        decoding="async"
        onLoad={() => setLoading(false)}
        onError={handleError}
        onClick={onClick}
      />
    </div>
  );
}
