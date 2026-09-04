/**
 * Offline Image Storage Engine
 * Downloads product & category images directly into native local file storage (Capacitor Filesystem in APK)
 * or Base64 / Blob in IndexedDB (Web), eliminating reliance on volatile HTTP cache.
 *
 * KEY IMPROVEMENT: Builds an in-memory Map<url, localSrc> on first access so all subsequent
 * getCachedImageUrlSync() calls are O(1) synchronous lookups instead of async IndexedDB queries.
 */

import { offlineDB, ImageMapRecord } from './indexed-db';
import { resolveApiUrl, getAuthToken } from '../utils';

const IMAGE_CACHE_NAME = 'matrices-product-images-v1';

// ── In-memory image URL map for zero-latency synchronous lookups ─────────────────
const imageMemoryMap: Map<string, string> = new Map();
let isPrewarmingPromise: Promise<Map<string, string>> | null = null;
let isPrewarmed = false;

/** Returns true if the URL is already a local/native URI that doesn't need a remote lookup */
export function isLocalUri(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('capacitor://') ||
    url.startsWith('file://') ||
    url.startsWith('http://localhost') ||
    url.startsWith('https://localhost')
  );
}

/** Extracts the clean relative path from any full URL to support flexible key matching */
export function normalizeUrlKey(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (isLocalUri(trimmed)) return trimmed;
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const parsed = new URL(trimmed);
      return parsed.pathname;
    }
  } catch {}
  return trimmed;
}

/** Add/update an entry across all its canonical key variations in memory */
export function registerInImageMemoryMap(url: string, localSrc: string): void {
  if (!url || !localSrc) return;
  imageMemoryMap.set(url, localSrc);

  const resolved = resolveApiUrl(url);
  if (resolved && resolved !== url) {
    imageMemoryMap.set(resolved, localSrc);
  }

  const normalized = normalizeUrlKey(url);
  if (normalized && normalized !== url) {
    imageMemoryMap.set(normalized, localSrc);
  }

  // Strip query parameters for query-independent matching
  const noQueryUrl = url.split('?')[0];
  if (noQueryUrl && noQueryUrl !== url) {
    imageMemoryMap.set(noQueryUrl, localSrc);
  }
  if (resolved) {
    const noQueryResolved = resolved.split('?')[0];
    if (noQueryResolved && noQueryResolved !== resolved) {
      imageMemoryMap.set(noQueryResolved, localSrc);
    }
  }
}

/** Pre-warm helper that loads mapped image references into memory */
async function ensureImageMemoryMap(): Promise<Map<string, string>> {
  if (typeof window === 'undefined') return imageMemoryMap;
  if (isPrewarmed && imageMemoryMap.size > 0) return imageMemoryMap;
  if (isPrewarmingPromise) return isPrewarmingPromise;

  isPrewarmingPromise = (async () => {
    try {
      // 1. Load ImageMapRecords from IndexedDB in bulk (one single transaction)
      const records = await offlineDB.getAllImageMaps().catch(() => []);
      const cap = await getCapacitorCore();
      const isNative = cap?.isNativePlatform?.() ?? false;

      for (const rec of records) {
        if (!rec?.url) continue;

        // A. If an actual binary Blob was stored in IndexedDB, generate an active session Object URL
        if (rec.blob && rec.blob instanceof Blob) {
          try {
            const objUrl = URL.createObjectURL(rec.blob);
            registerInImageMemoryMap(rec.url, objUrl);
            continue;
          } catch (e) {
            console.warn('Error creating object URL from stored blob:', e);
          }
        }

        // B. If native Capacitor URI or Base64 data URL
        if (rec.localSrc) {
          if (
            rec.localSrc.startsWith('data:') ||
            rec.localSrc.startsWith('capacitor://') ||
            rec.localSrc.startsWith('file://') ||
            rec.localSrc.startsWith('http://localhost') ||
            rec.localSrc.startsWith('https://localhost') ||
            (isNative && !rec.localSrc.startsWith('blob:'))
          ) {
            registerInImageMemoryMap(rec.url, rec.localSrc);
            continue;
          }
        }
      }

      isPrewarmed = true;
    } catch (err) {
      console.warn('Failed to pre-warm image memory map:', err);
    } finally {
      isPrewarmingPromise = null;
    }
    return imageMemoryMap;
  })();

  return isPrewarmingPromise;
}

/** Invalidate the in-memory map */
export function invalidateImageMemoryMap(): void {
  imageMemoryMap.clear();
  isPrewarmed = false;
  isPrewarmingPromise = null;
}

