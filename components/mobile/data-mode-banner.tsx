'use client';

import React, { useState } from 'react';
import { useSync } from '@/lib/contexts/sync-context';
import { useDataMode } from '@/lib/contexts/data-mode-context';
import { WifiOff, Wifi, Database, RefreshCw, AlertTriangle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DataModeBanner() {
  const { isOffline, meta, triggerSync } = useSync();
  const { dataMode, toggleDataMode, hasSyncedData, isReady } = useDataMode();
  const [showWarning, setShowWarning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!isReady) return null;

  const isUsingOffline = dataMode === 'offline';

  // Do not render top sticky banner in online mode when device is connected
  if (!isUsingOffline && !isOffline) {
    return null;
  }
  const syncedCount = meta?.totalProducts ?? 0;

  const handleToggle = async () => {
    if (!isUsingOffline && !hasSyncedData) {
      // Trying to go offline with no data
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 4000);
      return;
    }
    await toggleDataMode();
    setShowWarning(false);
  };

  return (
    <div className="sticky top-0 z-50">
      {/* ── Main Banner ── */}
      <motion.div
        layout
        className={`px-3 py-1.5 text-xs font-bold flex items-center justify-between gap-2 border-b backdrop-blur-md transition-colors duration-300 ${
          isOffline
            ? 'bg-amber-500/90 text-amber-950 border-amber-600/30'
            : isUsingOffline
            ? 'bg-emerald-600/90 text-white border-emerald-700/40'
            : 'bg-[#0f172a]/85 text-white border-white/10'
        }`}
      >
        {/* Left: network / mode status */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isOffline ? (
            <WifiOff size={14} className="shrink-0 animate-bounce" />
          ) : isUsingOffline ? (
            <Database size={14} className="shrink-0" />
          ) : (
            <Wifi size={14} className="shrink-0" />
          )}

          <span className="truncate">
            {isOffline
              ? 'Working Offline'
              : isUsingOffline
              ? 'Offline Data Mode'
              : 'Online Data Mode'}
          </span>

          {syncedCount > 0 && (
            <>
              <span className="opacity-40 shrink-0">•</span>
              <span className="opacity-80 truncate">
                {syncedCount.toLocaleString()} items synced
              </span>
            </>
          )}
        </div>

        {/* Right: toggle + expand */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle pill */}
          <button
            onClick={handleToggle}
            title={isUsingOffline ? 'Switch to Online data' : 'Switch to Offline data'}
            className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none ${
              isUsingOffline ? 'bg-emerald-300' : 'bg-white/25'
            }`}
          >
            <motion.span
              layout
              className={`inline-block h-3.5 w-3.5 rounded-full shadow-md transition-colors duration-300 ${
                isUsingOffline ? 'bg-emerald-800' : 'bg-white/80'
              }`}
              animate={{ x: isUsingOffline ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>

          <span className="text-[10px] font-black uppercase tracking-widest opacity-70 hidden sm:block">
            {isUsingOffline ? 'OFFLINE' : 'ONLINE'}
          </span>

          {/* Expand chevron */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="opacity-60 hover:opacity-100 transition-opacity p-0.5"
          >
            <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
              <ChevronDown size={14} />
            </motion.div>
          </button>
        </div>
      </motion.div>

      {/* ── Warning: no synced data ── */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-red-600 text-white text-xs font-bold px-4 py-2 flex items-center gap-2 border-b border-red-700/50"
          >
            <AlertTriangle size={14} className="shrink-0 animate-pulse" />
            <span className="flex-1">No synced data found. Please sync first before switching to offline mode.</span>
            <button
              onClick={() => { setShowWarning(false); triggerSync(); }}
              className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full transition-all shrink-0 uppercase tracking-wider text-[10px]"
            >
              <RefreshCw size={11} /> Sync Now
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
                <span className="text-[10px] text-gray-400 font-medium">
                  Last sync: {new Date(meta.lastSyncedAt).toLocaleString()}
                </span>
              )}

              <div className="ml-auto flex items-center gap-2">
                {/* Mode buttons */}
                <button
                  onClick={() => { handleToggle(); setExpanded(false); }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                    isUsingOffline
                      ? 'bg-[#0f172a] text-white'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {isUsingOffline ? '⚡ Switch to Online' : '📦 Use Offline Data'}
                </button>

                <button
                  onClick={() => { setExpanded(false); triggerSync(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f172a] text-white rounded-full text-[10px] font-black uppercase tracking-wider hover:bg-[#1e293b] transition-all"
                >
                  <RefreshCw size={11} /> Sync Now
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
