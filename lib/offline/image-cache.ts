/**
 * Offline Image Caching Engine
 * Pre-fetches product image blobs and caches them in CacheStorage for offline viewing.
 */

const IMAGE_CACHE_NAME = 'matrices-product-images-v1';

export async function cacheProductImages(imageUrls: string[], onProgress?: (done: number, total: number) => void): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    let done = 0;

    for (let i = 0; i < imageUrls.length; i += 5) {
      const chunk = imageUrls.slice(i, i + 5);
      await Promise.all(
        chunk.map(async (url) => {
          if (!url || url.startsWith('data:')) return;
          try {
            const match = await cache.match(url);
            if (!match) {
              await cache.add(url);
            }
          } catch (e) {
            console.warn(`Could not cache image: ${url}`, e);
          } finally {
            done++;
            onProgress?.(done, imageUrls.length);
          }
        })
      );
    }
  } catch (err) {
    console.error('Failed to open image cache', err);
  }
}

export async function getCachedImageUrl(url: string): Promise<string> {
  if (typeof window === 'undefined' || !('caches' in window) || !url) return url;

  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const response = await cache.match(url);
    if (response) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch (e) {
    console.warn(`Error retrieving image from cache for ${url}`, e);
  }

  return url;
}
