
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

export interface UpdateManifest {
  version: string;
  build?: number;
  url: string;
  checksum: string;
  apkUrl: string;
  apkVersion: string;
  apkVersionCode?: number;
  mandatory: boolean;
  releaseNotes?: string;
  publishedAt?: string;
  apkFileName?: string;
  apkFileSizeMb?: string;
  apkUpdatedAt?: string;
}

export interface UpdateStatus {
  hasUpdate: boolean;
  isWebUpdate: boolean;
  isApkUpdate: boolean;
  manifest?: UpdateManifest;
  currentVersion?: string;
}

class UpdateService {
  private isInitialized = false;

  /**
   * Initializes the updater service and notifies the native layer that the app is ready.
   * This is mandatory for Capgo to prevent auto-rollback on fresh bundle loads.
   */
  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.isInitialized) {
      return;
    }

    try {
      await CapacitorUpdater.notifyAppReady();
      this.isInitialized = true;
      console.log('[UpdateService] App notified as ready to Capgo native runner.');
    } catch (error) {
      console.warn('[UpdateService] Failed to notify app ready:', error);
    }
  }

  /**
   * Gets the currently active bundle / app version.
   */
  async getCurrentVersion(): Promise<string> {
    if (!Capacitor.isNativePlatform()) {
      return '1.0.0-web';
    }

    try {
      const current = await CapacitorUpdater.current();
      return current.bundle.version || current.bundle.id || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  /**
   * Checks the self-hosted backend endpoint for available updates.
   */
  async checkForUpdates(): Promise<UpdateStatus> {
    const frontEndUrl = (process.env.NEXT_PUBLIC_FRONT_END_URL || 'https://matrices.devcodz.com').replace(/\/$/, '');
    const backendUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://magnum-backend.vercel.app').replace(/\/$/, '');
    let manifest: UpdateManifest | null = null;

    // 1. Try Next.js frontend update endpoint
    try {
      const res = await fetch(`${frontEndUrl}/api/updates/version`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        manifest = await res.json();
      }
    } catch {
      // Continue to backend fallback
    }

    // 2. If no valid manifest from frontend, try backend API endpoint
    if (!manifest || !manifest.apkUrl) {
      try {
        const bRes = await fetch(`${backendUrl}/api/updates/version`, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (bRes.ok) {
          const bData = await bRes.json();
          manifest = { ...(manifest || {}), ...bData };
        }
      } catch {
        // Backend offline
      }
    }

    if (!manifest) {
      return {
        hasUpdate: false,
        isWebUpdate: false,
        isApkUpdate: false,
      };
    }

    const currentVersion = await this.getCurrentVersion();
    const isWebUpdate = this.isNewerVersion(currentVersion, manifest.version);

    return {
      hasUpdate: isWebUpdate,
      isWebUpdate,
      isApkUpdate: false,
      manifest,
      currentVersion,
    };
  }

  /**
   * Downloads the remote web bundle and activates it via Capgo CapacitorUpdater.
   */
  async applyWebUpdate(
    manifest: UpdateManifest,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[UpdateService] Skipping native bundle update in web browser mode.');
      return false;
    }

    try {
      let progressListener: PluginListenerHandle | null = null;
      if (onProgress) {
        progressListener = await CapacitorUpdater.addListener('download', (info) => {
          onProgress(info.percent);
        });
      }

      console.log(`[UpdateService] Downloading bundle v${manifest.version} from ${manifest.url}`);
      const bundle = await CapacitorUpdater.download({
        url: manifest.url,
        version: manifest.version,
        checksum: manifest.checksum || undefined,
      });

      if (progressListener) {
        await progressListener.remove();
      }

      console.log('[UpdateService] Activating bundle:', bundle);
      await CapacitorUpdater.set({ id: bundle.id });

      return true;
    } catch (error) {
      console.error('[UpdateService] Failed to download or set bundle update:', error);
      throw error;
    }
  }

  /**
   * Triggers an immediate app reload with the newly activated bundle.
   */
  async reloadApp(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await CapacitorUpdater.reload();
    } else {
      window.location.reload();
    }
  }

  /**
   * Simple semver-style comparator (e.g. "1.2.0" > "1.1.0")
   */
  private isNewerVersion(current: string, remote: string): boolean {
    const cleanCurrent = current.replace(/[^0-9.]/g, '');
    const cleanRemote = remote.replace(/[^0-9.]/g, '');

    const pCurrent = cleanCurrent.split('.').map((n) => parseInt(n, 10) || 0);
    const pRemote = cleanRemote.split('.').map((n) => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(pCurrent.length, pRemote.length); i++) {
      const c = pCurrent[i] || 0;
      const r = pRemote[i] || 0;
      if (r > c) return true;
      if (r < c) return false;
    }
    return false;
  }
}

export const updateService = new UpdateService();
