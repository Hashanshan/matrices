'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { offlineDB, SyncMetadata } from '../offline/indexed-db';
import { cacheProductImages, clearMatricesFolder, prewarmImageCache, invalidateImageMemoryMap, getUncachedImageUrls } from '../offline/image-cache';
import { invalidateProductIndex } from '../offline/offline-search';
import { NativeAdapter } from '../../mobile/bridge/native-adapter';
import { resolveApiUrl, getAuthToken } from '../utils';
import SyncProgressModal from '@/components/sync-progress-modal';
import PinModal from '@/components/pin-modal';
import { useAuth } from './auth-context';
import { mutate } from 'swr';
import {
  SyncQueueItem,
  getSyncQueue,
  processSyncQueueSequential,
  retrySyncQueue,
  deleteSyncQueueItem,
  clearSyncQueue,
  downloadFailureReportPDF,
  downloadFailureReportCSV,
  downloadFailureReportJSON,
} from '../offline/pending-sync';
import Swal from 'sweetalert2';

interface SyncContextType {
  isSyncing: boolean;
  progress: number;
  syncStatusText: string;
  lastSyncedAt: string | null;
  isOffline: boolean;
  meta: SyncMetadata | null;
  isIncompleteSync: boolean;
  
  // Sync Queue management states
  queueItems: SyncQueueItem[];
  pendingQueueCount: number;
  failedQueueCount: number;
  isPushing: boolean;
  pushStatusText: string;
  
  // Functions
  triggerSync: (syncMode?: 'full' | 'resume') => Promise<boolean>;
  executeSync: (syncMode?: 'full' | 'resume') => Promise<boolean>;
  resumeSync: () => Promise<boolean>;
  pushChanges: () => Promise<boolean>;
  retryFailedPush: () => Promise<boolean>;
  deleteSyncData: () => Promise<boolean>;
  deleteQueueItem: (id: string) => Promise<void>;
  clearAllQueue: () => Promise<void>;
  downloadReport: (format: 'pdf' | 'csv' | 'json', userName?: string) => void;
  checkPermissions: () => Promise<void>;
  refreshQueue: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isPinVerified, user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState('Idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [meta, setMeta] = useState<SyncMetadata | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  
  // Queue state
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatusText, setPushStatusText] = useState('');

  // Resolves after user dismisses PIN modal
  const afterPinResolve = useRef<((ok: boolean) => void) | null>(null);

  const refreshQueue = useCallback(async () => {
    try {
      const items = await getSyncQueue();
      setQueueItems(items);
    } catch (err) {
      console.warn('Failed to load queue in SyncContext:', err);
    }
  }, []);

  // Initialize network status listener, metadata & queue listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleQueueChange = () => refreshQueue();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('matrices-sync-queue-updated', handleQueueChange);

    // Initial load
    offlineDB.getMeta().then((m) => {
      if (m) {
        setMeta(m);
        setLastSyncedAt(m.lastSyncedAt);
      }
    }).catch(console.error);

    refreshQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('matrices-sync-queue-updated', handleQueueChange);
    };
  }, [refreshQueue]);

  const checkPermissions = useCallback(async () => {
    await NativeAdapter.requestAllPermissions();
  }, []);

  const pendingQueueCount = queueItems.filter((i) => i.status === 'PENDING').length;
  const failedQueueCount = queueItems.filter((i) => i.status === 'FAILED').length;



  /**
   * Execute Push Process: Sequential FIFO processing
   * Halts immediately on failure
   */
  const pushChanges = useCallback(async (): Promise<boolean> => {
    if (isPushing) return false;
    if (typeof window !== 'undefined' && !navigator.onLine) {
      Swal.fire({
        icon: 'warning',
        title: 'Offline Mode Active',
        text: 'Cannot push changes while offline. Please connect to internet.',
        confirmButtonColor: '#0f172a',
      });
      return false;
    }

    const unpushed = queueItems.filter((i) => i.status === 'PENDING' || i.status === 'FAILED');
    if (unpushed.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Queue Empty',
        text: 'No local changes pending to push.',
        confirmButtonColor: '#0f172a',
      });
      return true;
    }

    setIsPushing(true);
    setPushStatusText('Preparing offline changes...');

    try {
      const result = await processSyncQueueSequential((step, total, item, status, msg) => {
        setPushStatusText(msg || `Processing item ${step} of ${total}...`);
      });

      await refreshQueue();

      if (result.failedCount > 0 && result.stoppedAt) {
        const item = result.stoppedAt;
        Swal.fire({
          icon: 'error',
          title: 'Push Failed',
          html: `
            <div style="text-align: left; font-size: 13px;" class="space-y-2">
              <p><strong>Operation:</strong> ${item.operation} ${item.entity}</p>
              <p><strong>ID:</strong> <code>${item.entityId}</code></p>
              <p><strong>Reason:</strong> <span style="color: #dc2626; font-weight: 700;">${result.errorReason || item.errorMessage}</span></p>
              <hr class="my-2 border-gray-200"/>
              <p class="text-xs text-gray-500">Processing stopped immediately to preserve queue order. Fix the issue or retry failed item.</p>
            </div>
          `,
          confirmButtonColor: '#0f172a',
        });
        return false;
      }

      Swal.fire({
        icon: 'success',
        title: 'Push Complete!',
        text: `Successfully synced ${result.successCount} local offline operations to the server.`,
        confirmButtonColor: '#0f172a',
      });
      return true;
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Push Aborted',
        text: err?.message || 'Error processing sync queue',
        confirmButtonColor: '#0f172a',
      });
      return false;
    } finally {
      setIsPushing(false);
      setPushStatusText('');
      refreshQueue();
    }
  }, [isPushing, queueItems, refreshQueue]);

  /**
   * Retry failed items in push queue
   */
  const retryFailedPush = useCallback(async (): Promise<boolean> => {
    if (isPushing) return false;
    setIsPushing(true);
    setPushStatusText('Retrying failed operations...');

    try {
      const result = await retrySyncQueue((step, total, item, status, msg) => {
        setPushStatusText(msg || `Retrying item ${step} of ${total}...`);
      });

      await refreshQueue();

      if (result.failedCount > 0 && result.stoppedAt) {
        const item = result.stoppedAt;
        Swal.fire({
          icon: 'error',
          title: 'Push Retry Failed',
          html: `
            <div style="text-align: left; font-size: 13px;">
              <p><strong>Operation:</strong> ${item.operation} ${item.entity}</p>
              <p><strong>ID:</strong> <code>${item.entityId}</code></p>
              <p><strong>Reason:</strong> <span style="color: #dc2626; font-weight: 700;">${result.errorReason || item.errorMessage}</span></p>
            </div>
          `,
          confirmButtonColor: '#0f172a',
        });
        return false;
      }

      Swal.fire({
        icon: 'success',
        title: 'Retry Successful!',
        text: 'All remaining operations pushed to server.',
        confirmButtonColor: '#0f172a',
      });
      return true;
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Retry Failed',
        text: err?.message || 'Failed to retry queue',
        confirmButtonColor: '#0f172a',
      });
      return false;
    } finally {
      setIsPushing(false);
      setPushStatusText('');
      refreshQueue();
    }
  }, [isPushing, refreshQueue]);

  /**
   * Delete all cached catalog data, products, categories, subcategories, images, and queue.
   * DOES NOT delete user token or user authentication session.
   */
  const deleteSyncData = useCallback(async (): Promise<boolean> => {
    if (isSyncing || isPushing) return false;

    const unpushed = queueItems.filter((i) => i.status === 'PENDING' || i.status === 'FAILED');
    if (unpushed.length > 0) {
      const confirmChoice = await Swal.fire({
        icon: 'warning',
        title: 'Unpushed Changes Found!',
        html: `
          <div style="text-align: left; font-size: 13px;">
            <p style="font-weight: 700; color: #dc2626;">You have ${unpushed.length} pending local change(s) in your SyncQueue.</p>
            <p style="margin-top: 8px;">Deleting sync data will erase these unpushed changes. Would you like to push them to the server first?</p>
          </div>
        `,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Push & Delete Data',
        denyButtonText: 'Delete Anyway',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#059669',
        denyButtonColor: '#dc2626',
      });

      if (confirmChoice.isDismissed) return false;

      if (confirmChoice.isConfirmed) {
        const pushedOk = await pushChanges();
        if (!pushedOk) return false;
      }
    } else {
      const confirmDelete = await Swal.fire({
        icon: 'warning',
        title: 'Delete All Cached Data?',
        text: 'This will remove all downloaded products, categories, images, and offline data. Your user login session will remain active.',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete Cached Data',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc2626',
      });

      if (!confirmDelete.isConfirmed) return false;
    }

    try {
      // Clear offline DB tables & queue
      await offlineDB.clearAllData();
      await clearSyncQueue();
      await clearMatricesFolder();

      // Clear web CacheStorage images
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          await caches.delete('matrices-product-images-v1');
        } catch {}
      }

      // Invalidate memory maps
      invalidateImageMemoryMap();
      invalidateProductIndex();

      setMeta(null);
      setLastSyncedAt(null);
      await refreshQueue();

      if (typeof window !== 'undefined') {
        localStorage.setItem('matrices_data_mode', 'online');
        localStorage.removeItem('matrices_last_synced_user_email');
        localStorage.removeItem('matrices_last_synced_user_name');
        window.dispatchEvent(new Event('matrices-data-mode-change'));
        window.dispatchEvent(new Event('matrices-sync-stats-updated'));
      }

      Swal.fire({
        icon: 'success',
        title: 'Cached Data Deleted!',
        text: 'All offline products, categories, and images have been deleted. User login session remains active.',
        confirmButtonColor: '#0f172a',
      });

      return true;
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: err?.message || 'Error deleting cached data',
        confirmButtonColor: '#0f172a',
      });
      return false;
    }
  }, [isSyncing, isPushing, queueItems, pushChanges, refreshQueue]);

  /**
   * Execute Sync (Download fresh catalog or resume balance from server)
   * syncMode: 'full' (wipe & clean download) | 'resume' (continue & finish balance without wiping existing data)
   */
  const executeSync = useCallback(async (syncMode: 'full' | 'resume' = 'full'): Promise<boolean> => {
    // RULE ENFORCEMENT: Check pending queue before proceeding
    const items = await getSyncQueue();
    const pendingOrFailed = items.filter((i) => i.status === 'PENDING' || i.status === 'FAILED');

    if (pendingOrFailed.length > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sync Blocked',
        html: `
          <div style="text-align: left; font-size: 13px;">
            <p style="font-weight: 700; color: #b45309;">Cannot sync. Please push all local changes first.</p>
            <p style="margin-top: 8px;">You have <strong>${pendingOrFailed.length}</strong> pending or failed operations in your SyncQueue. Uploading catalog now would overwrite local edits.</p>
          </div>
        `,
        confirmButtonColor: '#0f172a',
      });
      return false;
    }

    setIsSyncing(true);
    setProgress(5);
    setSyncStatusText('Requesting storage permission...');

    let wakeLock: any = null;
    if (typeof navigator !== 'undefined' && 'wakeLock' in (navigator as any)) {
      try {
        wakeLock = await (navigator as any).wakeLock.request('screen');
      } catch (e) {
        console.warn('WakeLock not supported or denied:', e);
      }
    }

    try {
      const { storage } = await NativeAdapter.requestAllPermissions();
      if (!storage.granted) {
        setSyncStatusText('Storage permission denied – sync aborted.');
        setIsSyncing(false);
        return false;
      }

      // Check if we can do a fast balance resume (if local products & categories already exist in IndexedDB)
      if (syncMode === 'resume') {
        const localProducts = await offlineDB.getAll<any>('products').catch(() => []);
        const localCats = await offlineDB.getAll<any>('categories').catch(() => []);
        const localSubcats = await offlineDB.getAll<any>('subcategories').catch(() => []);
        const localShops = await offlineDB.getAll<any>('shops').catch(() => []);
        const localOrders = await offlineDB.getAll<any>('orders').catch(() => []);

        if (localProducts.length > 0) {
          setProgress(50);
          setSyncStatusText('Scanning offline image cache for balance images...');

          const allImageUrls: string[] = [
            ...localCats.map((c: any) => c.image),
            ...localSubcats.map((s: any) => s.image),
            ...localProducts.map((p: any) => p.imageUrl || p.image),
            ...localProducts.flatMap((p: any) => p.images || []),
            ...localShops.map((s: any) => s.imageUrl),
          ].filter((url): url is string => Boolean(url && typeof url === 'string' && url.trim().length > 0));

          const uniqueImageUrls = Array.from(new Set(allImageUrls));
          const uncachedUrls = await getUncachedImageUrls(uniqueImageUrls);

          if (uncachedUrls.length === 0) {
            setProgress(95);
            setSyncStatusText('All balance images already cached! Finalizing...');
            await prewarmImageCache().catch(() => {});
            mutate(() => true, undefined, { revalidate: true });

            const allMaps = await offlineDB.getAllImageMaps();
            const grandTotalSize = allMaps.reduce((acc, m) => acc + (m.sizeBytes || 0), 0);
            const imageMB = Number((grandTotalSize / (1024 * 1024)).toFixed(2));

            const newMeta: SyncMetadata = {
              lastSyncedAt: new Date().toISOString(),
              totalProducts: localProducts.length,
              totalCategories: localCats.length,
              totalSubcategories: localSubcats.length,
              totalShops: localShops.length,
              totalOrders: localOrders.length,
              totalImages: allMaps.length,
              imageStorageMB: imageMB,
              isIncomplete: false,
              syncedUserId: user?.id || (user as any)?._id || (user?.email ? String(user.email) : ''),
              syncedUserEmail: user?.email || '',
              syncedUserName: user?.name || '',
            };

            await offlineDB.setMeta(newMeta);
            if (user?.email) {
              await offlineDB.saveSecure('synced_user_email', user.email.toLowerCase().trim());
              if (typeof window !== 'undefined') {
                localStorage.setItem('matrices_last_synced_user_email', user.email);
                if (user?.name) localStorage.setItem('matrices_last_synced_user_name', user.name);
              }
            }
            setMeta(newMeta);
            setLastSyncedAt(newMeta.lastSyncedAt);

            setProgress(100);
            setSyncStatusText('Sync Complete! 100% of data & images available offline.');

            window.dispatchEvent(new Event('matrices-data-mode-change'));
            window.dispatchEvent(new Event('matrices-sync-stats-updated'));
            return true;
          }

          setSyncStatusText(`Downloading balance of ${uncachedUrls.length} offline images (Total ${uniqueImageUrls.length})...`);
          const stats = await cacheProductImages(uniqueImageUrls, (done, total) => {
            const imageProgress = 50 + Math.floor((done / total) * 45);
            setProgress(imageProgress);
            setSyncStatusText(`Downloading balance offline images (${done}/${total})...`);
          });

          setProgress(96);
          setSyncStatusText('Finalizing sync & pre-warming local search & image index...');

          invalidateImageMemoryMap();
          invalidateProductIndex();
          await prewarmImageCache().catch(() => {});
          mutate(() => true, undefined, { revalidate: true });

          const imageMB = Number((stats.totalSizeBytes / (1024 * 1024)).toFixed(2));
          const newMeta: SyncMetadata = {
            lastSyncedAt: new Date().toISOString(),
            totalProducts: localProducts.length,
            totalCategories: localCats.length,
            totalSubcategories: localSubcats.length,
            totalShops: localShops.length,
            totalOrders: localOrders.length,
            totalImages: stats.totalDownloaded > 0 ? stats.totalDownloaded : uniqueImageUrls.length,
            imageStorageMB: imageMB,
            isIncomplete: false,
            syncedUserId: user?.id || (user as any)?._id || (user?.email ? String(user.email) : ''),
            syncedUserEmail: user?.email || '',
            syncedUserName: user?.name || '',
          };

          await offlineDB.setMeta(newMeta);
          if (user?.email) {
            await offlineDB.saveSecure('synced_user_email', user.email.toLowerCase().trim());
            if (typeof window !== 'undefined') {
              localStorage.setItem('matrices_last_synced_user_email', user.email);
              if (user?.name) localStorage.setItem('matrices_last_synced_user_name', user.name);
            }
          }
          setMeta(newMeta);
          setLastSyncedAt(newMeta.lastSyncedAt);

          setProgress(100);
          setSyncStatusText('Sync Complete! 100% of data & images available offline.');

          window.dispatchEvent(new Event('matrices-data-mode-change'));
          window.dispatchEvent(new Event('matrices-sync-stats-updated'));
          return true;
        }
      }

      // Full fresh sync execution
      const token = getAuthToken();
      const headers = {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      };

      setProgress(20);
      setSyncStatusText('Connecting to Magnum Server...');

      const productsUrl = resolveApiUrl('/api/products?limit=5000');
      const filtersUrl = resolveApiUrl('/api/products/filters');
      const shopsUrl = resolveApiUrl('/api/shops?limit=5000');
      const ordersUrl = resolveApiUrl('/api/orders?limit=5000');
      const wishlistUrl = resolveApiUrl('/api/wishlist');

      setProgress(30);
      setSyncStatusText('Syncing Products & Categories...');

      const [productsRes, filtersRes, shopsRes, ordersRes, wishlistRes] = await Promise.allSettled([
        fetch(productsUrl, { headers, cache: 'no-store' }),
        fetch(filtersUrl, { headers, cache: 'no-store' }),
        fetch(shopsUrl, { headers, cache: 'no-store' }),
        fetch(ordersUrl, { headers, cache: 'no-store' }),
        fetch(wishlistUrl, { headers, cache: 'no-store' }),
      ]);

      let products: any[] = [];
      let categories: any[] = [];
      let subcategories: any[] = [];
      let shops: any[] = [];
      let orders: any[] = [];
      let wishlist: any = null;

      if (productsRes.status !== 'fulfilled' || !productsRes.value.ok) {
        const status = productsRes.status === 'fulfilled' ? productsRes.value.status : 'Network error';
        throw new Error(`Failed to download products from server (HTTP ${status})`);
      }

      const productsJson = await productsRes.value.json();
      products = productsJson.data || productsJson.products || (Array.isArray(productsJson) ? productsJson : []);

      if (!Array.isArray(products) || products.length === 0) {
        throw new Error('Server returned 0 products. Sync aborted to preserve local database.');
      }

      if (filtersRes.status === 'fulfilled' && filtersRes.value.ok) {
        const json = await filtersRes.value.json();
        if (Array.isArray(json)) {
          categories = json;
        } else if (Array.isArray(json?.categories)) {
          categories = json.categories;
        } else if (Array.isArray(json?.data)) {
          categories = json.data;
        } else if (Array.isArray(json?.data?.categories)) {
          categories = json.data.categories;
        }

        if (Array.isArray(json?.subcategories)) {
          subcategories = json.subcategories;
        } else if (Array.isArray(json?.data?.subcategories)) {
          subcategories = json.data.subcategories;
        }
      }

      const extractStr = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'string') return val.trim();
        if (Array.isArray(val)) return extractStr(val[0]);
        if (typeof val === 'object') {
          return (val.name || val.categoryName || val.subcategoryName || val.title || val.label || val._id || '').toString().trim();
        }
        return String(val).trim();
      };

      // Fallback: build categories & subcategories from products if filters endpoint was empty or unparseable
      if (categories.length === 0 && products.length > 0) {
        const catMap = new Map<string, { name: string; image: string; subcats: Map<string, { name: string; image: string }> }>();
        products.forEach((p: any) => {
          const catName = extractStr(p.categoryName || p.category?.name || p.category || p.categories).toUpperCase();
          const subName = extractStr(p.subcategoryName || p.subcategory?.name || p.subCategory || p.subcategory || p.subcategories || p.subCategories).toUpperCase();
          const img = p.image || p.imageUrl || (Array.isArray(p.images) && p.images[0] ? p.images[0] : '');

          if (catName) {
            const catKey = catName.toUpperCase();
            if (!catMap.has(catKey)) {
              catMap.set(catKey, { name: catKey, image: img, subcats: new Map() });
            }
            const catEntry = catMap.get(catKey)!;
            if (!catEntry.image && img) catEntry.image = img;

            if (subName) {
              const subKey = subName.toUpperCase();
              if (!catEntry.subcats.has(subKey)) {
                catEntry.subcats.set(subKey, { name: subKey, image: img });
              }
            }
          }
        });

        catMap.forEach((val) => {
          const subsArr: any[] = [];
          val.subcats.forEach((subObj) => subsArr.push(subObj));
          categories.push({
            name: val.name,
            image: val.image,
            subcategories: subsArr,
          });
        });
      }

      setProgress(50);
      setSyncStatusText('Syncing Customer Shops assigned to logged-in salesrep...');
      if (shopsRes.status === 'fulfilled' && shopsRes.value.ok) {
        const json = await shopsRes.value.json();
        shops = json.data || json.shops || (Array.isArray(json) ? json : []);
      }

      setProgress(65);
      setSyncStatusText('Syncing Salesrep Invoices & Orders...');
      if (ordersRes.status === 'fulfilled' && ordersRes.value.ok) {
        const json = await ordersRes.value.json();
        orders = json.orders || json.data || (Array.isArray(json) ? json : []);
      }

      if (wishlistRes.status === 'fulfilled' && wishlistRes.value.ok) {
        wishlist = await wishlistRes.value.json();
      }

      setProgress(78);
      setSyncStatusText(`Saving ${products.length} products, ${shops.length} shops, and ${orders.length} orders offline...`);

      const formattedCategories = categories.map((c: any, idx: number) => {
        const cName = extractStr(c.name || c.categoryName || 'Category').toUpperCase();
        const cImage = c.image || c.imageUrl || c.categoryImage || '';

        const cSubs = (Array.isArray(c.subcategories) ? c.subcategories : []).map((s: any) => {
          if (typeof s === 'string') return { name: s.trim().toUpperCase(), image: '', count: 0 };
          return {
            name: extractStr(s.name || s.subcategoryName).toUpperCase(),
            image: s.image || s.imageUrl || '',
            count: Number(s.count || 0),
          };
        });

        return {
          id: String(c._id || c.id || c.categoryId || `cat_${idx}`),
          name: cName,
          categoryName: cName,
          image: cImage,
          order: c.order ?? idx,
          totalCount: Number(c.totalCount || 0),
          subcategories: cSubs,
        };
      });

      const uniqueSubMap = new Map<string, any>();
      formattedCategories.forEach((cat: any) => {
        cat.subcategories.forEach((sub: any, idx: number) => {
          if (!sub.name) return;
          const key = `${cat.name}>${sub.name}`;
          if (!uniqueSubMap.has(key)) {
            uniqueSubMap.set(key, {
              id: String(sub._id || sub.id || sub.subcategoryId || `subcat_${cat.id}_${idx}`),
              name: sub.name,
              subcategoryName: sub.name,
              category: cat.name,
              categoryName: cat.name,
              categoryId: cat.id,
              image: sub.image || '',
              count: sub.count || 0,
              order: idx,
            });
          }
        });
      });
      const formattedSubcategories = Array.from(uniqueSubMap.values());

      const formattedProducts = products.map((p: any, idx: number) => {
        const catName = extractStr(p.categoryName || p.category?.name || p.category || p.categories).toUpperCase();
        const subName = extractStr(p.subcategoryName || p.subcategory?.name || p.subCategory || p.subcategory || p.subcategories || p.subCategories).toUpperCase();
        const img = p.image || p.imageUrl || (Array.isArray(p.images) && p.images[0] ? p.images[0] : '');
        const priceVal = Number(p.sellPrice || p.price || 0);

        return {
          id: String(p._id || p.id || p.productId || `prod_${idx}`),
          productId: String(p.productId || p._id || p.id || `prod_${idx}`),
          name: String(p.name || p.productName || 'Unnamed Product').toUpperCase(),
          code: p.code || p.productCode || '',
          description: p.description || '',
          price: priceVal,
          sellPrice: priceVal,
          categoryId: String(p.categoryId || p.category?._id || (typeof p.category === 'object' ? p.category?._id : p.category) || ''),
          subcategoryId: String(p.subcategoryId || p.subcategory?._id || (typeof p.subcategory === 'object' ? p.subcategory?._id : p.subcategory) || ''),
          category: catName,
          categoryName: catName,
          categories: catName,
          subcategory: subName,
          subcategoryName: subName,
          subcategories: subName,
          image: img,
          imageUrl: img,
          images: p.images || (img ? [img] : []),
        };
      });

      const formattedShops = shops.map((s: any, idx: number) => {
        const pList = Array.isArray(s.phones) && s.phones.length > 0
          ? s.phones
          : (s.phone ? s.phone.split(',').map((p: string) => p.trim()).filter(Boolean) : []);
        return {
          id: String(s._id || s.id || s.shopId || `shop_${idx}`),
          shopId: String(s.shopId || s._id || s.id || `shop_${idx}`),
          name: s.name || s.shopName || 'Shop',
          phone: s.phone || (pList[0] || ''),
          phones: pList,
          address: s.address || '',
          imageUrl: s.imageUrl || s.image || '',
          mapUrl: s.mapUrl || '',
          deliveredOrders: s.deliveredOrders || 0,
          pendingOrders: s.pendingOrders || 0,
          currentCredit: s.currentCredit || 0,
        };
      });

      const formattedOrders = orders.map((o: any, idx: number) => ({
        id: String(o._id || o.id || o.orderId || `order_${idx}`),
        orderId: String(o.orderId || o._id || o.id || `order_${idx}`),
        date: o.date || new Date().toISOString(),
        shop: o.shop || {},
        items: o.items || [],
        total: o.total || 0,
        status: o.status || 'PENDING',
      }));

      const rawWishlist = wishlist?.wishlist || wishlist || {};
      const formattedWishlist = [
        {
          id: 'user_wishlist',
          categories: rawWishlist.categories || [],
          subcategories: rawWishlist.subcategories || [],
          products: rawWishlist.products || [],
          fullProducts: rawWishlist.fullProducts || [],
        },
      ];

      // Preserve locally created orders so full sync never erases local device orders
      const existingDbOrders = await offlineDB.getAll<any>('orders').catch(() => []);
      const localOrdersToPreserve = (existingDbOrders || []).filter((o: any) =>
        o.isLocallyCreated === true ||
        !o.isSynced ||
        (o.id && (String(o.id).startsWith('LOCAL_') || String(o.id).startsWith('DRAFT-'))) ||
        (o.orderId && (String(o.orderId).startsWith('LOCAL_') || String(o.orderId).startsWith('DRAFT-')))
      ).map((o: any) => ({ ...o, isLocallyCreated: true }));

      const preservedIds = new Set(localOrdersToPreserve.map((o: any) => String(o.id)));
      const remoteOrdersFormatted = formattedOrders
        .filter((ro: any) => !preservedIds.has(String(ro.id)))
        .map((ro: any) => ({ ...ro, isLocallyCreated: false, isSynced: true }));

      const mergedOrders = [...localOrdersToPreserve, ...remoteOrdersFormatted];

      // Save fresh data into IndexedDB tables
      await offlineDB.saveBatch('categories', formattedCategories);
      await offlineDB.saveBatch('subcategories', formattedSubcategories);
      await offlineDB.saveBatch('products', formattedProducts);
      await offlineDB.saveBatch('shops', formattedShops);
      await offlineDB.saveBatch('orders', mergedOrders);
      await offlineDB.saveBatch('wishlist', formattedWishlist);

      setProgress(80);
      setSyncStatusText('Preparing full offline image download...');

      // Collect ALL unique image URLs from categories, subcategories, products, and shops
      const allImageUrls: string[] = [
        ...formattedCategories.map((c: { image?: string }) => c.image),
        ...formattedSubcategories.map((s: { image?: string }) => s.image),
        ...formattedProducts.map((p: { image?: string; imageUrl?: string }) => p.imageUrl || p.image),
        ...formattedProducts.flatMap((p: { images?: string[] }) => p.images || []),
        ...formattedShops.map((s: { imageUrl?: string }) => s.imageUrl),
      ].filter((url): url is string => Boolean(url && typeof url === 'string' && url.trim().length > 0));

      const uniqueImageUrls = Array.from(new Set(allImageUrls));

      let totalImagesDownloaded = 0;
      let totalSizeBytesDownloaded = 0;

      if (uniqueImageUrls.length > 0) {
        setSyncStatusText(`Downloading ${uniqueImageUrls.length} images for full offline access (0/${uniqueImageUrls.length})...`);

        const stats = await cacheProductImages(uniqueImageUrls, (done, total) => {
          const imageProgress = 80 + Math.floor((done / total) * 15);
          setProgress(imageProgress);
          setSyncStatusText(`Downloading offline images (${done}/${total})...`);
        });

        totalImagesDownloaded = stats.totalDownloaded;
        totalSizeBytesDownloaded = stats.totalSizeBytes;
      }

      setProgress(96);
      setSyncStatusText('Finalizing sync & pre-warming local search & image index...');

      // Invalidate & rebuild all in-memory image & search caches
      invalidateImageMemoryMap();
      invalidateProductIndex();
      await prewarmImageCache().catch(() => {});

      // Trigger global SWR cache invalidation so all UI pages immediately re-query fresh LocalDB data
      mutate(() => true, undefined, { revalidate: true });

      const imageMB = Number((totalSizeBytesDownloaded / (1024 * 1024)).toFixed(2));
      const newMeta: SyncMetadata = {
        lastSyncedAt: new Date().toISOString(),
        totalProducts: formattedProducts.length,
        totalCategories: formattedCategories.length,
        totalSubcategories: formattedSubcategories.length,
        totalShops: formattedShops.length,
        totalOrders: formattedOrders.length,
        totalImages: totalImagesDownloaded > 0 ? totalImagesDownloaded : uniqueImageUrls.length,
        imageStorageMB: imageMB,
        isIncomplete: false,
        syncedUserId: user?.id || (user as any)?._id || (user?.email ? String(user.email) : ''),
        syncedUserEmail: user?.email || '',
        syncedUserName: user?.name || '',
      };

      await offlineDB.setMeta(newMeta);
      if (user?.email) {
        await offlineDB.saveSecure('synced_user_email', user.email.toLowerCase().trim());
        if (typeof window !== 'undefined') {
          localStorage.setItem('matrices_last_synced_user_email', user.email);
          if (user?.name) localStorage.setItem('matrices_last_synced_user_name', user.name);
        }
      }
      setMeta(newMeta);
      setLastSyncedAt(newMeta.lastSyncedAt);

      setProgress(100);
      setSyncStatusText('Sync Complete! 100% of data & images available offline.');

      window.dispatchEvent(new Event('matrices-data-mode-change'));
      window.dispatchEvent(new Event('matrices-sync-stats-updated'));

      return true;
    } catch (err: any) {
      console.error('Error during data sync:', err);
      const errMsg = err?.message || 'Server connection or network interrupted';
      setSyncStatusText(`Sync Interrupted: ${errMsg}`);

      // CRITICAL REQUIREMENT: Do NOT force into offline mode if sync fails midway!
      // Keep app in online mode so user can continue using live data
      if (typeof window !== 'undefined') {
        localStorage.setItem('matrices_data_mode', 'online');
        window.dispatchEvent(new Event('matrices-data-mode-change'));
        window.dispatchEvent(new Event('matrices-sync-stats-updated'));
      }

      // Mark metadata as incomplete with reason
      const rawProducts = await offlineDB.getAll<any>('products').catch(() => []);
      if (rawProducts.length > 0) {
        const incompleteMeta: SyncMetadata = {
          lastSyncedAt: meta?.lastSyncedAt || '',
          totalProducts: rawProducts.length,
          totalCategories: (await offlineDB.getAll('categories').catch(() => [])).length,
          totalSubcategories: (await offlineDB.getAll('subcategories').catch(() => [])).length,
          totalShops: (await offlineDB.getAll('shops').catch(() => [])).length,
          totalOrders: (await offlineDB.getAll('orders').catch(() => [])).length,
          totalImages: meta?.totalImages || 0,
          imageStorageMB: meta?.imageStorageMB || 0,
          isIncomplete: true,
          incompleteReason: errMsg,
        };
        await offlineDB.setMeta(incompleteMeta);
        setMeta(incompleteMeta);
      }

      // Interactive Swal dialog allowing user to resume balance sync or resync all
      Swal.fire({
        icon: 'error',
        title: 'Sync Interrupted',
        html: `
          <div style="text-align: left; font-size: 13px;" class="space-y-3">
            <p style="color: #dc2626; font-weight: 700;">${errMsg}</p>
            <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; border-left: 4px solid #0284c7;">
              <p style="font-weight: 600; color: #0f172a;">🌐 Online Mode Maintained</p>
              <p style="font-size: 12px; color: #475569; margin-top: 4px;">App was not switched to offline mode and remains online. You can continue the balance sync or resync all anytime.</p>
            </div>
          </div>
        `,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '⚡ Continue & Finish Balance Sync',
        denyButtonText: '🔄 Resync All',
        cancelButtonText: 'Stay in Online Mode',
        confirmButtonColor: '#059669',
        denyButtonColor: '#0f172a',
        cancelButtonColor: '#64748b',
      }).then((res) => {
        if (res.isConfirmed) {
          executeSync('resume');
        } else if (res.isDenied) {
          executeSync('full');
        }
      });

      return false;
    } finally {
      if (wakeLock) {
        try {
          await wakeLock.release();
        } catch {}
      }
      setTimeout(() => setIsSyncing(false), 1800);
    }
  }, [meta]);

  const triggerSync = useCallback(async (syncMode: 'full' | 'resume' = 'full'): Promise<boolean> => {
    if (isSyncing) return false;
    if (typeof window !== 'undefined' && !navigator.onLine) {
      Swal.fire({
        icon: 'warning',
        title: 'Offline Mode Active',
        text: 'Cannot sync fresh catalog while offline. Please connect to a network.',
        confirmButtonColor: '#0f172a',
      });
      return false;
    }

    if (!isPinVerified) {
      return new Promise<boolean>((resolve) => {
        afterPinResolve.current = resolve;
        setShowPinModal(true);
      });
    }

    return executeSync(syncMode);
  }, [isSyncing, isPinVerified, executeSync]);

  const resumeSync = useCallback(async (): Promise<boolean> => {
    return triggerSync('resume');
  }, [triggerSync]);

  const handlePinSuccess = useCallback(() => {
    setShowPinModal(false);
    executeSync('full').then((ok) => afterPinResolve.current?.(ok));
    afterPinResolve.current = null;
  }, [executeSync]);

  const handlePinClose = useCallback(() => {
    setShowPinModal(false);
    afterPinResolve.current?.(false);
    afterPinResolve.current = null;
  }, []);

  const deleteQueueItem = useCallback(
    async (id: string) => {
      await deleteSyncQueueItem(id);
      await refreshQueue();
    },
    [refreshQueue]
  );

  const clearAllQueue = useCallback(async () => {
    await clearSyncQueue();
    await refreshQueue();
  }, [refreshQueue]);

  const downloadReport = useCallback(
    (format: 'pdf' | 'csv' | 'json', userName?: string) => {
      const name = userName || (user as any)?.name || 'Salesrep';
      if (format === 'pdf') {
        downloadFailureReportPDF(name, queueItems);
      } else if (format === 'csv') {
        downloadFailureReportCSV(name, queueItems);
      } else if (format === 'json') {
        downloadFailureReportJSON(name, queueItems);
      }
    },
    [queueItems, user]
  );

  const isIncompleteSync = Boolean(meta?.isIncomplete);

  return (
    <SyncContext.Provider
      value={{
        isSyncing,
        progress,
        syncStatusText,
        lastSyncedAt,
        isOffline,
        meta,
        isIncompleteSync,
        queueItems,
        pendingQueueCount,
        failedQueueCount,
        isPushing,
        pushStatusText,
        triggerSync,
        executeSync,
        resumeSync,
        pushChanges,
        retryFailedPush,
        deleteSyncData,
        deleteQueueItem,
        clearAllQueue,
        downloadReport,
        checkPermissions,
        refreshQueue,
      }}
    >
      {children}
      <SyncProgressModal />
      <PinModal isOpen={showPinModal} onClose={handlePinClose} onSuccess={handlePinSuccess} />
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
