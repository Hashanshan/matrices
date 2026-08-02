'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/header';
import { useAuth } from '@/lib/contexts/auth-context';
import { useSync } from '@/lib/contexts/sync-context';
import { useDataMode } from '@/lib/contexts/data-mode-context';
import PinModal from '@/components/pin-modal';
import { motion } from 'framer-motion';
import {
  RefreshCw, Database, HardDrive, Image as ImageIcon, Store, FileText,
  Package, Layers, ShieldCheck, Wifi, WifiOff, CheckCircle2, AlertCircle,
  Smartphone, Globe, Lock, ArrowRight, Server, Cpu
} from 'lucide-react';
import Link from 'next/link';
import { offlineDB, SyncMetadata } from '@/lib/offline/indexed-db';
import { getStorageStats, StorageStats } from '@/lib/offline/image-cache';
import { NativeAdapter } from '@/mobile/bridge/native-adapter';

export default function SyncSettingsPage() {
  const { isPinVerified, resetPinVerification } = useAuth();
  const { isSyncing, progress, syncStatusText, lastSyncedAt, isOffline, meta, triggerSync } = useSync();
  const { dataMode, setDataMode } = useDataMode();

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

  // Load store stats and metadata from IndexedDB
  const refreshStats = useCallback(async () => {
    try {
      const [m, stats, perm] = await Promise.all([
        offlineDB.getMeta(),
        getStorageStats(),
        NativeAdapter.checkStorage(),
      ]);

      if (m) setDbMeta(m);
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
    resetPinVerification();
    setPlatformInfo(NativeAdapter.getPlatformInfo());
    refreshStats();
  }, []);

  useEffect(() => {
    setShowPinModal(!isPinVerified);
  }, [isPinVerified]);

  useEffect(() => {
    if (!isSyncing) {
      refreshStats();
    }
  }, [isSyncing, refreshStats]);

  const handleRequestPermission = async () => {
    const res = await NativeAdapter.requestStorage();
    setPermissionState({
      granted: res.granted,
      message: res.message || (res.granted ? 'Storage permission granted' : 'Storage permission denied'),
    });
  };

  const formattedDate = lastSyncedAt || dbMeta?.lastSyncedAt
    ? new Date(lastSyncedAt || dbMeta!.lastSyncedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Never Synced';

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
                    MANAGE OFFLINE LOCAL STORAGE, IMAGE DOWNLOADS, AND APK SYNC DATA
                  </p>
                </div>
              </div>

              {/* Navigation Shortcuts */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <Link
                  href="/settings/shops"
                  className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-4 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Store size={14} /> MY SHOPS
                </Link>
                <Link
                  href="/settings/orders"
                  className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-4 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FileText size={14} /> ORDERS
                </Link>
                <Link
                  href="/settings/security"
                  className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-4 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap"
                >
                  <ShieldCheck size={14} /> SECURITY
                </Link>
              </div>
            </div>

            {/* Sync Command Card */}
            <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-[2.5rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden border border-white/20">
              <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-accent/20 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-3.5 py-1 rounded-full text-[0.65rem] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                      <CheckCircle2 size={13} /> {isOffline ? 'Offline Mode' : 'Server Connected'}
                    </span>
                    <span className="px-3.5 py-1 rounded-full text-[0.65rem] font-black uppercase tracking-wider bg-white/10 text-gray-200 border border-white/20 flex items-center gap-1.5">
                      <Smartphone size={13} /> Platform: {platformInfo.isNative ? 'Android APK Native' : 'Web Browser'}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-3xl font-black uppercase tracking-wide">
                    FULL CATALOGUE & INVOICES SYNC
                  </h2>
                  <p className="text-gray-300 text-xs sm:text-sm font-medium max-w-xl">
                    Download products, categories, assigned shops, invoices, and product images directly to your device local storage. Works smoothly offline once synchronized.
                  </p>

                  <div className="text-xs font-mono text-gray-400 pt-1">
                    LAST SYNCHRONIZED: <span className="text-emerald-400 font-bold">{formattedDate}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                  <motion.button
                    whileHover={{ scale: isSyncing || isOffline ? 1 : 1.03 }}
                    whileTap={{ scale: isSyncing || isOffline ? 1 : 0.97 }}
                    onClick={() => triggerSync()}
                    disabled={isSyncing || isOffline}
                    className={`px-8 py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer ${
                      isOffline
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-not-allowed'
                        : isSyncing
                        ? 'bg-accent/30 text-white border border-accent/50 cursor-wait'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-emerald-500/30 border border-emerald-400'
                    }`}
                  >
                    <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                    {isSyncing ? `SYNCING (${progress}%)` : 'SYNC ALL DATA NOW'}
                  </motion.button>

                  <button
                    onClick={handleRequestPermission}
                    className="px-6 py-3 rounded-full font-bold text-xs uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck size={16} /> VERIFY PERMISSIONS
                  </button>
                </div>
              </div>

              {isSyncing && (
                <div className="mt-6 pt-6 border-t border-white/10 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-gray-300">
                    <span>{syncStatusText}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-400 to-teal-300 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Storage & Images Card */}
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

            {/* Detailed Data Sync Breakdown */}
            <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 border border-white/80 shadow-lg space-y-6">
              <div className="flex items-center justify-between border-b border-gray-200/60 pb-4">
                <div className="flex items-center gap-3">
                  <Database className="text-[#0f172a]" size={24} />
                  <div>
                    <h3 className="text-lg font-black text-[#0f172a] uppercase">LOCALDB SYNCHRONIZED ENTITIES</h3>
                    <p className="text-xs text-gray-500 font-bold uppercase">Data stored safely in offline IndexedDB database</p>
                  </div>
                </div>
                <button
                  onClick={() => setDataMode(dataMode === 'online' ? 'offline' : 'online')}
                  className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition-all ${
                    dataMode === 'offline'
                      ? 'bg-amber-500/10 text-amber-700 border-amber-300'
                      : 'bg-emerald-500/10 text-emerald-700 border-emerald-300'
                  }`}
                >
                  Active Mode: {dataMode.toUpperCase()}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package size={20} className="text-blue-600" />
                    <div>
                      <div className="text-xs font-black text-[#0f172a] uppercase">PRODUCTS</div>
                      <div className="text-[0.65rem] text-gray-500 font-medium uppercase">Catalog items</div>
                    </div>
                  </div>
                  <span className="text-sm font-black text-[#0f172a] font-mono">{dbMeta?.totalProducts ?? 0}</span>
                </div>

                <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Layers size={20} className="text-indigo-600" />
                    <div>
                      <div className="text-xs font-black text-[#0f172a] uppercase">CATEGORIES</div>
                      <div className="text-[0.65rem] text-gray-500 font-medium uppercase">Main categories</div>
                    </div>
                  </div>
                  <span className="text-sm font-black text-[#0f172a] font-mono">{dbMeta?.totalCategories ?? 0}</span>
                </div>

                <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Layers size={20} className="text-teal-600" />
                    <div>
                      <div className="text-xs font-black text-[#0f172a] uppercase">SUBCATEGORIES</div>
                      <div className="text-[0.65rem] text-gray-500 font-medium uppercase">Sub-groupings</div>
                    </div>
                  </div>
                  <span className="text-sm font-black text-[#0f172a] font-mono">{dbMeta?.totalSubcategories ?? 0}</span>
                </div>

                <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Store size={20} className="text-amber-600" />
                    <div>
                      <div className="text-xs font-black text-[#0f172a] uppercase">CUSTOMER SHOPS</div>
                      <div className="text-[0.65rem] text-gray-500 font-medium uppercase">Assigned salesrep shops</div>
                    </div>
                  </div>
                  <span className="text-sm font-black text-[#0f172a] font-mono">{dbMeta?.totalShops ?? 0}</span>
                </div>

                <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-rose-600" />
                    <div>
                      <div className="text-xs font-black text-[#0f172a] uppercase">INVOICES & ORDERS</div>
                      <div className="text-[0.65rem] text-gray-500 font-medium uppercase">Sales history & bills</div>
                    </div>
                  </div>
                  <span className="text-sm font-black text-[#0f172a] font-mono">{dbMeta?.totalOrders ?? 0}</span>
                </div>

                <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={20} className="text-emerald-600" />
                    <div>
                      <div className="text-xs font-black text-[#0f172a] uppercase">STORAGE PERMISSION</div>
                      <div className="text-[0.65rem] text-gray-500 font-medium uppercase truncate max-w-[120px]">{permissionState.message}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-full ${permissionState.granted ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                    {permissionState.granted ? 'Granted' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
