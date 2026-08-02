'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { offlineDB, SyncMetadata } from '../offline/indexed-db';
import { cacheProductImages } from '../offline/image-cache';
import { NativeAdapter } from '../../mobile/bridge/native-adapter';
import { resolveApiUrl, getAuthToken } from '../utils';
import SyncProgressModal from '@/components/sync-progress-modal';
import PinModal from '@/components/pin-modal';
import { useAuth } from './auth-context';

interface SyncContextType {
  isSyncing: boolean;
  progress: number;
  syncStatusText: string;
  lastSyncedAt: string | null;
  isOffline: boolean;
  meta: SyncMetadata | null;
  triggerSync: () => Promise<boolean>;
  checkPermissions: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isPinVerified } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState('Idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [meta, setMeta] = useState<SyncMetadata | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  // Resolves after the user dismisses the pin modal; true if verified
  const afterPinResolve = useRef<((ok: boolean) => void) | null>(null);

  // Initialize network status listener & metadata
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load initial sync metadata from IndexedDB
    offlineDB.getMeta().then((m) => {
      if (m) {
        setMeta(m);
        setLastSyncedAt(m.lastSyncedAt);
      }
    }).catch(console.error);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkPermissions = useCallback(async () => {
    await NativeAdapter.requestAllPermissions();
  }, []);

  const executeSync = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true);
    setProgress(5);
    setSyncStatusText('Requesting storage permission...');

    try {
      // ── Step 0: ensure native storage permission is granted ────────────────
      const { storage } = await NativeAdapter.requestAllPermissions();
      if (!storage.granted) {
        setSyncStatusText('Storage permission denied – sync aborted.');
        setIsSyncing(false);
        return false;
      }

      const token = getAuthToken();
      const headers = {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      };

      // ── Step 1: Products & Categories ──────────────────────────────────────
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
      } else if (productsRes.status === 'fulfilled') {
        console.warn('Products fetch failed:', productsRes.value.status);
      }

      if (filtersRes.status === 'fulfilled' && filtersRes.value.ok) {
        const json = await filtersRes.value.json();
        categories = json.categories || json.data?.categories || [];
        subcategories = json.subcategories || json.data?.subcategories || [];
      }

      // ── Step 2: Shops ──────────────────────────────────────────────────────
      setProgress(50);
      setSyncStatusText('Syncing Customer Shops assigned to logged-in salesrep...');
      if (shopsRes.status === 'fulfilled' && shopsRes.value.ok) {
        const json = await shopsRes.value.json();
        shops = json.data || json.shops || (Array.isArray(json) ? json : []);
      }

      // ── Step 3: Orders ─────────────────────────────────────────────────────
      setProgress(65);
      setSyncStatusText('Syncing Salesrep Invoices & Orders...');
      if (ordersRes.status === 'fulfilled' && ordersRes.value.ok) {
        const json = await ordersRes.value.json();
        orders = json.orders || json.data || (Array.isArray(json) ? json : []);
      }

      if (wishlistRes.status === 'fulfilled' && wishlistRes.value.ok) {
        wishlist = await wishlistRes.value.json();
      }

      // ── Step 4: Format & persist to IndexedDB ─────────────────────────────
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
      const formattedWishlist = [{
        id: 'user_wishlist',
        categories: rawWishlist.categories || [],
        subcategories: rawWishlist.subcategories || [],
        products: rawWishlist.products || [],
        fullProducts: rawWishlist.fullProducts || [],
      }];

      // Clear all old synced data prior to persisting fresh dataset
      await offlineDB.clearAllData();

      await offlineDB.saveBatch('categories', formattedCategories);
      await offlineDB.saveBatch('subcategories', formattedSubcategories);
      await offlineDB.saveBatch('products', formattedProducts);
      await offlineDB.saveBatch('shops', formattedShops);
      await offlineDB.saveBatch('orders', formattedOrders);
      await offlineDB.saveBatch('wishlist', formattedWishlist);

      // ── Step 5: Cache & Download Images directly to LocalDB / Filesystem ──
      setProgress(88);
      setSyncStatusText('Downloading & storing images locally for offline use...');

      const imageUrls: string[] = [
        ...formattedProducts.map((p: { imageUrl?: string }) => p.imageUrl),
        ...formattedCategories.map((c: { image?: string }) => c.image),
        ...formattedSubcategories.map((s: { image?: string }) => s.image),
      ].filter((url): url is string => Boolean(url && typeof url === 'string'));

      let imageStats = { totalDownloaded: 0, totalSizeBytes: 0 };
      if (imageUrls.length > 0) {
        imageStats = await cacheProductImages(imageUrls, (done, total) => {
          const pct = Math.floor(88 + (done / (total || 1)) * 10);
          setProgress(Math.min(pct, 99));
        });
      }

      const imageStorageMB = Number((imageStats.totalSizeBytes / (1024 * 1024)).toFixed(2));

      const newMeta: SyncMetadata = {
        lastSyncedAt: new Date().toISOString(),
        totalProducts: formattedProducts.length,
        totalCategories: formattedCategories.length,
        totalSubcategories: formattedSubcategories.length,
        totalShops: formattedShops.length,
        totalOrders: formattedOrders.length,
        totalImages: imageStats.totalDownloaded,
        imageStorageMB: imageStorageMB,
      };

      await offlineDB.setMeta(newMeta);
      setMeta(newMeta);
      setLastSyncedAt(newMeta.lastSyncedAt);

      // Auto-switch to offline mode upon successful sync
      localStorage.setItem('matrices_data_mode', 'offline');
      window.dispatchEvent(new Event('matrices-data-mode-change'));

      setProgress(100);
      setSyncStatusText('Sync Complete!');
      return true;
    } catch (err: any) {
      console.error('Error during data sync:', err);
      setSyncStatusText(`Sync Failed: ${err.message || 'Server connection error'}`);
      return false;
    } finally {
      // Small delay so user can read "Sync Complete!" before the modal closes
      setTimeout(() => setIsSyncing(false), 1800);
    }
  }, []);

  /**
   * Trigger sync – always asks for PIN first if not yet verified,
   * then proceeds to executeSync once the user authenticates.
   */
  const triggerSync = useCallback(async (): Promise<boolean> => {
    if (isSyncing) return false;
    if (typeof window !== 'undefined' && !navigator.onLine) {
      alert('Cannot sync while offline. Please connect to a network.');
      return false;
    }

    // If PIN not yet verified, show modal and wait for user to verify
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

  return (
    <SyncContext.Provider
      value={{
        isSyncing,
        progress,
        syncStatusText,
        lastSyncedAt,
        isOffline,
        meta,
        triggerSync,
        checkPermissions,
      }}
    >
      {children}
      <SyncProgressModal />
      <PinModal
        isOpen={showPinModal}
        onClose={handlePinClose}
        onSuccess={handlePinSuccess}
      />
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
