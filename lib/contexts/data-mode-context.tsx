'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { offlineDB } from '../offline/indexed-db';
import { prewarmImageCache } from '../offline/image-cache';
import Swal from 'sweetalert2';

export type DataMode = 'online' | 'offline';

interface DataModeContextType {
  dataMode: DataMode;
  setDataMode: (mode: DataMode) => void;
  toggleDataMode: () => Promise<void>;
  hasSyncedData: boolean;
  isReady: boolean;
  isSyncStale: boolean;
  syncAgeDays: number;
}

const DataModeContext = createContext<DataModeContextType | undefined>(undefined);

const STORAGE_KEY = 'matrices_data_mode';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function DataModeProvider({ children }: { children: React.ReactNode }) {
  const [dataMode, setDataModeState] = useState<DataMode>('offline');
  const [hasSyncedData, setHasSyncedData] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSyncStale, setIsSyncStale] = useState(false);
  const [syncAgeDays, setSyncAgeDays] = useState(0);

  const evaluateDataMode = useCallback(async (isInitial = false) => {
    try {
      const meta = await offlineDB.getMeta().catch(() => null);
      const rawProducts = await offlineDB.getAll<any>('products').catch(() => []);
      const synced = !!((meta && meta.totalProducts > 0) || rawProducts.length > 0);
      setHasSyncedData(synced);

      // If valid synced data exists -> automatically enforce OFFLINE mode (cannot change to online)
      const targetMode: DataMode = synced ? 'offline' : 'online';
      setDataModeState(targetMode);
      localStorage.setItem(STORAGE_KEY, targetMode);

      // Check if sync data is older than 1 week (7 days)
      if (synced && meta?.lastSyncedAt) {
        const syncTime = new Date(meta.lastSyncedAt).getTime();
        const diffMs = Date.now() - syncTime;
        const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        setSyncAgeDays(days);

        if (diffMs > ONE_WEEK_MS) {
          setIsSyncStale(true);

          // Show alert once per session on startup / initial load
          if (isInitial && typeof window !== 'undefined' && !sessionStorage.getItem('matrices_stale_sync_alert_shown')) {
            sessionStorage.setItem('matrices_stale_sync_alert_shown', 'true');
            setTimeout(() => {
              Swal.fire({
                title: 'Fresh Sync Recommended',
                html: `Your offline catalog data was last synced <strong>${days} days ago</strong> (more than 1 week old).<br/>Please perform a fresh sync to ensure product prices, inventory, and shops are up to date.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#0f172a',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Go to Data Sync',
                cancelButtonText: 'Continue Offline',
              }).then((res) => {
                if (res.isConfirmed) {
                  window.location.href = '/settings/sync';
                }
              });
            }, 1000);
          }
        } else {
          setIsSyncStale(false);
        }
      } else {
        setIsSyncStale(false);
        setSyncAgeDays(0);
      }

      setIsReady(true);
      prewarmImageCache().catch(() => {});
    } catch (err) {
      console.error('Failed to evaluate data mode:', err);
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    evaluateDataMode(true);

    const handleExternalChange = () => {
      evaluateDataMode(false);
    };

    window.addEventListener('matrices-data-mode-change', handleExternalChange);
    window.addEventListener('storage', handleExternalChange);

    return () => {
      window.removeEventListener('matrices-data-mode-change', handleExternalChange);
      window.removeEventListener('storage', handleExternalChange);
    };
  }, [evaluateDataMode]);

  // If valid sync data exists, locking mode to offline — user cannot switch to online mode
  const setDataMode = useCallback((mode: DataMode) => {
    if (hasSyncedData) {
      setDataModeState('offline');
      localStorage.setItem(STORAGE_KEY, 'offline');
      return;
    }
    setDataModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [hasSyncedData]);

  const toggleDataMode = useCallback(async () => {
    if (hasSyncedData) {
      setDataModeState('offline');
      localStorage.setItem(STORAGE_KEY, 'offline');
      return;
    }
    setDataModeState('online');
    localStorage.setItem(STORAGE_KEY, 'online');
  }, [hasSyncedData]);

  return (
    <DataModeContext.Provider value={{ dataMode, setDataMode, toggleDataMode, hasSyncedData, isReady, isSyncStale, syncAgeDays }}>
      {children}
    </DataModeContext.Provider>
  );
}

export function useDataMode() {
  const ctx = useContext(DataModeContext);
  if (!ctx) throw new Error('useDataMode must be used within DataModeProvider');
  return ctx;
}

/** Convenience: returns true if data should come from IndexedDB */
export function useIsOfflineMode(): boolean {
  const { dataMode, isReady } = useDataMode();
  return isReady && dataMode === 'offline';
}
