/**
 * Native Bridge Adapter
 * Central orchestrator for platform detection and native APK feature access.
 */

import { checkStoragePermission, requestStoragePermission, PermissionResult } from '../permissions/storage.permission';
import { checkCameraPermission, requestCameraPermission } from '../permissions/camera.permission';
import { checkLocationPermission, requestLocationPermission } from '../permissions/location.permission';
import { checkBackgroundPermission, requestBackgroundPermission, backgroundKeepAlive } from '../permissions/background.permission';

export interface PlatformInfo {
  isNative: boolean;
  platform: 'web' | 'android' | 'ios';
  isOnline: boolean;
}

export class NativeAdapter {
  /**
   * Detect current platform and connection state
   */
  static getPlatformInfo(): PlatformInfo {
    if (typeof window === 'undefined') {
      return { isNative: false, platform: 'web', isOnline: true };
    }

    const cap = (window as unknown as { Capacitor?: { getPlatform: () => string; isNativePlatform: () => boolean } }).Capacitor;
    const isNative = cap?.isNativePlatform() ?? false;
    const rawPlatform = cap?.getPlatform() ?? 'web';
    const platform = rawPlatform === 'android' ? 'android' : rawPlatform === 'ios' ? 'ios' : 'web';

    return {
      isNative,
      platform,
      isOnline: navigator.onLine
    };
  }

  /**
   * Storage Permission API
   */
  static checkStorage = checkStoragePermission;
  static requestStorage = requestStoragePermission;

  /**
   * Camera Permission API
   */
  static checkCamera = checkCameraPermission;
  static requestCamera = requestCameraPermission;

  /**
   * Location Permission API
   */
  static checkLocation = checkLocationPermission;
  static requestLocation = requestLocationPermission;

  /**
   * Background Sync & Keep-Alive API
   */
  static checkBackground = checkBackgroundPermission;
  static requestBackground = requestBackgroundPermission;
  static backgroundKeepAlive = backgroundKeepAlive;

  /**
   * Request all mandatory permissions sequentially
   */
  static async requestAllPermissions(): Promise<Record<'storage' | 'camera' | 'location', PermissionResult>> {
    const storage = await NativeAdapter.requestStorage();
    const camera = await NativeAdapter.requestCamera();
    const location = await NativeAdapter.requestLocation();

    return { storage, camera, location };
  }
}
