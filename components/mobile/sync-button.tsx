'use client';

import React from 'react';
import { useSync } from '@/lib/contexts/sync-context';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle2, WifiOff } from 'lucide-react';

export default function SyncButton() {
  const { isSyncing, progress, lastSyncedAt, isOffline, triggerSync } = useSync();

  const formatLastSync = (isoString: string | null) => {
    if (!isoString) return 'Not Synced';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Synced';
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <motion.button
        whileHover={{ scale: isSyncing ? 1 : 1.05 }}
        whileTap={{ scale: isSyncing ? 1 : 0.95 }}
        onClick={() => triggerSync()}
        disabled={isSyncing || isOffline}
        title={
          isOffline
            ? 'Offline Mode - Connect to network to sync data'
            : lastSyncedAt
            ? `Last synced at ${new Date(lastSyncedAt).toLocaleString()}`
            : 'Click to sync catalogue data for offline use'
        }
        className={`relative flex items-center gap-2 px-3.5 py-2 rounded-2xl font-bold text-xs shadow-md transition-all border ${
          isOffline
            ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 cursor-not-allowed'
            : isSyncing
            ? 'bg-accent/15 text-accent border-accent/40 cursor-wait'
            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border-emerald-500/30'
        }`}
      >
        {isOffline ? (
          <>
            <WifiOff size={16} className="text-amber-500 animate-pulse" />
            <span className="hidden sm:inline">Offline</span>
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw size={16} className="animate-spin text-accent" />
            <span>{progress > 0 ? `${progress}%` : 'Syncing'}</span>
          </>
        ) : (
          <>
            <RefreshCw size={16} className="text-emerald-500" />
            <span className="font-extrabold">Sync</span>
            <span className="hidden md:inline text-[10px] opacity-75 font-mono">
              ({formatLastSync(lastSyncedAt)})
            </span>
          </>
        )}
      </motion.button>
    </div>
  );
}
