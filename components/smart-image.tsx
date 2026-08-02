'use client';

import { useState, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';
import { getCachedImageUrl } from '@/lib/offline/image-cache';

interface SmartImageProps extends Omit<ImageProps, 'src'> {
  src: string | null | undefined;
  fallbackSrc?: string;
}

export default function SmartImage({
  src,
  fallbackSrc = '/placeholder.png',
  alt,
  className,
  fill,
  width,
  height,
  sizes,
  priority,
  style,
  onClick,
  ...rest
}: SmartImageProps) {
  const [imgSrc, setImgSrc] = useState<string>(src || fallbackSrc);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const raw = src || fallbackSrc;

    if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) {
      setImgSrc(raw || fallbackSrc);
      return;
    }

    getCachedImageUrl(raw).then((resolved) => {
      if (isMounted) {
        setImgSrc(resolved || raw || fallbackSrc);
      }
    }).catch(() => {
      if (isMounted) {
        setImgSrc(raw || fallbackSrc);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [src, fallbackSrc]);

  const isDataOrBlob = imgSrc.startsWith('data:') || imgSrc.startsWith('blob:');

  if (hasError) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold font-mono ${className || ''}`}>
        IMAGE OFFLINE
      </div>
    );
  }

  // Use unoptimized for Data URLs, Blob URLs, or when offline to prevent Next.js image optimizer failures
  return (
    <Image
      src={imgSrc || fallbackSrc}
      alt={alt || 'Product Image'}
      fill={fill}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      style={style}
      className={className}
      onClick={onClick}
      unoptimized={isDataOrBlob || (typeof navigator !== 'undefined' && !navigator.onLine)}
      onError={() => {
        if (imgSrc !== fallbackSrc) {
          setImgSrc(fallbackSrc);
        } else {
          setHasError(true);
        }
      }}
      {...rest}
    />
  );
}
