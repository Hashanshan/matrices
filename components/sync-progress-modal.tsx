'use client';

import React, { useEffect } from 'react';
import { useSync } from '@/lib/contexts/sync-context';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle2, AlertCircle, Database, Store, FileText, Image as ImageIcon, ShieldCheck, X } from 'lucide-react';

export default function SyncProgressModal() {
  const { isSyncing, progress, syncStatusText, lastSyncedAt, meta } = useSync();

  // Prevent closing with Esc key while syncing is in progress
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSyncing) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isSyncing]);

  if (!isSyncing && progress === 0) return null;

  const isComplete = progress >= 100;
  const isError = syncStatusText.toLowerCase().includes('failed') || syncStatusText.toLowerCase().includes('error');

  const getStepStatus = (minProgress: number) => {
    if (progress >= minProgress) return 'complete';
    if (progress >= minProgress - 25) return 'active';
    return 'pending';
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 text-[#0f172a] shadow-2xl border border-white/80 overflow-hidden"
          onClick={(e) => e.stopPropagation()} // Prevent closing on backdrop click
        >
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
              {isError ? 'SYNC FAILED' : isComplete ? 'DATABASE SYNC COMPLETE' : 'SYNCING SALESREP DATABASE'}
            </h2>
            <p className="text-xs text-gray-500 font-bold max-w-sm mx-auto uppercase mt-1">
              {isComplete
                ? 'ALL PRODUCTS, CUSTOMER SHOPS, AND SALESREP INVOICES ARE NOW SYNCED FOR OFFLINE ACCESS.'
                : 'SYNCHRONIZING CATALOGUE PRODUCTS, ASSIGNED CUSTOMER SHOPS, AND INVOICES FOR LOGGED-IN SALESREP...'}
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

          {/* Action Footer Button (Enabled ONLY when sync is complete or error) */}
          <div className="pt-2">
            {isComplete || isError ? (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  window.location.reload();
                }}
                className={`w-full py-4 rounded-full font-black text-xs uppercase tracking-wider text-white shadow-xl transition-all cursor-pointer ${
                  isError ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#0f172a] hover:bg-[#1e293b]'
                }`}
              >
                {isError ? 'CLOSE & RETRY SYNC' : 'SYNC FINISHED - CONTINUE'}
              </motion.button>
            ) : (
              <div className="w-full py-4 bg-gray-200 text-gray-400 rounded-full font-black text-xs uppercase tracking-wider text-center cursor-not-allowed select-none">
                SYNCING IN PROGRESS... PLEASE WAIT
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
