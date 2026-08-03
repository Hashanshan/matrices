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

// ── In-memory image URL map (populated once on first access) ─────────────────
let imageMemoryMap: Map<string, string> | null = null;
let imageMemoryMapLoading = false;
let imageMemoryMapCallbacks: Array<() => void> = [];

/** Load all image_map records from IndexedDB into memory (called once) */
async function ensureImageMemoryMap(): Promise<Map<string, string>> {
  if (imageMemoryMap) return imageMemoryMap;

  if (imageMemoryMapLoading) {
    // Wait for the in-progress load
    return new Promise((resolve) => {
      imageMemoryMapCallbacks.push(() => resolve(imageMemoryMap!));
    });
  }

  imageMemoryMapLoading = true;
  try {
    const records = await offlineDB.getAllImageMaps().catch(() => [] as ImageMapRecord[]);
    imageMemoryMap = new Map(records.map((r) => [r.url, r.localSrc]));
  } catch {
    imageMemoryMap = new Map();
  } finally {
    imageMemoryMapLoading = false;
    imageMemoryMapCallbacks.forEach((cb) => cb());
    imageMemoryMapCallbacks = [];
  }

  return imageMemoryMap;
}

// Auto-warm in-memory image map immediately on module load in browser
if (typeof window !== 'undefined') {
  ensureImageMemoryMap().catch(() => {});
}

/** Invalidate the in-memory map so it gets rebuilt on next access */
export function invalidateImageMemoryMap(): void {
  imageMemoryMap = null;
}

/** Add/update a single entry in the in-memory map without rebuilding */
function updateImageMemoryMap(url: string, localSrc: string): void {
  if (imageMemoryMap) {
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
 */
export async function downloadAndSaveImage(url: string): Promise<string | null> {
  if (!url || isLocalUri(url)) return url;

  // Check in-memory map first (O(1))
  const map = await ensureImageMemoryMap();
  const cached = map.get(url);
  if (cached) return cached;

  const cap = getCapacitorCore();
  const isNative = cap?.isNativePlatform?.() ?? false;
  const targetFetchUrl = resolveApiUrl(url);

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
        const base64Data = await blobToBase64(blob);
        const fileName = hashUrl(url);

        const writeResult = await fsModule.Filesystem.writeFile({
          path: `Matrices/${fileName}`,
          data: base64Data,
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

    // Web / Fallback: Save as Data URL in IndexedDB & CacheStorage
    const base64Data = await blobToBase64(blob);
    const record: ImageMapRecord = {
      url,
      localSrc: base64Data,
      sizeBytes,
      updatedAt: new Date().toISOString(),
    };

    await offlineDB.saveImageMap(record);
    updateImageMemoryMap(url, base64Data);

    // Also populate CacheStorage as additional HTTP fallback
    if ('caches' in window) {
      try {
        const cache = await caches.open(IMAGE_CACHE_NAME);
        await cache.put(url, new Response(blob));
      } catch (e) {
        console.warn('CacheStorage put warning:', e);
      }
    }

    return base64Data;
  } catch (err) {
    console.warn(`Failed to download image ${url}:`, err);
    return null;
  }
}

/**
 * Downloads a batch of product image URLs and persists them to LocalDB
 */
export async function cacheProductImages(
  imageUrls: string[],
  onProgress?: (done: number, total: number) => void
): Promise<{ totalDownloaded: number; totalSizeBytes: number }> {
  if (typeof window === 'undefined') return { totalDownloaded: 0, totalSizeBytes: 0 };

  const uniqueUrls = Array.from(new Set(imageUrls.filter(Boolean)));
  let done = 0;
  let totalSizeBytes = 0;

  // Pre-load map so per-image checks are synchronous
  const map = await ensureImageMemoryMap();

  // Filter out already-cached URLs
  const uncachedUrls = uniqueUrls.filter((url) => !map.has(url) && !isLocalUri(url));
  const alreadyCachedCount = uniqueUrls.length - uncachedUrls.length;

  if (alreadyCachedCount > 0) {
    done += alreadyCachedCount;
    onProgress?.(done, uniqueUrls.length);
  }

  const CONCURRENCY = 12;
  for (let i = 0; i < uncachedUrls.length; i += CONCURRENCY) {
    const chunk = uncachedUrls.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (url) => {
        try {
          const res = await downloadAndSaveImage(url);
          if (res) {
            const record = await offlineDB.getImageMap(url);
            if (record?.sizeBytes) totalSizeBytes += record.sizeBytes;
          }
        } catch (e) {
          console.warn(`Error processing image ${url}`, e);
        } finally {
          done++;
          onProgress?.(done, uniqueUrls.length);
        }
      })
    );
  }

  // Calculate overall storage stats from all stored images in LocalDB
  const allMaps = await offlineDB.getAllImageMaps();
  const grandTotalSize = allMaps.reduce((acc, m) => acc + (m.sizeBytes || 0), 0);

  return {
    totalDownloaded: allMaps.length,
    totalSizeBytes: grandTotalSize,
  };
}

/**
 * Retrieves the local offline image source for a given remote URL.
 * Uses in-memory map for instant synchronous-like lookup.
 */
export async function getCachedImageUrl(url: string): Promise<string> {
  if (typeof window === 'undefined' || !url) return url;
  if (isLocalUri(url)) return url;

  try {
    // Try in-memory map first (fast path)
    const map = await ensureImageMemoryMap();
    const cached = map.get(url);
    if (cached) return cached;

    // CacheStorage fallback
    if ('caches' in window) {
      const cache = await caches.open(IMAGE_CACHE_NAME);
      const match = await cache.match(url);
      if (match) {
        const blob = await match.blob();
        return URL.createObjectURL(blob);
      }
    }
  } catch (e) {
    console.warn(`Error resolving cached image for ${url}`, e);
  }

  return url;
}

/**
 * Synchronous version — returns cached URL immediately if already in memory map, else null.
 * Use this when you need zero-latency image resolution (e.g. list renders).
 */
export function getCachedImageUrlSync(url: string): string | null {
  if (!url || isLocalUri(url)) return url;
  if (!imageMemoryMap) return null; // Map not loaded yet
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
