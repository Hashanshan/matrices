'use client';

import React, { useState } from 'react';
import { useSync } from '@/lib/contexts/sync-context';
import { useDataMode } from '@/lib/contexts/data-mode-context';
import { WifiOff, Wifi, Database, RefreshCw, AlertTriangle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DataModeBanner() {
  const { isOffline, meta, triggerSync } = useSync();
  const { dataMode, isReady, isSyncStale, syncAgeDays } = useDataMode();
  const [expanded, setExpanded] = useState(false);

  if (!isReady) return null;

  const isUsingOffline = dataMode === 'offline';

  // Do not render top sticky banner in online mode when device is connected
  if (!isUsingOffline && !isOffline) {
    return null;
  }
  const syncedCount = meta?.totalProducts ?? 0;

  return (
    <div className="sticky top-0 z-50">
      {/* ── Main Banner ── */}
      <motion.div
        layout
        className={`px-3 py-1.5 text-xs font-bold flex items-center justify-between gap-2 border-b backdrop-blur-md transition-colors duration-300 ${
          isSyncStale
            ? 'bg-amber-600/95 text-white border-amber-700/50'
            : isOffline
            ? 'bg-amber-500/90 text-amber-950 border-amber-600/30'
            : isUsingOffline
            ? 'bg-emerald-600/90 text-white border-emerald-700/40'
            : 'bg-[#0f172a]/85 text-white border-white/10'
        }`}
      >
        {/* Left: network / mode status */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isSyncStale ? (
            <AlertTriangle size={14} className="shrink-0 animate-pulse text-amber-200" />
          ) : isOffline ? (
            <WifiOff size={14} className="shrink-0 animate-bounce" />
          ) : isUsingOffline ? (
            <Database size={14} className="shrink-0" />
          ) : (
            <Wifi size={14} className="shrink-0" />
          )}

          <span className="truncate">
            {isSyncStale
              ? `Offline Data (${syncAgeDays}d old - Fresh Sync Recommended)`
              : isOffline
              ? 'Working Offline'
              : isUsingOffline
              ? 'Offline Data Mode'
              : 'Online Data Mode'}
          </span>

          {syncedCount > 0 && !isSyncStale && (
            <>
              <span className="opacity-40 shrink-0">•</span>
              <span className="opacity-80 truncate">
                {syncedCount.toLocaleString()} items synced
              </span>
            </>
          )}
        </div>

        {/* Right: status indicator & expand */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
            isSyncStale
              ? 'bg-amber-800 text-white border border-amber-400'
              : isUsingOffline
              ? 'bg-emerald-700 text-white border border-emerald-400'
              : 'bg-blue-700 text-white border border-blue-400'
          }`}>
            {isUsingOffline ? 'OFFLINE' : 'ONLINE'}
          </span>

          {/* Expand chevron */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="opacity-80 hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
            title="Toggle Details"
          >
            <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
              <ChevronDown size={14} />
            </motion.div>
          </button>
        </div>
      </motion.div>

      {/* ── Expanded details panel ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-white/95 backdrop-blur-2xl border-b border-white/60 shadow-lg"
          >
            <div className="px-4 py-3 flex flex-wrap items-center gap-3">
              {/* Stats */}
              <div className="flex items-center gap-2 text-xs text-gray-700">
                <Database size={13} className="text-emerald-600" />
                <span className="font-bold">
                  {syncedCount > 0
                    ? `${syncedCount.toLocaleString()} products · ${meta?.totalCategories ?? 0} categories · ${meta?.totalShops ?? 0} shops synced`
                    : 'No data synced yet'}
                </span>
              </div>

              {meta?.lastSyncedAt && (
                <span className={`text-[10px] font-medium ${isSyncStale ? 'text-amber-700 font-bold' : 'text-gray-400'}`}>
                  Last sync: {new Date(meta.lastSyncedAt).toLocaleString()} {isSyncStale ? `(${syncAgeDays} days ago)` : ''}
                </span>
              )}

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => { setExpanded(false); triggerSync(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f172a] text-white rounded-full text-[10px] font-black uppercase tracking-wider hover:bg-[#1e293b] transition-all cursor-pointer shadow-xs"
                >
                  <RefreshCw size={11} /> Sync Fresh Catalog Now
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
