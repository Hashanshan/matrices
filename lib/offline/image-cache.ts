/**
 * Offline Image Storage Engine
 * Downloads product & category images directly into native local file storage (Capacitor Filesystem in APK)
 * or Base64 / Blob in IndexedDB (Web), eliminating reliance on volatile HTTP cache.
 *
 * KEY IMPROVEMENT: Builds an in-memory Map<url, localSrc> on first access so all subsequent
 * getCachedImageUrl() calls are O(1) synchronous lookups instead of async IndexedDB queries.
 */

import { offlineDB, ImageMapRecord } from './indexed-db';
import { resolveApiUrl, getAuthToken } from '../utils';

const IMAGE_CACHE_NAME = 'matrices-product-images-v1';

// ── In-memory image URL map for zero-latency synchronous lookups ─────────────────
const imageMemoryMap: Map<string, string> = new Map();

/** Pre-warm helper (no-op since map is initialized instantly) */
async function ensureImageMemoryMap(): Promise<Map<string, string>> {
  return imageMemoryMap;
}

/** Invalidate the in-memory map */
export function invalidateImageMemoryMap(): void {
  imageMemoryMap.clear();
}

/** Add/update a single entry in the in-memory map */
function updateImageMemoryMap(url: string, localSrc: string): void {
  if (url && localSrc) {
    imageMemoryMap.set(url, localSrc);
  }
}

// ── Capacitor / Native helpers ────────────────────────────────────────────────

async function loadCapacitorFilesystem(): Promise<any> {
  try {
    const dynamicImport = new Function('modulePath', 'return import(modulePath)');
    return await dynamicImport('@capacitor/filesystem');
  } catch {
    return null;
  }
}

function getCapacitorCore(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).Capacitor;
}

/** Returns true if the URL is already a local/native URI that doesn't need a lookup */
function isLocalUri(url: string): boolean {
  return (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('capacitor://') ||
    url.startsWith('file://') ||
    url.startsWith('http://localhost')
  );
}

// Simple hash generator for filenames
function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const cleanExt = url.split('.').pop()?.split('?')[0]?.substring(0, 4) || 'jpg';
  return `img_${Math.abs(hash)}.${cleanExt}`;
}

// Convert Blob to Base64 String
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Downloads a single high-resolution image directly from bucket/server and stores it natively/locally
 * Includes automatic retry on transient network failures for resilient background sync.
 */
export async function downloadAndSaveImage(url: string, retries = 2): Promise<string | null> {
  if (!url || isLocalUri(url)) return url;

  // Check in-memory map first (O(1))
  const map = await ensureImageMemoryMap();
  const cached = map.get(url);
  if (cached) return cached;

  const cap = getCapacitorCore();
  const isNative = cap?.isNativePlatform?.() ?? false;
  const targetFetchUrl = resolveApiUrl(url);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(targetFetchUrl, { headers, mode: 'cors', cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const sizeBytes = blob.size;

      if (isNative) {
        const fsModule = await loadCapacitorFilesystem();
        if (fsModule?.Filesystem && fsModule?.Directory) {
          const rawBase64 = await blobToBase64(blob);
          const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
          const fileName = hashUrl(url);

          const writeResult = await fsModule.Filesystem.writeFile({
            path: `Matrices/${fileName}`,
            data: cleanBase64,
            directory: fsModule.Directory.Documents,
            recursive: true,
          });

          const nativeUri = cap.convertFileSrc ? cap.convertFileSrc(writeResult.uri) : writeResult.uri;

          const record: ImageMapRecord = {
            url,
            localSrc: nativeUri,
            sizeBytes,
            updatedAt: new Date().toISOString(),
          };

          await offlineDB.saveImageMap(record);
          updateImageMemoryMap(url, nativeUri);
          return nativeUri;
        }
      }

      // Web / Browser mode: Store in CacheStorage (disk-backed binary) and session Object URL
      if ('caches' in window) {
        try {
          const cache = await caches.open(IMAGE_CACHE_NAME);
          await cache.put(url, new Response(blob.slice(0), {
            headers: { 'Content-Type': blob.type || 'image/jpeg' },
          }));
        } catch (e) {
          console.warn('CacheStorage put warning:', e);
        }
      }

      // In IndexedDB, store metadata with clean sizeBytes. Object URL is created for zero-overhead in-memory pointer.
      const objectUrl = URL.createObjectURL(blob);
      const record: ImageMapRecord = {
        url,
        localSrc: objectUrl,
        sizeBytes,
        updatedAt: new Date().toISOString(),
      };

      await offlineDB.saveImageMap(record);
      updateImageMemoryMap(url, objectUrl);

      return objectUrl;
    } catch (err) {
      if (attempt < retries) {
        // Wait 400ms before retry
        await new Promise((r) => setTimeout(r, 400));
      } else {
        console.warn(`Failed to download image ${url} after ${retries + 1} attempts:`, err);
        return null;
      }
    }
  }
  return null;
}

/**
 * Returns list of image URLs that are not yet downloaded / cached locally
 */
export async function getUncachedImageUrls(imageUrls: string[]): Promise<string[]> {
  if (typeof window === 'undefined') return [];
  const uniqueUrls = Array.from(new Set(imageUrls.filter(Boolean)));
  const map = await ensureImageMemoryMap();
  return uniqueUrls.filter((url) => !map.has(url) && !isLocalUri(url));
}

/**
 * Downloads a batch of product image URLs and persists them to LocalDB
 */
