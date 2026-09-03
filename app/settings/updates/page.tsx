'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/header';
import { useAuth } from '@/lib/contexts/auth-context';
import { updateService, UpdateManifest } from '@/lib/updates/update-service';
import {
  Download,
  RefreshCw,
  Sparkles,
  Smartphone,
  Globe,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  ShieldCheck,
  ExternalLink,
  Layers,
  HardDrive,
  Copy,
  Check,
} from 'lucide-react';
import { motion } from 'framer-motion';

import { useRouter } from 'next/navigation';

export default function UpdatesSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();

  // If logged-in user is a shop account, block access and redirect to catalogue
  useEffect(() => {
    if (user?.role === 'shop') {
      router.replace('/catalogue');
    }
  }, [user, router]);

  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('1.0.0');
  const [isChecking, setIsChecking] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadingOta, setDownloadingOta] = useState(false);
  const [otaProgress, setOtaProgress] = useState(0);
  const [isReadyToRestart, setIsReadyToRestart] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const frontEndUrl = (process.env.NEXT_PUBLIC_FRONT_END_URL || 'https://matrices.devcodz.com').replace(/\/$/, '');
  const fallbackApkUrl = `${frontEndUrl}/api/updates/download-apk`;
  const finalApkDownloadUrl =
    manifest?.apkUrl && manifest.apkUrl.startsWith('http') && !manifest.apkUrl.includes('localhost')
      ? manifest.apkUrl
      : fallbackApkUrl;

  const formatReleaseDate = (dateStr?: string) => {
    if (!dateStr) return 'Latest Release';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const fetchVersionInfo = async () => {
    setIsChecking(true);
    setErrorMsg(null);
    try {
      const curVer = await updateService.getCurrentVersion();
      setCurrentVersion(curVer);

      const status = await updateService.checkForUpdates();
      if (status.manifest) {
        setManifest(status.manifest);
      }
      setHasUpdate(status.hasUpdate);
    } catch (err: any) {
      console.warn('Failed to check updates:', err);
      setErrorMsg('Could not fetch latest version information from server.');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    fetchVersionInfo();
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(finalApkDownloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleApplyOta = async () => {
    if (!manifest) return;
    try {
      setDownloadingOta(true);
      setErrorMsg(null);
      setOtaProgress(0);

      await updateService.applyWebUpdate(manifest, (pct) => {
        setOtaProgress(pct);
      });

      setIsReadyToRestart(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to download OTA live update package.');
    } finally {
      setDownloadingOta(false);
    }
  };

  const handleRestart = async () => {
    await updateService.reloadApp();
  };

  return (
    <div className="min-h-screen pb-16">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Download className="w-7 h-7" />
              </div>
              App Updates & Downloads
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage live web updates, check versions, and download the official Android APK.
            </p>
          </div>

          <button
            onClick={fetchVersionInfo}
            disabled={isChecking}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin text-blue-600' : ''}`} />
            {isChecking ? 'Checking Server...' : 'Check for Updates'}
          </button>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-600 dark:text-red-400 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Status & Release Notes Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* Version Overview Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none"
            >
              <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      System Version Status
                    </h2>
                    <span className="text-xs text-slate-400">
                      Self-Hosted Over-The-Air Engine
                    </span>
                  </div>
                </div>

                {hasUpdate ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Update Available
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Up to Date
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80">
                  <span className="text-xs font-medium text-slate-400 block mb-1">Current Version</span>
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    v{currentVersion}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80">
                  <span className="text-xs font-medium text-slate-400 block mb-1">Latest Version</span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    v{manifest?.version || '1.2.0'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80">
                  <span className="text-xs font-medium text-slate-400 block mb-1">Release Date</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {formatReleaseDate(manifest?.apkUpdatedAt || manifest?.publishedAt)}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80">
                  <span className="text-xs font-medium text-slate-400 block mb-1">Android APK</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    v{manifest?.apkVersion || manifest?.version || '1.2.0'}
                  </span>
                  <span className="text-[11px] text-slate-400 block font-normal">
                    {manifest?.apkFileSizeMb || '23.48 MB'}
                  </span>
                </div>
              </div>

              {/* In-App Live Update Action (when in Mobile App) */}
              {hasUpdate && manifest && (
                <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 mb-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">
                        Live Web Update Ready (v{manifest.version})
                      </h4>
                      <p className="text-xs text-blue-700/80 dark:text-blue-400/80 mt-0.5">
                        Download web assets directly to your device without reinstalling the APK.
                      </p>
                    </div>

                    {isReadyToRestart ? (
                      <button
                        onClick={handleRestart}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all shrink-0"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Restart Now
                      </button>
                    ) : (
                      <button
                        onClick={handleApplyOta}
                        disabled={downloadingOta}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-95 transition-all shrink-0 disabled:opacity-50"
                      >
                        {downloadingOta ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        {downloadingOta ? `Downloading (${Math.round(otaProgress)}%)` : 'Update Now'}
                      </button>
                    )}
                  </div>

                  {downloadingOta && (
                    <div className="mt-3 w-full h-2 bg-blue-200 dark:bg-blue-900/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${Math.max(5, otaProgress)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Release Notes */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Release Notes & Changelog
                </h3>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-48 overflow-y-auto">
                  <p className="whitespace-pre-line">
                    {manifest?.releaseNotes ||
                      '• Performance optimizations for catalogue search and image caching.\n• Offline-first sync engine improvements.\n• Live OTA update system support.'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Download Android APK Card */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-6 rounded-3xl bg-gradient-to-br from-[#1c2c4d] to-[#0f172a] text-white shadow-2xl relative overflow-hidden"
            >
              {/* Background ambient glow */}
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-blue-400 border border-white/10">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight">Android Application</h2>
                    <span className="text-xs text-slate-400">Direct APK Download</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-6">
                  Install the standalone native app for offline catalogue browsing, camera barcode scanning, GPS shop check-ins, and thermal receipt printing.
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-white/10 text-slate-300">
                    <span>File Name</span>
                    <span className="font-mono text-white">{manifest?.apkFileName || 'matrices-latest.apk'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-white/10 text-slate-300">
                    <span>File Size</span>
                    <span className="font-semibold text-white">{manifest?.apkFileSizeMb || '23.48 MB'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-white/10 text-slate-300">
                    <span>Release Date</span>
                    <span className="font-medium text-blue-300">
                      {formatReleaseDate(manifest?.apkUpdatedAt || manifest?.publishedAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-white/10 text-slate-300">
                    <span>Compatibility</span>
                    <span className="font-medium text-emerald-400">Android 7.0+ (API 24+)</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-white/10 text-slate-300">
                    <span>Security</span>
                    <span className="font-medium text-blue-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified Build
                    </span>
                  </div>
                </div>

                {/* Direct Download Action Button */}
                <a
                  href={finalApkDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={manifest?.apkFileName || "matrices-latest.apk"}
                  className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/40 mb-3"
                >
                  <Download className="w-4 h-4" />
                  Download Android APK
                </a>

                {/* Copy Link Button */}
                <button
                  onClick={handleCopyLink}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-medium text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Download Link Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Direct Download Link
                    </>
                  )}
                </button>
              </div>
            </motion.div>

            {/* Install Guide Card */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs text-slate-600 dark:text-slate-400 space-y-2.5">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-sm">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                How to Install on Android
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed">
                <li>Click <strong>Download Android APK</strong> on your phone.</li>
                <li>When prompted, tap <strong>Open</strong> after downloading.</li>
                <li>Allow <em>&quot;Install from unknown sources&quot;</em> if prompted by Android.</li>
                <li>Tap <strong>Install</strong> to complete setup.</li>
              </ol>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