/** Evict a single URL from memory map and IndexedDB cache (e.g. if local file failed to load) */
export async function evictFromImageMemoryMap(url: string): Promise<void> {
  if (!url) return;
  imageMemoryMap.delete(url);
  const resolved = resolveApiUrl(url);
  if (resolved) imageMemoryMap.delete(resolved);
  const normalized = normalizeUrlKey(url);
  if (normalized) imageMemoryMap.delete(normalized);

  try {
    await offlineDB.deleteById('image_map', url);
    if (resolved && resolved !== url) await offlineDB.deleteById('image_map', resolved);
    if (normalized && normalized !== url) await offlineDB.deleteById('image_map', normalized);
  } catch {}
}

// ── Capacitor / Native helpers ────────────────────────────────────────────────

async function loadCapacitorFilesystem(): Promise<any> {
  if (typeof window === 'undefined') return null;
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    return { Filesystem, Directory };
  } catch {
    return null;
  }
}

async function getCapacitorCore(): Promise<any> {
  if (typeof window === 'undefined') return null;
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor;
  } catch {
    return (window as any).Capacitor || null;
  }
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
  if (!url || typeof url !== 'string' || isLocalUri(url)) return url;

  // Check in-memory map first (O(1))
  const cached = getCachedImageUrlSync(url);
  if (cached) return cached;

  const cap = await getCapacitorCore();
  const isNative = cap?.isNativePlatform?.() ?? false;
  const targetFetchUrl = resolveApiUrl(url);

  // DO NOT send custom Authorization headers to Cloudinary or external media CDNs.
  // Sending Authorization headers triggers CORS preflight OPTIONS which Cloudinary/S3 reject.
  const isExternalMediaHost =
    targetFetchUrl.includes('cloudinary.com') ||
    targetFetchUrl.includes('amazonaws.com') ||
    targetFetchUrl.includes('res.cloudinary') ||
    /\.(webp|jpg|jpeg|png|gif|svg|avif)($|\?)/i.test(targetFetchUrl);

  const token = !isExternalMediaHost ? getAuthToken() : null;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 15000) : null;

    try {
      const response = await fetch(targetFetchUrl, {
        headers,
        mode: 'cors',
        cache: 'no-cache',
        signal: controller?.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const sizeBytes = blob.size;

      if (sizeBytes === 0) {
        throw new Error('Downloaded empty image blob');
      }

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

          const nativeUri = cap?.convertFileSrc ? cap.convertFileSrc(writeResult.uri) : writeResult.uri;

          const record: ImageMapRecord = {
            url,
            localSrc: nativeUri,
            blob,
            sizeBytes,
            updatedAt: new Date().toISOString(),
          };

          await offlineDB.saveImageMap(record);
          registerInImageMemoryMap(url, nativeUri);
          return nativeUri;
        }
      }

      // Web / Browser mode: Store in CacheStorage (disk-backed binary) and session Object URL
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          const cache = await caches.open(IMAGE_CACHE_NAME);
          await cache.put(url, new Response(blob.slice(0), {
            headers: { 'Content-Type': blob.type || 'image/jpeg' },
          }));
          if (targetFetchUrl && targetFetchUrl !== url) {
            await cache.put(targetFetchUrl, new Response(blob.slice(0), {
              headers: { 'Content-Type': blob.type || 'image/jpeg' },
            }));
          }
        } catch (e) {
          console.warn('CacheStorage put warning:', e);
        }
      }

      // In IndexedDB, store binary blob directly. Object URL is created for active in-memory pointer.
      const objectUrl = URL.createObjectURL(blob);
      const record: ImageMapRecord = {
        url,
        localSrc: objectUrl,
        blob,
        sizeBytes,
        updatedAt: new Date().toISOString(),
      };

      await offlineDB.saveImageMap(record);
      registerInImageMemoryMap(url, objectUrl);

      return objectUrl;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);

      if (attempt < retries) {
        // Wait 350ms before retry
        await new Promise((r) => setTimeout(r, 350));
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
  await ensureImageMemoryMap();
  return uniqueUrls.filter((url) => !getCachedImageUrlSync(url) && !isLocalUri(url));
}

/**
 * Downloads a batch of product and shop image URLs and persists them to LocalDB
 */
