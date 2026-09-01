'use client';

import React, { useEffect, useState } from 'react';
import { updateService, UpdateManifest } from '@/lib/updates/update-service';
import { Download, Sparkles, RefreshCw, X, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function AppUpdateModal() {
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isReadyToRestart, setIsReadyToRestart] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');

  useEffect(() => {
    // Notify Capgo native layer that app has booted successfully
    updateService.initialize();

    // Check for available updates
    async function check() {
      try {
        const curVer = await updateService.getCurrentVersion();
        setCurrentVersion(curVer);

        const status = await updateService.checkForUpdates();
        if (status.hasUpdate && status.manifest) {
          setManifest(status.manifest);
          setIsOpen(true);
        }
      } catch (err) {
        console.warn('[AppUpdateModal] Auto-check error:', err);
      }
    }

    // Delay check slightly so it doesn't block initial page render
    const timer = setTimeout(check, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!isOpen || !manifest) {
    return null;
  }

  const handleStartUpdate = async () => {
    try {
      setDownloading(true);
      setErrorMsg(null);
      setProgress(0);

      await updateService.applyWebUpdate(manifest, (pct) => {
        setProgress(pct);
      });

      setIsReadyToRestart(true);
    } catch (err: any) {
      console.error('[AppUpdateModal] Update failed:', err);
      setErrorMsg(err?.message || 'Failed to download update. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRestart = async () => {
    await updateService.reloadApp();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-6 text-slate-800 dark:text-slate-100">
        {/* Dismiss Button (only if not mandatory and not currently downloading) */}
        {!manifest.mandatory && !downloading && !isReadyToRestart && (
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
            {isReadyToRestart ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : downloading ? (
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            ) : (
              <Sparkles className="w-6 h-6 text-blue-600" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold leading-tight">
              {isReadyToRestart
                ? 'Update Ready to Apply!'
                : 'New Version Available'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Current: v{currentVersion} &rarr;{' '}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                v{manifest.version}
              </span>
            </p>
          </div>
        </div>

        {/* Release Notes */}
        {manifest.releaseNotes && (
          <div className="my-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 max-h-32 overflow-y-auto">
            <span className="font-semibold block mb-1 text-slate-700 dark:text-slate-200">
              What&apos;s New:
            </span>
            <p className="whitespace-pre-line">{manifest.releaseNotes}</p>
          </div>
        )}

        {/* Progress Bar */}
        {downloading && (
          <div className="my-4">
            <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              <span>Downloading update package...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, progress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div className="my-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex gap-2">
          {isReadyToRestart ? (
            <button
              onClick={handleRestart}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20"
            >
              <RefreshCw className="w-4 h-4" />
              Restart App Now
            </button>
          ) : downloading ? (
            <button
              disabled
              className="w-full py-2.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 font-medium text-sm cursor-not-allowed flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4 animate-spin" />
              Downloading ({Math.round(progress)}%)...
            </button>
          ) : (
            <>
              {!manifest.mandatory && (
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm transition-colors"
                >
                  Later
                </button>
              )}
              <button
                onClick={handleStartUpdate}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20"
              >
                <Download className="w-4 h-4" />
                Update Now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
