'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { offlineDB } from '../offline/indexed-db';

export type DataMode = 'online' | 'offline';

interface DataModeContextType {
  dataMode: DataMode;
  setDataMode: (mode: DataMode) => void;
  toggleDataMode: () => Promise<void>;
  hasSyncedData: boolean;
  isReady: boolean;
}

const DataModeContext = createContext<DataModeContextType | undefined>(undefined);

const STORAGE_KEY = 'matrices_data_mode';

export function DataModeProvider({ children }: { children: React.ReactNode }) {
  const [dataMode, setDataModeState] = useState<DataMode>('online');
  const [hasSyncedData, setHasSyncedData] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Check if there is synced data in IndexedDB
      const meta = await offlineDB.getMeta().catch(() => null);
      const synced = !!(meta && meta.totalProducts > 0);
      setHasSyncedData(synced);

      // Read saved mode
      const saved = localStorage.getItem(STORAGE_KEY) as DataMode | null;
      if (saved === 'offline' || saved === 'online') {
        // If saved mode is offline but no synced data, fall back to online
        setDataModeState(saved === 'offline' && !synced ? 'online' : saved);
      } else if (synced) {
        // First time with synced data → default to offline to save mobile data
        setDataModeState('offline');
        localStorage.setItem(STORAGE_KEY, 'offline');
      }

      setIsReady(true);
    };

    init();

    // Listen for storage or sync completion updates
    const handleExternalChange = () => {
      init();
    };

    window.addEventListener('matrices-data-mode-change', handleExternalChange);
    window.addEventListener('storage', handleExternalChange);

    return () => {
      window.removeEventListener('matrices-data-mode-change', handleExternalChange);
      window.removeEventListener('storage', handleExternalChange);
    };
  }, []);

  const setDataMode = useCallback((mode: DataMode) => {
    setDataModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, []);

  const toggleDataMode = useCallback(async () => {
    if (dataMode === 'online') {
      // Switching to offline — check synced data first
      const meta = await offlineDB.getMeta().catch(() => null);
      const synced = !!(meta && meta.totalProducts > 0);
      setHasSyncedData(synced);
      if (!synced) {
        // Don't switch — caller should show warning
        return;
      }
      setDataMode('offline');
    } else {
      setDataMode('online');
    }
  }, [dataMode, setDataMode]);

  return (
    <DataModeContext.Provider value={{ dataMode, setDataMode, toggleDataMode, hasSyncedData, isReady }}>
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