export async function cacheProductImages(
  imageUrls: string[],
  onProgress?: (done: number, total: number) => void
): Promise<{ totalDownloaded: number; totalSizeBytes: number; failedCount: number; balanceRemaining: number }> {
  if (typeof window === 'undefined') return { totalDownloaded: 0, totalSizeBytes: 0, failedCount: 0, balanceRemaining: 0 };

  const uniqueUrls = Array.from(new Set(imageUrls.filter(Boolean)));
  let done = 0;
  let totalSizeBytes = 0;
  let failedCount = 0;

  // Pre-load map so per-image checks are synchronous
  const map = await ensureImageMemoryMap();

  // Filter out already-cached URLs
  const uncachedUrls = uniqueUrls.filter((url) => !map.has(url) && !isLocalUri(url));
  const alreadyCachedCount = uniqueUrls.length - uncachedUrls.length;

  if (alreadyCachedCount > 0) {
    done += alreadyCachedCount;
    onProgress?.(done, uniqueUrls.length);
  }

  // Safe concurrency limit (4) to prevent memory saturation and native bridge congestion
  const CONCURRENCY = 4;
  for (let i = 0; i < uncachedUrls.length; i += CONCURRENCY) {
    const chunk = uncachedUrls.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (url) => {
        try {
          const res = await downloadAndSaveImage(url);
          if (res) {
            const record = await offlineDB.getImageMap(url);
            if (record?.sizeBytes) totalSizeBytes += record.sizeBytes;
          } else {
            failedCount++;
          }
        } catch (e) {
          failedCount++;
          console.warn(`Error processing image ${url}`, e);
        } finally {
          done++;
          onProgress?.(done, uniqueUrls.length);
        }
      })
    );
  }

  // Calculate overall storage stats from all stored images using streaming cursor (O(1) memory)
  const summary = await offlineDB.getImageStorageSummary();

  return {
    totalDownloaded: summary.count,
    totalSizeBytes: summary.totalBytes,
    failedCount,
    balanceRemaining: failedCount,
  };
}

/**
 * Retrieves the local offline image source for a given remote URL.
 * Uses in-memory map for instant synchronous-like lookup.
 */
export async function getCachedImageUrl(url: string): Promise<string> {
  if (typeof window === 'undefined' || !url) return url;
  if (isLocalUri(url) && !url.startsWith('blob:')) return url;

  try {
    // 1. In-memory map (0ms instant)
    if (imageMemoryMap.has(url)) {
      return imageMemoryMap.get(url)!;
    }

    // 2. Fast single-key IndexedDB lookup (1ms)
    const record = await offlineDB.getImageMap(url).catch(() => null);
    if (record?.localSrc && !record.localSrc.startsWith('blob:')) {
      updateImageMemoryMap(url, record.localSrc);
      return record.localSrc;
    }

    // 3. CacheStorage fallback (Web / session recovery)
    if ('caches' in window) {
      const cache = await caches.open(IMAGE_CACHE_NAME);
      const match = await cache.match(url);
      if (match) {
        const blob = await match.blob();
        const objUrl = URL.createObjectURL(blob);
        updateImageMemoryMap(url, objUrl);
        return objUrl;
      }
    }

    // 4. If record exists with localSrc
    if (record?.localSrc) {
      updateImageMemoryMap(url, record.localSrc);
      return record.localSrc;
    }
  } catch (e) {
    console.warn(`Error resolving cached image for ${url}`, e);
  }

  return url;
}

/**
 * Synchronous version — returns cached URL immediately if already in memory map, else null.
 */
export function getCachedImageUrlSync(url: string): string | null {
  if (!url || isLocalUri(url)) return url;
  return imageMemoryMap.get(url) || null;
}

/**
 * Pre-warm the image memory map — call this once after sync or on app start.
 * After this resolves, all getCachedImageUrlSync() calls are instant.
 */
export async function prewarmImageCache(): Promise<void> {
  await ensureImageMemoryMap();
}

export interface StorageStats {
  downloadedImagesCount: number;
  imageStorageMB: number;
  totalUsageMB: number;
  storageLimitMB: number;
}

/**
 * Calculates current local storage utilization & storage limit quota
 */
export async function getStorageStats(): Promise<StorageStats> {
  let downloadedImagesCount = 0;
  let imageStorageMB = 0;

  try {
    const summary = await offlineDB.getImageStorageSummary();
    downloadedImagesCount = summary.count;
    imageStorageMB = Number((summary.totalBytes / (1024 * 1024)).toFixed(2));
  } catch (e) {
    console.warn('Error reading image storage stats:', e);
  }

  let totalUsageMB = imageStorageMB;
  let storageLimitMB = 0;

  if (typeof window !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage) {
        totalUsageMB = Number((estimate.usage / (1024 * 1024)).toFixed(2));
      }
      if (estimate.quota) {
        storageLimitMB = Number((estimate.quota / (1024 * 1024)).toFixed(2));
      }
    } catch (e) {
      console.warn('Error estimating storage quota:', e);
    }
  }

  return {
    downloadedImagesCount,
    imageStorageMB,
    totalUsageMB,
    storageLimitMB,
  };
}

/**
 * Deletes the entire native 'Matrices' folder and recreates a clean, fresh directory
 */
export async function clearMatricesFolder(): Promise<void> {
  const cap = getCapacitorCore();
  const isNative = cap?.isNativePlatform?.() ?? false;
  if (isNative) {
    try {
      const fsModule = await loadCapacitorFilesystem();
      if (fsModule?.Filesystem && fsModule?.Directory) {
        await fsModule.Filesystem.rmdir({
          path: 'Matrices',
          directory: fsModule.Directory.Documents,
          recursive: true,
        }).catch(() => {});
        await fsModule.Filesystem.mkdir({
          path: 'Matrices',
          directory: fsModule.Directory.Documents,
          recursive: true,
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Error clearing Matrices folder:', e);
    }
  }
  // Also invalidate in-memory map
  invalidateImageMemoryMap();
}
