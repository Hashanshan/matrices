'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { offlineDB, SyncMetadata } from '../offline/indexed-db';
import { cacheProductImages, clearMatricesFolder, prewarmImageCache, invalidateImageMemoryMap } from '../offline/image-cache';
import { invalidateProductIndex } from '../offline/offline-search';
import { NativeAdapter } from '../../mobile/bridge/native-adapter';
import { resolveApiUrl, getAuthToken } from '../utils';
import SyncProgressModal from '@/components/sync-progress-modal';
import PinModal from '@/components/pin-modal';
import { useAuth } from './auth-context';
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
  
  // Sync Queue management states
  queueItems: SyncQueueItem[];
  pendingQueueCount: number;
  failedQueueCount: number;
  isPushing: boolean;
  pushStatusText: string;
  
  // Functions
  triggerSync: () => Promise<boolean>;
  pushChanges: () => Promise<boolean>;
  retryFailedPush: () => Promise<boolean>;
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
   * Execute Sync (Download fresh catalog from server)
   */
  const executeSync = useCallback(async (): Promise<boolean> => {
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

    try {
      const { storage } = await NativeAdapter.requestAllPermissions();
      if (!storage.granted) {
        setSyncStatusText('Storage permission denied – sync aborted.');
        setIsSyncing(false);
        return false;
      }

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

      if (productsRes.status === 'fulfilled' && productsRes.value.ok) {
        const json = await productsRes.value.json();
        products = json.data || json.products || (Array.isArray(json) ? json : []);
      }

      if (filtersRes.status === 'fulfilled' && filtersRes.value.ok) {
        const json = await filtersRes.value.json();
        categories = json.categories || json.data?.categories || [];
        subcategories = json.subcategories || json.data?.subcategories || [];
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

      const formattedCategories = categories.map((c: any, idx: number) => ({
        id: String(c._id || c.id || c.categoryId || `cat_${idx}`),
        name: c.name || c.categoryName || 'Category',
        image: c.image || c.imageUrl || '',
        order: c.order ?? idx,
      }));

      const formattedSubcategories = subcategories.map((s: any, idx: number) => {
        const catName = s.categoryName || s.category?.name || (typeof s.category === 'string' ? s.category : '') || '';
        return {
          id: String(s._id || s.id || s.subcategoryId || `subcat_${idx}`),
          name: s.name || s.subcategoryName || 'Subcategory',
          categoryId: String(s.categoryId || s.category?._id || s.category || ''),
          category: catName,
          categoryName: catName,
          image: s.image || s.imageUrl || '',
          order: s.order ?? idx,
        };
      });

      const formattedProducts = products.map((p: any, idx: number) => {
        const catName = p.categoryName || p.category?.name || (typeof p.category === 'string' ? p.category : '') || p.categories || '';
        const subName = p.subcategoryName || p.subcategory?.name || (typeof p.subcategory === 'string' ? p.subcategory : '') || p.subcategories || '';
        const img = p.image || p.imageUrl || (Array.isArray(p.images) && p.images[0] ? p.images[0] : '');
        return {
          id: String(p._id || p.id || p.productId || `prod_${idx}`),
          productId: String(p.productId || p._id || p.id || `prod_${idx}`),
          name: p.name || p.productName || 'Unnamed Product',
          code: p.code || p.productCode || '',
          description: p.description || '',
          price: p.price || 0,
          categoryId: String(p.categoryId || p.category?._id || p.category || ''),
          subcategoryId: String(p.subcategoryId || p.subcategory?._id || p.subcategory || ''),
          categoryName: catName,
          categories: catName,
          subcategoryName: subName,
          subcategories: subName,
          image: img,
          imageUrl: img,
          images: p.images || (img ? [img] : []),
        };
      });

      const formattedShops = shops.map((s: any, idx: number) => ({
        id: String(s._id || s.id || s.shopId || `shop_${idx}`),
        shopId: String(s.shopId || s._id || s.id || `shop_${idx}`),
        name: s.name || s.shopName || 'Shop',
        phone: s.phone || '',
        address: s.address || '',
        deliveredOrders: s.deliveredOrders || 0,
        pendingOrders: s.pendingOrders || 0,
        currentCredit: s.currentCredit || 0,
      }));

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

      // Delete all old sync data
      await offlineDB.clearAllData();
      await clearMatricesFolder();

      await offlineDB.saveBatch('categories', formattedCategories);
      await offlineDB.saveBatch('subcategories', formattedSubcategories);
      await offlineDB.saveBatch('products', formattedProducts);
      await offlineDB.saveBatch('shops', formattedShops);
      await offlineDB.saveBatch('orders', formattedOrders);
      await offlineDB.saveBatch('wishlist', formattedWishlist);

      setProgress(90);
      setSyncStatusText('Finalizing sync & building local index...');

      // Invalidate all in-memory caches so fresh data is served on next query
      invalidateImageMemoryMap();
      invalidateProductIndex();

      const newMeta: SyncMetadata = {
        lastSyncedAt: new Date().toISOString(),
        totalProducts: formattedProducts.length,
        totalCategories: formattedCategories.length,
        totalSubcategories: formattedSubcategories.length,
        totalShops: formattedShops.length,
        totalOrders: formattedOrders.length,
        totalImages: 0,
        imageStorageMB: 0,
      };

      await offlineDB.setMeta(newMeta);
      setMeta(newMeta);
      setLastSyncedAt(newMeta.lastSyncedAt);

      setProgress(100);
      setSyncStatusText('Sync Complete! Images will cache as you browse.');

      // Stay in online mode (stale-while-revalidate serves IDB instantly)
      // Don't force switch to offline — let user keep their current mode preference
      window.dispatchEvent(new Event('matrices-data-mode-change'));

      // Pre-warm image cache in background (non-blocking) for the most-viewed images
      const priorityImageUrls: string[] = [
        ...formattedCategories.map((c: { image?: string }) => c.image),
        ...formattedSubcategories.map((s: { image?: string }) => s.image),
        ...formattedProducts.slice(0, 200).map((p: { imageUrl?: string }) => p.imageUrl),
      ].filter((url): url is string => Boolean(url && typeof url === 'string'));

      // Kick off background image caching without blocking the UI
      Promise.resolve().then(async () => {
        try {
          await cacheProductImages(priorityImageUrls, (done, total) => {
            // Silent background caching — no progress bar update
            if (done === total) {
              prewarmImageCache().catch(() => {});
            }
          });
        } catch {
          // Ignore image caching errors
        }
      });

      return true;
    } catch (err: any) {
      console.error('Error during data sync:', err);
      setSyncStatusText(`Sync Failed: ${err.message || 'Server connection error'}`);
      return false;
    } finally {
      setTimeout(() => setIsSyncing(false), 1800);
    }
  }, []);

  const triggerSync = useCallback(async (): Promise<boolean> => {
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

    return executeSync();
  }, [isSyncing, isPinVerified, executeSync]);

  const handlePinSuccess = useCallback(() => {
    setShowPinModal(false);
    executeSync().then((ok) => afterPinResolve.current?.(ok));
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

  return (
    <SyncContext.Provider
      value={{
        isSyncing,
        progress,
        syncStatusText,
        lastSyncedAt,
        isOffline,
        meta,
        queueItems,
        pendingQueueCount,
        failedQueueCount,
        isPushing,
        pushStatusText,
        triggerSync,
        pushChanges,
        retryFailedPush,
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
