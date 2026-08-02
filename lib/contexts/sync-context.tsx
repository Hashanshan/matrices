'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { offlineDB, SyncMetadata } from '../offline/indexed-db';
import { cacheProductImages } from '../offline/image-cache';
import { NativeAdapter } from '../../mobile/bridge/native-adapter';
import { resolveApiUrl, getAuthToken } from '../utils';
import SyncProgressModal from '@/components/sync-progress-modal';

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState('Idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [meta, setMeta] = useState<SyncMetadata | null>(null);
  const [isOffline, setIsOffline] = useState(false);

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

  const triggerSync = useCallback(async (): Promise<boolean> => {
    if (isSyncing) return false;
    if (typeof window !== 'undefined' && !navigator.onLine) {
      alert('Cannot sync while offline. Please connect to a network.');
      return false;
    }

    setIsSyncing(true);
    setProgress(10);
    setSyncStatusText('Connecting to Magnum Server...');

    try {
      const token = getAuthToken();
      const headers = {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      };

      // 1. Fetch Active Products & Categories Filters
      setProgress(25);
      setSyncStatusText('Syncing Products & Categories...');

      const productsUrl = resolveApiUrl('/api/products?limit=5000');
      const filtersUrl = resolveApiUrl('/api/products/filters');
      const shopsUrl = resolveApiUrl('/api/shops?limit=5000');
      const ordersUrl = resolveApiUrl('/api/orders?limit=5000');
      const wishlistUrl = resolveApiUrl('/api/wishlist');

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

      // 2. Fetch Assigned Salesrep Shops
      setProgress(50);
      setSyncStatusText('Syncing Customer Shops assigned to logged-in salesrep...');
      if (shopsRes.status === 'fulfilled' && shopsRes.value.ok) {
        const json = await shopsRes.value.json();
        shops = json.data || json.shops || (Array.isArray(json) ? json : []);
      }

      // 3. Fetch Salesrep Invoices & Orders
      setProgress(75);
      setSyncStatusText('Syncing Salesrep Invoices & Orders...');
      if (ordersRes.status === 'fulfilled' && ordersRes.value.ok) {
        const json = await ordersRes.value.json();
        orders = json.orders || json.data || (Array.isArray(json) ? json : []);
      }

      if (wishlistRes.status === 'fulfilled' && wishlistRes.value.ok) {
        wishlist = await wishlistRes.value.json();
      }

      // Save to IndexedDB offline storage
      setProgress(85);
      setSyncStatusText(`Saving ${products.length} products, ${shops.length} shops, and ${orders.length} orders offline...`);

      const formattedProducts = products.map((p: any) => ({
        id: p._id || p.id || p.productId,
        productId: p.productId || p._id || p.id,
        name: p.name || p.productName || 'Unnamed Product',
        code: p.code || p.productCode || '',
        description: p.description || '',
        price: p.price || 0,
        categoryId: p.categoryId || p.category?._id || p.category || '',
        subcategoryId: p.subcategoryId || p.subcategory?._id || p.subcategory || '',
        categoryName: p.categoryName || p.category?.name || '',
        subcategoryName: p.subcategoryName || p.subcategory?.name || '',
        imageUrl: p.image || p.imageUrl || '',
        images: p.images || (p.image ? [p.image] : []),
      }));

      const formattedShops = shops.map((s: any) => ({
        id: s._id || s.id || s.shopId,
        shopId: s.shopId || s.id,
        name: s.name || s.shopName,
        phone: s.phone || '',
        address: s.address || '',
        deliveredOrders: s.deliveredOrders || 0,
        pendingOrders: s.pendingOrders || 0,
        currentCredit: s.currentCredit || 0,
      }));

      const formattedOrders = orders.map((o: any) => ({
        id: o._id || o.id || o.orderId,
        orderId: o.orderId || o.id,
        date: o.date,
        shop: o.shop,
        items: o.items || [],
        total: o.total || 0,
        status: o.status || 'PENDING',
      }));

      await offlineDB.saveBatch('products', formattedProducts);
      await offlineDB.saveBatch('categories', categories);
      await offlineDB.saveBatch('subcategories', subcategories);
      await offlineDB.saveBatch('shops', formattedShops);
      await offlineDB.saveBatch('orders', formattedOrders);

      if (wishlist) {
        await offlineDB.saveBatch('wishlist', Array.isArray(wishlist) ? wishlist : [wishlist]);
      }

      // 4. Cache Product Images
      setProgress(90);
      setSyncStatusText('Caching product images for offline display...');

      const imageUrls: string[] = formattedProducts
        .map((p: { imageUrl?: string }) => p.imageUrl)
        .filter(Boolean);

      if (imageUrls.length > 0) {
        await cacheProductImages(imageUrls, (done, total) => {
          const pct = Math.floor(90 + (done / (total || 1)) * 10);
          setProgress(Math.min(pct, 99));
        });
      }

      const newMeta: SyncMetadata = {
        lastSyncedAt: new Date().toISOString(),
        totalProducts: formattedProducts.length,
        totalCategories: categories.length,
        totalSubcategories: subcategories.length,
        totalShops: formattedShops.length,
      };

      await offlineDB.setMeta(newMeta);
      setMeta(newMeta);
      setLastSyncedAt(newMeta.lastSyncedAt);

      setProgress(100);
      setSyncStatusText('Database Sync Complete!');
      return true;
    } catch (err: any) {
      console.error('Error during data sync:', err);
      setSyncStatusText(`Sync Failed: ${err.message || 'Server connection error'}`);
      return false;
    }
  }, [isSyncing]);

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
