'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { offlineDB, SyncMetadata } from '../offline/indexed-db';
import { cacheProductImages } from '../offline/image-cache';
import { NativeAdapter } from '../../mobile/bridge/native-adapter';

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
    setProgress(5);
    setSyncStatusText('Requesting bulk sync payload...');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/sync/all', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!res.ok) {
        throw new Error(`Sync API responded with status ${res.status}`);
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.msg || 'Invalid sync response');
      }

      const { products, categories, subcategories, shops } = json.data;

      setProgress(30);
      setSyncStatusText(`Saving ${products.length} products to offline storage...`);

      // Store batch in IndexedDB
      await offlineDB.saveBatch('products', products);
      await offlineDB.saveBatch('categories', categories);
      await offlineDB.saveBatch('subcategories', subcategories);
      await offlineDB.saveBatch('shops', shops);

      setProgress(60);
      setSyncStatusText('Caching product images for offline display...');

      // Collect image URLs
      const imageUrls: string[] = products
        .map((p: { imageUrl?: string }) => p.imageUrl)
        .filter(Boolean);

      await cacheProductImages(imageUrls, (done, total) => {
        const pct = Math.floor(60 + (done / (total || 1)) * 35);
        setProgress(Math.min(pct, 95));
      });

      const newMeta: SyncMetadata = {
        lastSyncedAt: new Date().toISOString(),
        totalProducts: products.length,
        totalCategories: categories.length,
        totalSubcategories: subcategories.length,
        totalShops: shops.length,
      };

      await offlineDB.setMeta(newMeta);
      setMeta(newMeta);
      setLastSyncedAt(newMeta.lastSyncedAt);

      setProgress(100);
      setSyncStatusText('Sync Complete');
      return true;
    } catch (err: any) {
      console.error('Error during data sync:', err);
      setSyncStatusText(`Sync Failed: ${err.message || 'Error'}`);
      return false;
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setProgress(0);
        setSyncStatusText('Idle');
      }, 1200);
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
