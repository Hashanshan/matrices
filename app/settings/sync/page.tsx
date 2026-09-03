'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/header';
import { useAuth } from '@/lib/contexts/auth-context';
import { useSync } from '@/lib/contexts/sync-context';
import PinModal from '@/components/pin-modal';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, Database, HardDrive, Image as ImageIcon, Store, FileText,
  Package, Layers, ShieldCheck, Wifi, WifiOff, CheckCircle2, AlertTriangle,
  Smartphone, Globe, Lock, ArrowUpRight, UploadCloud, RotateCcw, Download,
  Trash2, X, AlertCircle, Eye, FileSpreadsheet, FileCode, User
} from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { offlineDB, SyncMetadata } from '@/lib/offline/indexed-db';
import { getStorageStats, StorageStats } from '@/lib/offline/image-cache';
import { NativeAdapter } from '@/mobile/bridge/native-adapter';
import { SyncQueueItem } from '@/lib/offline/pending-sync';

export default function SyncSettingsPage() {
  const { isPinVerified, resetPinVerification, user } = useAuth();
  const {
    isSyncing, progress, syncStatusText, lastSyncedAt, isOffline, meta, isIncompleteSync,
    triggerSync, resumeSync, queueItems, pendingQueueCount, failedQueueCount, isPushing, pushStatusText,
    pushChanges, retryFailedPush, deleteSyncData, deleteQueueItem, clearAllQueue, downloadReport,
    openSyncModal
  } = useSync();

  const [showPinModal, setShowPinModal] = useState(true);
  const [dbMeta, setDbMeta] = useState<SyncMetadata | null>(meta);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [platformInfo, setPlatformInfo] = useState<{ isNative: boolean; platform: string }>({
    isNative: false,
    platform: 'web',
  });
  const [permissionState, setPermissionState] = useState<{ granted: boolean; message: string }>({
    granted: false,
    message: 'Checking...',
  });

  // Report export options modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedQueueItem, setSelectedQueueItem] = useState<SyncQueueItem | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      const [m, stats, perm] = await Promise.all([
        offlineDB.getMeta(),
        getStorageStats(),
        NativeAdapter.checkStorage(),
      ]);

      setDbMeta(m || null);
      setStorageStats(stats);
      setPermissionState({
        granted: perm.granted,
        message: perm.message || (perm.granted ? 'Permission granted' : 'Permission needed'),
      });
    } catch (err) {
      console.warn('Error fetching sync stats:', err);
    }
  }, []);

  useEffect(() => {
    setPlatformInfo(NativeAdapter.getPlatformInfo());
    refreshStats();
  }, [refreshStats]);

  // Keep dbMeta & storageStats real-time synchronized with useSync & events
  useEffect(() => {
    setDbMeta(meta || null);
    refreshStats();
  }, [meta, lastSyncedAt, refreshStats]);

  useEffect(() => {
    const handleStatsUpdated = () => refreshStats();
    window.addEventListener('matrices-sync-stats-updated', handleStatsUpdated);
    window.addEventListener('matrices-data-mode-change', handleStatsUpdated);
    return () => {
      window.removeEventListener('matrices-sync-stats-updated', handleStatsUpdated);
      window.removeEventListener('matrices-data-mode-change', handleStatsUpdated);
    };
  }, [refreshStats]);

  // Require Security PIN on every visit to /settings/sync
  useEffect(() => {
    resetPinVerification();
  }, []);

  useEffect(() => {
    setShowPinModal(!isPinVerified);
  }, [isPinVerified]);

  useEffect(() => {
    if (!isSyncing && !isPushing) {
      refreshStats();
    }
  }, [isSyncing, isPushing, refreshStats]);

  const handleRequestPermission = async () => {
    const res = await NativeAdapter.requestStorage();
    setPermissionState({
      granted: res.granted,
      message: res.message || (res.granted ? 'Storage permission granted' : 'Storage permission denied'),
    });
  };

  const handleClearAllQueue = async () => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Clear Entire Sync Queue?',
      text: 'This will remove all pending local changes that have not been uploaded to the server.',
      showCancelButton: true,
      confirmButtonText: 'Yes, Clear Queue',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });

    if (confirm.isConfirmed) {
      await clearAllQueue();
      Swal.fire({ icon: 'success', title: 'Queue Cleared', timer: 1500, showConfirmButton: false });
    }
  };

  const isSyncValid = Boolean(
    (lastSyncedAt || dbMeta?.lastSyncedAt) &&
    !dbMeta?.isIncomplete &&
    !isIncompleteSync &&
    (dbMeta?.totalProducts ?? 0) > 0
  );

  const formattedDate = isSyncValid
    ? new Date(lastSyncedAt || dbMeta!.lastSyncedAt).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    : 'Never Synced';

  const totalUnpushed = pendingQueueCount + failedQueueCount;

  return (
    <div className="min-h-screen bg-[url(/bg.png)] bg-cover bg-center bg-no-repeat bg-fixed flex flex-col font-sans">
      <Header showSearch={false} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <PinModal
          isOpen={showPinModal}
          onClose={() => setShowPinModal(false)}
          onSuccess={() => setShowPinModal(false)}
        />

        {!isPinVerified ? (
          <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-8 sm:p-12 border border-white/80 shadow-2xl text-center max-w-md mx-auto my-12 flex flex-col items-center">
            <div className="w-16 h-16 bg-[#0f172a]/10 border border-[#0f172a]/20 rounded-full flex items-center justify-center text-[#0f172a] mb-4">
              <Lock size={32} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#0f172a] uppercase mb-2">SYNC PAGE IS LOCKED</h2>
            <p className="text-gray-500 font-bold max-w-sm mb-6 uppercase text-xs">
              PLEASE ENTER YOUR 4-DIGIT SECURITY PIN TO ACCESS DATA SYNC & LOCAL STORAGE SETTINGS.
            </p>
            <button
              onClick={() => setShowPinModal(true)}
              className="bg-[#0f172a] text-white px-8 py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-wider hover:bg-[#1e293b] shadow-xl transition-all cursor-pointer"
            >
              ENTER SECURITY PIN
            </button>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            {/* Header Navigation Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3.5 bg-[#0f172a]/10 border border-[#0f172a]/20 rounded-full text-[#0f172a] shadow-sm flex items-center justify-center shrink-0">
                  <RefreshCw size={28} />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-4xl font-black text-[#0f172a] uppercase tracking-wide">
                    DATA SYNC & LOCAL STORAGE
                  </h1>
                  <p className="text-[0.7rem] sm:text-xs text-gray-500 font-bold tracking-wide mt-0.5 uppercase">
                    OFFLINE SYNCQUEUE MANAGEMENT, SEQUENTIAL PUSH ENGINE, AND CATALOG STORAGE
                  </p>
                </div>
              </div>
            </div>


            {/* Offline Status Warning Bar */}
            {isOffline && (
              <div className="bg-amber-500/15 border-2 border-amber-500/40 rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-amber-900 shadow-md">
                <div className="p-3 bg-amber-500 text-white rounded-2xl shrink-0">
                  <WifiOff size={24} />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-black uppercase">DEVICE IS OFFLINE</h4>
                  <p className="text-xs font-medium text-amber-800">
                    Pushing local changes and downloading catalog data are disabled until you connect to a network. Local offline actions will continue to be saved to SQLite/IndexedDB & SyncQueue.
                  </p>
                </div>
              </div>
            )}

            {/* Live Storage & Sync Status Overview Strip */}
            <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[2rem] p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                {/* Last Sync Status */}
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl shrink-0 ${isSyncValid ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <span className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest block">LAST SYNC DATE & TIME</span>
                    <span className="text-sm sm:text-base font-black text-[#0f172a]">{formattedDate}</span>
                  </div>
                </div>

                <div className="hidden sm:block w-px h-10 bg-gray-200" />

                {/* Storage Used Status */}
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl shrink-0">
                    <HardDrive size={24} />
                  </div>
                  <div>
                    <span className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest block">LOCAL STORAGE USED</span>
                    <span className="text-sm sm:text-base font-black text-[#0f172a]">
                      {isSyncValid ? (storageStats?.totalUsageMB ?? dbMeta?.imageStorageMB ?? 0) : 0} MB <span className="text-xs font-bold text-gray-500 font-normal">({isSyncValid ? (storageStats?.downloadedImagesCount ?? dbMeta?.totalImages ?? 0) : 0} Images)</span>
                    </span>
                  </div>
                </div>

                <div className="hidden sm:block w-px h-10 bg-gray-200" />

                {/* Local DB Summary */}
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl shrink-0">
                    <Database size={24} />
                  </div>
                  <div>
                    <span className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest block">OFFLINE CATALOG DATA</span>
                    <span className="text-sm sm:text-base font-black text-[#0f172a]">
                      {isSyncValid ? (dbMeta?.totalProducts ?? 0) : 0} Products <span className="text-xs font-bold text-gray-500 font-normal">• {isSyncValid ? (dbMeta?.totalShops ?? 0) : 0} Shops</span>
                    </span>
                  </div>
                </div>

                {isSyncValid && dbMeta?.syncedUserEmail && (
                  <>
                    <div className="hidden sm:block w-px h-10 bg-gray-200" />
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-purple-500/10 text-purple-600 rounded-2xl shrink-0">
                        <User size={24} />
                      </div>
                      <div>
                        <span className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest block">SYNCED SALESREP</span>
                        <span className="text-sm sm:text-base font-black text-[#0f172a] truncate max-w-[180px] block" title={dbMeta.syncedUserEmail}>
                          {dbMeta.syncedUserName || dbMeta.syncedUserEmail}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => refreshStats()}
                className="px-4 py-2.5 bg-white hover:bg-gray-50 text-[#0f172a] rounded-full text-xs font-bold uppercase tracking-wider border border-gray-200 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 self-end md:self-center"
                title="Refresh Storage Statistics"
              >
                <RotateCcw size={14} /> REFRESH STATS
              </button>
            </div>
            {/* Storage & Local Entity Counters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Image Storage Card */}
              <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-6 border border-white/80 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">LOCAL IMAGES</span>
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-2xl">
                    <ImageIcon size={22} />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-[#0f172a]">
                    {storageStats?.downloadedImagesCount ?? dbMeta?.totalImages ?? 0}
                  </div>
                  <p className="text-xs font-bold text-gray-500 uppercase mt-0.5">IMAGES DOWNLOADED</p>
                </div>
                <div className="pt-2 border-t border-gray-100 flex justify-between text-xs font-mono text-gray-500">
                  <span>Image Size:</span>
                  <span className="font-bold text-[#0f172a]">{storageStats?.imageStorageMB ?? dbMeta?.imageStorageMB ?? 0} MB</span>
                </div>
              </div>

              {/* Storage Quota / Limit */}
              <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-6 border border-white/80 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">STORAGE LIMIT</span>
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-2xl">
                    <HardDrive size={22} />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-[#0f172a]">
                    {storageStats?.storageLimitMB ? `${storageStats.storageLimitMB} MB` : 'Unlimited'}
                  </div>
                  <p className="text-xs font-bold text-gray-500 uppercase mt-0.5 font-mono">DEVICE STORAGE LIMIT</p>
                </div>
                <div className="pt-2 border-t border-gray-100 flex justify-between text-xs font-mono text-gray-500">
                  <span>Used by App:</span>
                  <span className="font-bold text-[#0f172a]">{storageStats?.totalUsageMB ?? 0} MB</span>
                </div>
              </div>

              {/* Synced Products */}
              <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-6 border border-white/80 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">PRODUCTS</span>
                  <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-2xl">
                    <Package size={22} />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-[#0f172a]">
                    {dbMeta?.totalProducts ?? 0}
                  </div>
                  <p className="text-xs font-bold text-gray-500 uppercase mt-0.5">PRODUCTS IN LOCALDB</p>
                </div>
                <div className="pt-2 border-t border-gray-100 flex justify-between text-xs font-mono text-gray-500">
                  <span>Categories:</span>
                  <span className="font-bold text-[#0f172a]">{dbMeta?.totalCategories ?? 0}</span>
                </div>
              </div>

              {/* Customer Shops & Invoices */}
              <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-6 border border-white/80 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">SHOPS & ORDERS</span>
                  <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-2xl">
                    <Store size={22} />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-[#0f172a]">
                    {dbMeta?.totalShops ?? 0}
                  </div>
                  <p className="text-xs font-bold text-gray-500 uppercase mt-0.5">ASSIGNED SHOPS SYNCED</p>
                </div>
                <div className="pt-2 border-t border-gray-100 flex justify-between text-xs font-mono text-gray-500">
                  <span>Invoices/Orders:</span>
                  <span className="font-bold text-[#0f172a]">{dbMeta?.totalOrders ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Top Action Cards: Push Changes, Download Catalog, & Delete Sync Data */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* CARD 1: PUSH LOCAL CHANGES */}
              <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-white/20 flex flex-col justify-between">
                <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="px-3.5 py-1 rounded-full text-[0.65rem] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                      <UploadCloud size={13} /> PUSH QUEUE PROCESS
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-400">
                      PENDING: <span className="text-emerald-400">{totalUnpushed}</span>
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide">
                      PUSH LOCAL CHANGES TO SERVER
                    </h2>
                    <p className="text-gray-300 text-xs sm:text-sm font-medium mt-1">
                      Uploads queued offline actions (orders, shop creations, wishlist edits) sequentially to the server. Halts immediately on failure to preserve data integrity.
                    </p>
                  </div>

                  {totalUnpushed > 0 ? (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 font-medium">
                      🚀 <strong>{totalUnpushed} local operation(s)</strong> ready for FIFO sequential push.
                    </div>
                  ) : (
                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-gray-400 font-medium">
                      ✅ Sync queue empty. All local edits are synced with the server.
                    </div>
                  )}
                </div>

                <div className="pt-6 mt-6 border-t border-white/10 space-y-3 relative z-10">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <motion.button
                      whileHover={{ scale: isPushing || isOffline || totalUnpushed === 0 ? 1 : 1.02 }}
                      whileTap={{ scale: isPushing || isOffline || totalUnpushed === 0 ? 1 : 0.98 }}
                      onClick={async () => {
                        await pushChanges();
                        await refreshStats();
                      }}
                      disabled={isPushing || isOffline || totalUnpushed === 0}
                      className={`flex-1 px-6 py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${isOffline || totalUnpushed === 0
                        ? 'bg-white/10 text-gray-400 border border-white/10 cursor-not-allowed'
                        : isPushing
                          ? 'bg-accent/40 text-white cursor-wait border border-accent/50'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 border border-emerald-400'
                        }`}
                    >
                      <UploadCloud size={18} className={isPushing ? 'animate-bounce' : ''} />
                      {isPushing ? 'PUSHING QUEUE...' : 'PUSH LOCAL CHANGES NOW'}
                    </motion.button>

                    {failedQueueCount > 0 && (
                      <button
                        onClick={async () => {
                          await retryFailedPush();
                          await refreshStats();
                        }}
                        disabled={isPushing || isOffline}
                        className="px-5 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-full text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                      >
                        <RotateCcw size={16} /> RETRY FAILED ({failedQueueCount})
                      </button>
                    )}
                  </div>

                  {isPushing && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-gray-300">
                        <span>{pushStatusText || 'Pushing changes step by step...'}</span>
                      </div>
                      <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-400 to-teal-300 h-full w-full animate-pulse rounded-full" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* CARD 2: DOWNLOAD FULL CATALOG (SYNC) & RESUME BALANCE */}
              <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 border border-white/80 shadow-2xl flex flex-col justify-between relative overflow-hidden">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3.5 py-1 rounded-full text-[0.65rem] font-black uppercase tracking-wider bg-blue-500/10 text-blue-700 border border-blue-300/40 flex items-center gap-1.5">
                      <Download size={13} /> CATALOG SYNC ENGINE
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-500">
                      STATUS: <span className={isIncompleteSync || dbMeta?.isIncomplete ? 'text-amber-600 font-black' : 'text-emerald-600 font-black'}>
                        {isIncompleteSync || dbMeta?.isIncomplete ? 'INCOMPLETE / ONLINE' : (dbMeta?.lastSyncedAt ? 'READY OFFLINE' : 'ONLINE MODE')}
                      </span>
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-[#0f172a] uppercase tracking-wide">
                      CATALOGUE & OFFLINE DATA SYNC
                    </h2>
                    <p className="text-gray-500 text-xs sm:text-sm font-medium mt-1">
                      Fetches fresh products, categories, assigned salesrep shops, orders, and images. Supports resilient resume to finish remaining balance without wiping existing data.
                    </p>
                  </div>

                  {isIncompleteSync || dbMeta?.isIncomplete ? (
                    <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-900 text-xs space-y-2">
                      <div className="flex items-center gap-2 font-black uppercase">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                        <span>INCOMPLETE SYNC DETECTED (ONLINE MODE ACTIVE)</span>
                      </div>
                      <p className="text-[0.75rem] text-amber-800 font-medium">
                        {dbMeta?.incompleteReason || 'Previous sync was interrupted. The app remains in Online Mode.'}
                      </p>
                      <div className="p-2 bg-amber-100/80 rounded-xl text-[0.72rem] text-amber-950 font-semibold border border-amber-300/60">
                        💡 <strong>Recommendation:</strong> If continuing the balance sync has any issues, please click <strong>"🔄 RESYNC ALL FROM SCRATCH"</strong> below to clear all old data and perform a fresh sync.
                      </div>
                    </div>
                  ) : null}

                  {totalUnpushed > 0 ? (
                    <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900 text-xs font-medium">
                      <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-black uppercase">SYNC BLOCKED:</strong> Cannot sync. Please push all local changes first. You have <strong>{totalUnpushed}</strong> pending change(s) in SyncQueue.
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-100 border border-gray-200 rounded-2xl text-xs text-gray-600 font-mono">
                      LAST SYNCHRONIZED: <span className="font-bold text-[#0f172a]">{formattedDate}</span>
                    </div>
                  )}
                </div>

                <div className="pt-6 mt-6 border-t border-gray-100 space-y-3">
                  <div className="flex flex-col gap-2.5">
                    {(isIncompleteSync || dbMeta?.isIncomplete) && (
                      <motion.button
                        whileHover={{ scale: isSyncing || isOffline || totalUnpushed > 0 ? 1 : 1.02 }}
                        whileTap={{ scale: isSyncing || isOffline || totalUnpushed > 0 ? 1 : 0.98 }}
                        onClick={async () => {
                          await resumeSync();
                          await refreshStats();
                        }}
                        disabled={isSyncing || isOffline || totalUnpushed > 0}
                        className={`w-full px-6 py-3.5 rounded-full font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${isOffline || totalUnpushed > 0
                          ? 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed'
                          : isSyncing
                            ? 'bg-emerald-600/30 text-emerald-900 border border-emerald-400 cursor-wait'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                          }`}
                      >
                        <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                        ⚡ CONTINUE & FINISH BALANCE SYNC
                      </motion.button>
                    )}

                    <motion.button
                      whileHover={{ scale: isOffline || totalUnpushed > 0 ? 1 : 1.02 }}
                      whileTap={{ scale: isOffline || totalUnpushed > 0 ? 1 : 0.98 }}
                      onClick={async () => {
                        if (isSyncing) {
                          openSyncModal();
                        } else {
                          await triggerSync('full');
                          await refreshStats();
                        }
                      }}
                      disabled={isOffline || totalUnpushed > 0}
                      className={`w-full px-6 py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer ${isOffline || totalUnpushed > 0
                        ? 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed'
                        : isSyncing
                          ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/30'
                          : 'bg-[#0f172a] hover:bg-[#1e293b] text-white shadow-slate-900/20'
                        }`}
                    >
                      <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                      {isSyncing
                        ? `SYNCING IN BACKGROUND (${progress}%) — VIEW POPUP`
                        : (isIncompleteSync || dbMeta?.isIncomplete ? '🔄 RESYNC ALL FROM SCRATCH' : 'SYNC ALL DATA NOW')}
                    </motion.button>
                  </div>

                  {isSyncing && (
                    <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center text-xs font-black uppercase text-sky-900">
                        <span className="truncate pr-2">{syncStatusText}</span>
                        <span className="text-sky-700 font-mono">{progress}%</span>
                      </div>
                      <div className="w-full bg-sky-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-sky-600 h-full transition-all duration-300 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => openSyncModal()}
                        className="w-full text-center text-[0.7rem] font-black uppercase tracking-wider text-sky-700 hover:text-sky-900 underline pt-0.5 cursor-pointer"
                      >
                        ⚡ Open Full Progress Checklist
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* CARD 3: DELETE CACHED SYNC DATA */}
              <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 border border-rose-100 shadow-2xl flex flex-col justify-between relative overflow-hidden">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3.5 py-1 rounded-full text-[0.65rem] font-black uppercase tracking-wider bg-rose-500/10 text-rose-700 border border-rose-300/40 flex items-center gap-1.5">
                      <Trash2 size={13} /> DANGER ZONE
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      TOKEN PRESERVED
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-[#0f172a] uppercase tracking-wide">
                      DELETE CACHED SYNC DATA
                    </h2>
                    <p className="text-gray-500 text-xs sm:text-sm font-medium mt-1">
                      Clears all downloaded products, categories, subcategories, assigned shops, orders, and offline images from local storage. Your user login session remains active.
                    </p>
                  </div>

                  {totalUnpushed > 0 ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-medium">
                      ⚠️ <strong>{totalUnpushed} unpushed change(s)</strong> in queue. You can push first or delete anyway.
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-600 font-mono">
                      STORAGE USED: <span className="font-bold text-[#0f172a]">{storageStats?.totalUsageMB ?? 0} MB</span>
                    </div>
                  )}
                </div>

                <div className="pt-6 mt-6 border-t border-gray-100">
                  <motion.button
                    whileHover={{ scale: isSyncing || isPushing ? 1 : 1.02 }}
                    whileTap={{ scale: isSyncing || isPushing ? 1 : 0.98 }}
                    onClick={async () => {
                      await deleteSyncData();
                      await refreshStats();
                    }}
                    disabled={isSyncing || isPushing}
                    className="w-full px-6 py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl transition-all flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={18} />
                    DELETE CACHED DATA NOW
                  </motion.button>
                </div>
              </div>

            </div>

            {/* QUEUE STATUS SCREEN TABLE & RECOVERY SECTION */}
            <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 border border-white/80 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/80 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Database size={22} className="text-[#0f172a]" />
                    <h3 className="text-xl font-black text-[#0f172a] uppercase">SYNC QUEUE STATUS SCREEN</h3>
                  </div>
                  <p className="text-xs text-gray-500 font-bold uppercase mt-0.5">
                    SEQUENTIAL FIFO QUEUE (001, 002, 003...) FOR ALL OFFLINE MODIFICATIONS
                  </p>
                </div>

                {/* Queue Control Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {failedQueueCount > 0 && (
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-full shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download size={14} /> FAILURE REPORT ({failedQueueCount})
                    </button>
                  )}

                  {queueItems.length > 0 && (
                    <button
                      onClick={handleClearAllQueue}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-rose-50 text-gray-600 hover:text-rose-700 font-bold text-xs uppercase tracking-wider rounded-full border border-gray-200 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={14} /> CLEAR QUEUE
                    </button>
                  )}
                </div>
              </div>

              {/* Queue Items Table */}
              {queueItems.length === 0 ? (
                <div className="py-12 text-center text-gray-400 space-y-3">
                  <CheckCircle2 size={48} className="mx-auto text-emerald-500/40" />
                  <p className="text-sm font-bold uppercase text-gray-500">SyncQueue is empty</p>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Any actions you take offline (adding to wishlist, creating customer shops, placing orders) will automatically appear in this queue.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-[0.65rem] font-black text-gray-400 uppercase tracking-wider">
                        <th className="py-3 px-4">QUEUE ID</th>
                        <th className="py-3 px-4">OPERATION</th>
                        <th className="py-3 px-4">ENTITY</th>
                        <th className="py-3 px-4">ENTITY ID / TITLE</th>
                        <th className="py-3 px-4">STATUS</th>
                        <th className="py-3 px-4 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs font-medium">
                      {queueItems.map((item) => {
                        const isFailed = item.status === 'FAILED';
                        const isSuccess = item.status === 'SUCCESS';
                        const isProcessing = item.status === 'PROCESSING';

                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors ${isFailed
                              ? 'bg-rose-50/80 hover:bg-rose-100/80'
                              : isProcessing
                                ? 'bg-amber-50/80'
                                : isSuccess
                                  ? 'bg-emerald-50/30'
                                  : 'hover:bg-gray-50/60'
                              }`}
                          >
                            <td className="py-3.5 px-4 font-mono font-bold text-[#0f172a]">
                              #{item.queueId || '001'}
                            </td>

                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[0.65rem] font-black uppercase tracking-wider ${item.operation === 'CREATE'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : item.operation === 'DELETE'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                  }`}
                              >
                                {item.operation}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 font-bold text-gray-700 uppercase">
                              {item.entity}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="font-mono font-bold text-[#0f172a]">{item.entityId}</div>
                              <div className="text-[0.65rem] text-gray-500 font-sans truncate max-w-[200px]">
                                {item.title}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              {isSuccess && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.65rem] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  ✅ Success
                                </span>
                              )}
                              {isFailed && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.65rem] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300">
                                  ❌ Failed
                                </span>
                              )}
                              {isProcessing && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.65rem] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                  🔄 Processing
                                </span>
                              )}
                              {item.status === 'PENDING' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.65rem] font-black uppercase bg-gray-100 text-gray-700 border border-gray-300">
                                  ⏳ Waiting
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isFailed && (
                                  <button
                                    onClick={() => setSelectedQueueItem(item)}
                                    className="p-1.5 text-rose-700 hover:bg-rose-200/60 rounded-lg transition-all cursor-pointer"
                                    title="View failure details"
                                  >
                                    <Eye size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => deleteQueueItem(item.id)}
                                  className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-gray-200/60 rounded-lg transition-all cursor-pointer"
                                  title="Remove item"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>


          </motion.div>
        )}
      </main>

      {/* Failure Item Details Modal */}
      <AnimatePresence>
        {selectedQueueItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
            onClick={() => setSelectedQueueItem(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 space-y-5 cursor-default"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#0f172a] uppercase">PUSH FAILURE DETAILS</h3>
                    <p className="text-xs font-mono text-gray-500">Queue ID: #{selectedQueueItem.queueId}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedQueueItem(null)}
                  className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-1">
                  <div className="text-[0.65rem] font-black text-gray-400 uppercase">OPERATION & ENTITY</div>
                  <div className="font-bold text-[#0f172a] text-sm">
                    {selectedQueueItem.operation} {selectedQueueItem.entity}
                  </div>
                  <div className="font-mono text-gray-600">ID: {selectedQueueItem.entityId}</div>
                </div>

                <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 space-y-1">
                  <div className="text-[0.65rem] font-black text-rose-700 uppercase">FAILURE REASON</div>
                  <div className="font-bold text-rose-900 text-sm">
                    {selectedQueueItem.errorMessage || 'Unknown server or network error'}
                  </div>
                </div>

                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-1">
                  <div className="text-[0.65rem] font-black text-gray-400 uppercase">ENDPOINT & METHOD</div>
                  <div className="font-mono text-gray-700">
                    {selectedQueueItem.method} {selectedQueueItem.endpoint}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setSelectedQueueItem(null)}
                  className="px-6 py-2.5 bg-[#0f172a] text-white rounded-full font-bold text-xs uppercase tracking-wider hover:bg-[#1e293b] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Download Failure Report Options Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
            onClick={() => setShowReportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-6 cursor-default"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#0f172a] uppercase">DOWNLOAD FAILURE REPORT</h3>
                    <p className="text-xs text-gray-500 font-medium">Export failed queue items for audit</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    downloadReport('pdf', (user as any)?.name);
                    setShowReportModal(false);
                  }}
                  className="w-full p-4 bg-gray-50 hover:bg-rose-50/80 border border-gray-200 hover:border-rose-300 rounded-2xl text-left transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-rose-500 text-white rounded-xl">
                      <FileText size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#0f172a] uppercase group-hover:text-rose-900">
                        PDF REPORT (RECOMMENDED)
                      </div>
                      <div className="text-[0.65rem] text-gray-500 font-medium">
                        Printable formatted report for sharing and printing
                      </div>
                    </div>
                  </div>
                  <Download size={18} className="text-gray-400 group-hover:text-rose-600" />
                </button>

                <button
                  onClick={() => {
                    downloadReport('csv', (user as any)?.name);
                    setShowReportModal(false);
                  }}
                  className="w-full p-4 bg-gray-50 hover:bg-emerald-50/80 border border-gray-200 hover:border-emerald-300 rounded-2xl text-left transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#0f172a] uppercase group-hover:text-emerald-900">
                        CSV EXCEL EXPORT
                      </div>
                      <div className="text-[0.65rem] text-gray-500 font-medium">
                        Structured tabular file for Microsoft Excel / Sheets
                      </div>
                    </div>
                  </div>
                  <Download size={18} className="text-gray-400 group-hover:text-emerald-600" />
                </button>

                <button
                  onClick={() => {
                    downloadReport('json', (user as any)?.name);
                    setShowReportModal(false);
                  }}
                  className="w-full p-4 bg-gray-50 hover:bg-indigo-50/80 border border-gray-200 hover:border-indigo-300 rounded-2xl text-left transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
                      <FileCode size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#0f172a] uppercase group-hover:text-indigo-900">
                        JSON DEBUG FILE
                      </div>
                      <div className="text-[0.65rem] text-gray-500 font-medium">
                        Raw JSON dataset for developers & tech support
                      </div>
                    </div>
                  </div>
                  <Download size={18} className="text-gray-400 group-hover:text-indigo-600" />
                </button>
              </div>

              <div className="pt-2 text-center text-[0.65rem] text-gray-400 font-mono">
                Report generated for: <span className="font-bold text-gray-700">{(user as any)?.name || 'Salesrep'}</span> ({new Date().toISOString().split('T')[0]})
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