export async function cacheProductImages(
  imageUrls: string[],
  onProgress?: (done: number, total: number) => void
): Promise<{ totalDownloaded: number; totalSizeBytes: number; failedCount: number; balanceRemaining: number }> {
  if (typeof window === 'undefined') return { totalDownloaded: 0, totalSizeBytes: 0, failedCount: 0, balanceRemaining: 0 };

  const uniqueUrls = Array.from(new Set(imageUrls.filter((u) => Boolean(u && typeof u === 'string' && u.trim().length > 0 && !isLocalUri(u)))));
  let done = 0;
  let totalSizeBytes = 0;
  let failedCount = 0;

  // Pre-load map so per-image checks are synchronous
  await ensureImageMemoryMap();

  // Filter out already-cached URLs
  const uncachedUrls = uniqueUrls.filter((url) => !getCachedImageUrlSync(url) && !isLocalUri(url));
  const alreadyCachedCount = uniqueUrls.length - uncachedUrls.length;

  if (alreadyCachedCount > 0) {
    done += alreadyCachedCount;
    onProgress?.(done, uniqueUrls.length);
  }

  // Optimized concurrency pool (8 concurrent workers)
  const CONCURRENCY = 8;
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
 * Uses in-memory map for instant synchronous lookup with multi-key normalization and IndexedDB fallback.
 */
export async function getCachedImageUrl(url: string): Promise<string> {
  if (typeof window === 'undefined' || !url) return url;
  if (isLocalUri(url)) return url;

  try {
    // 1. In-memory map (0ms instant)
    const syncMatch = getCachedImageUrlSync(url);
    if (syncMatch) return syncMatch;

    // Ensure memory map is populated
    await ensureImageMemoryMap();
    const postPrewarmMatch = getCachedImageUrlSync(url);
    if (postPrewarmMatch) return postPrewarmMatch;

    // 2. Fast single-key IndexedDB lookup with key variations
    const keysToCheck = [
      url,
      resolveApiUrl(url),
      normalizeUrlKey(url),
      url.split('?')[0],
    ].filter(Boolean);

    for (const key of keysToCheck) {
      const record = await offlineDB.getImageMap(key).catch(() => null);
      if (record) {
        if (record.blob && record.blob instanceof Blob) {
          const objUrl = URL.createObjectURL(record.blob);
          registerInImageMemoryMap(url, objUrl);
          return objUrl;
        }
        if (record.localSrc && isLocalUri(record.localSrc)) {
          registerInImageMemoryMap(url, record.localSrc);
          return record.localSrc;
        }
      }
    }

    // 3. CacheStorage fallback (Web / session recovery)
    if ('caches' in window) {
      const cache = await caches.open(IMAGE_CACHE_NAME);
      for (const key of keysToCheck) {
        const match = await cache.match(key);
        if (match) {
          const blob = await match.blob();
          const objUrl = URL.createObjectURL(blob);
          registerInImageMemoryMap(url, objUrl);
          return objUrl;
        }
      }
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
  if (!url) return null;
  if (isLocalUri(url)) return url;

  return (
    imageMemoryMap.get(url) ||
    imageMemoryMap.get(resolveApiUrl(url)) ||
    imageMemoryMap.get(normalizeUrlKey(url)) ||
    imageMemoryMap.get(url.split('?')[0]) ||
    null
  );
}

/**
 * Pre-warm the image memory map — call this once after sync or on app start.
 * After this resolves, all getCachedImageUrlSync() calls are instant.
 */
export async function prewarmImageCache(): Promise<void> {
  await ensureImageMemoryMap();
}

/**
 * Preload and decode a list of image URLs in GPU memory for instant display when swiping
 */
export function preloadAdjacentImages(imageUrls: string[]): void {
  if (typeof window === 'undefined' || !Array.isArray(imageUrls)) return;

  imageUrls.filter(Boolean).slice(0, 12).forEach(async (url) => {
    try {
      const resolvedSrc = getCachedImageUrlSync(url) || await getCachedImageUrl(url);
      if (!resolvedSrc) return;

      const img = new Image();
      img.src = resolvedSrc;
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {});
      }
    } catch {}
  });
}

// Low priority background prewarm on client import
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      ensureImageMemoryMap().catch(() => {});
    }, { timeout: 3000 });
  } else {
    setTimeout(() => {
      ensureImageMemoryMap().catch(() => {});
    }, 500);
  }
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
  const cap = await getCapacitorCore();
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

  // Also clear web CacheStorage images
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      await caches.delete(IMAGE_CACHE_NAME);
    } catch (e) {
      console.warn('Error deleting image CacheStorage:', e);
    }
  }

  // Invalidate in-memory map and clear IndexedDB image_map store
  invalidateImageMemoryMap();
  await offlineDB.clear('image_map').catch(() => {});
}
