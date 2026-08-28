'use client';

import React, { useEffect, useState } from 'react';
import { useSync } from '@/lib/contexts/sync-context';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, CheckCircle2, AlertCircle, Database, Store, FileText,
  Image as ImageIcon, X, Minimize2, ArrowDownRight, Eye
} from 'lucide-react';

export default function SyncProgressModal() {
  const {
    isSyncing,
    progress,
    syncStatusText,
    lastSyncedAt,
    meta,
    executeSync,
    isSyncModalOpen,
    closeSyncModal,
    openSyncModal,
  } = useSync();

  // Allow closing/minimizing with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSyncModalOpen) {
        e.preventDefault();
        closeSyncModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isSyncModalOpen, closeSyncModal]);

  const isComplete = progress >= 100;
  const isError = syncStatusText.toLowerCase().includes('failed') || syncStatusText.toLowerCase().includes('error');

  const getStepStatus = (minProgress: number) => {
    if (progress >= minProgress) return 'complete';
    if (progress >= minProgress - 25) return 'active';
    return 'pending';
  };

  return (
    <>
      {/* ─── 1. Full Interactive Progress Modal ─── */}
      <AnimatePresence>
        {isSyncModalOpen && (
          <div
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
            onClick={() => closeSyncModal()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 text-[#0f172a] shadow-2xl border border-white/80 overflow-hidden"
              onClick={(e) => e.stopPropagation()} // Prevent closing on modal card click
            >
              {/* Top Close / Minimize Button */}
              <button
                type="button"
                onClick={() => closeSyncModal()}
                className="absolute top-5 right-5 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition-all cursor-pointer shadow-sm z-10"
                title="Minimize / Run in Background"
              >
                <X size={18} />
              </button>

              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#0f172a] text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl border border-white/20">
                  {isError ? (
                    <AlertCircle size={36} className="text-rose-400" />
                  ) : isComplete ? (
                    <CheckCircle2 size={36} className="text-emerald-400" />
                  ) : (
                    <RefreshCw size={36} className="animate-spin text-sky-400" />
                  )}
                </div>

                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide">
                  {isError ? 'SYNC FAILED' : isComplete ? 'SYNC COMPLETE' : 'SYNCING DATA'}
                </h2>
                <p className="text-xs text-gray-500 font-bold max-w-sm mx-auto uppercase mt-1">
                  {isComplete
                    ? 'ALL PRODUCTS, CUSTOMER SHOPS, AND SALESREP INVOICES ARE NOW SYNCED FOR OFFLINE ACCESS.'
                    : 'SYNCHRONIZING CATALOGUE PRODUCTS, ASSIGNED CUSTOMER SHOPS, AND INVOICES IN BACKGROUND...'}
                </p>
              </div>

              {/* Progress Bar Container */}
              <div className="mb-6 space-y-2">
                <div className="flex justify-between items-center text-xs font-black uppercase">
                  <span className="text-gray-500">PROGRESS</span>
                  <span className="text-[#0f172a] text-sm">{progress}%</span>
                </div>
                <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-200 shadow-inner p-0.5">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={`h-full rounded-full transition-all ${
                      isError
                        ? 'bg-rose-600'
                        : isComplete
                        ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                        : 'bg-gradient-to-r from-sky-500 to-[#0f172a] shadow-[0_0_12px_rgba(15,23,42,0.4)]'
                    }`}
                  />
                </div>
                <p className="text-[0.7rem] font-black uppercase text-center text-gray-600 truncate pt-1">
                  {syncStatusText}
                </p>
              </div>

              {/* Live Step Checklist */}
              <div className="space-y-3 mb-6 bg-gray-50/80 p-4 rounded-2xl border border-gray-200/80">
                {[
                  {
                    step: 1,
                    minProg: 25,
                    title: 'PRODUCTS & CATEGORIES DATABASE',
                    icon: Database,
                    count: meta?.totalProducts ? `${meta.totalProducts} items` : null,
                  },
                  {
                    step: 2,
                    minProg: 50,
                    title: 'ASSIGNED CUSTOMER SHOPS',
                    icon: Store,
                    count: meta?.totalShops ? `${meta.totalShops} shops` : null,
                  },
                  {
                    step: 3,
                    minProg: 75,
                    title: 'SALESREP INVOICES & ORDERS',
                    icon: FileText,
                    count: null,
                  },
                  {
                    step: 4,
                    minProg: 100,
                    title: 'PRODUCT IMAGES & OFFLINE ASSETS',
                    icon: ImageIcon,
                    count: null,
                  },
                ].map((item) => {
                  const status = getStepStatus(item.minProg);
                  const StepIcon = item.icon;
                  return (
                    <div
                      key={item.step}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs font-black uppercase transition-all ${
                        status === 'complete'
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                          : status === 'active'
                          ? 'bg-sky-50 text-sky-900 border-sky-300 shadow-sm animate-pulse'
                          : 'bg-white/60 text-gray-400 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <StepIcon size={18} className={status === 'complete' ? 'text-emerald-600' : status === 'active' ? 'text-sky-600' : 'text-gray-400'} />
                        <span>{item.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.count && <span className="text-[0.65rem] opacity-75">{item.count}</span>}
                        {status === 'complete' ? (
                          <CheckCircle2 size={16} className="text-emerald-600" />
                        ) : status === 'active' ? (
                          <RefreshCw size={14} className="animate-spin text-sky-600" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-gray-300" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Footer Button */}
              <div className="pt-2">
                {isComplete ? (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => {
                      closeSyncModal();
                      window.location.reload();
                    }}
                    className="w-full py-4 rounded-full font-black text-xs uppercase tracking-wider text-white shadow-xl transition-all cursor-pointer bg-[#0f172a] hover:bg-[#1e293b]"
                  >
                    SYNC FINISHED - CONTINUE
                  </motion.button>
                ) : isError ? (
                  <div className="space-y-2">
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[0.7rem] font-bold text-amber-900 text-center uppercase">
                      🌐 Online Mode Maintained — You are NOT locked offline
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          executeSync('resume');
                        }}
                        className="py-3 px-4 rounded-full font-black text-xs uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        ⚡ Finish Balance Sync
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          executeSync('full');
                        }}
                        className="py-3 px-4 rounded-full font-black text-xs uppercase tracking-wider text-white bg-[#0f172a] hover:bg-[#1e293b] shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        🔄 Resync All
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('matrices_data_mode', 'online');
                          window.dispatchEvent(new Event('matrices-data-mode-change'));
                        }
                        closeSyncModal();
                      }}
                      className="w-full py-2.5 rounded-full font-bold text-xs uppercase tracking-wider text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer"
                    >
                      Stay in Online Mode
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="p-2.5 bg-sky-50 rounded-xl border border-sky-200 text-[0.68rem] font-bold text-sky-900 text-center uppercase flex items-center justify-center gap-1.5">
                      🌐 Online Mode Active — You can continue using the application normally
                    </div>
                    <button
                      type="button"
                      onClick={() => closeSyncModal()}
                      className="w-full py-3.5 px-4 rounded-full font-black text-xs uppercase tracking-wider text-white bg-[#0f172a] hover:bg-[#1e293b] shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Minimize2 size={15} /> Run in Background & Use App
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── 2. Floating Background Sync Mini-Pill (Visible when modal is closed but sync is active) ─── */}
      <AnimatePresence>
        {!isSyncModalOpen && isSyncing && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="fixed bottom-5 right-5 z-[90] bg-[#0f172a]/95 text-white backdrop-blur-xl border border-sky-400/40 rounded-full p-2 pr-4 shadow-[0_12px_36px_rgba(0,0,0,0.45)] flex items-center gap-3 cursor-pointer hover:border-sky-300 hover:scale-105 transition-all group select-none"
            onClick={() => openSyncModal()}
            title="Click to view full Sync Progress"
          >
            <div className="w-10 h-10 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center shrink-0 border border-sky-400/30">
              <RefreshCw size={18} className="animate-spin text-sky-400" />
            </div>

            <div className="flex flex-col text-left pr-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-sky-300">
                  Syncing Catalogue
                </span>
                <span className="text-[11px] font-mono font-black text-white bg-sky-500/30 px-1.5 py-0.2 rounded-md border border-sky-400/30">
                  {progress}%
                </span>
              </div>
              <span className="text-[9px] text-gray-300 font-medium truncate max-w-[150px]">
                {syncStatusText}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openSyncModal();
              }}
              className="text-[10px] font-black uppercase tracking-wider bg-sky-400 hover:bg-sky-300 text-slate-950 px-3 py-1.5 rounded-full shadow-md transition-all flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Eye size={12} /> View
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
