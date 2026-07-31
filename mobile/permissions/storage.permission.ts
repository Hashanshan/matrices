/**
 * Storage Permission Handler
 * Handles checking and requesting Storage permissions natively and in web context.
 */

export interface PermissionResult {
  granted: boolean;
  message?: string;
}

async function loadCapacitorFilesystem(): Promise<any> {
  try {
    const dynamicImport = new Function('modulePath', 'return import(modulePath)');
    return await dynamicImport('@capacitor/filesystem');
  } catch {
    return null;
  }
}

export async function checkStoragePermission(): Promise<PermissionResult> {
  if (typeof window === 'undefined') {
    return { granted: false, message: 'SSR Environment' };
  }

  const isCapacitor = Boolean((window as unknown as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor?.isNativePlatform());

  if (isCapacitor) {
    const fsModule = await loadCapacitorFilesystem();
    if (fsModule?.Filesystem) {
      try {
        const status = await fsModule.Filesystem.checkPermissions();
        return {
          granted: status.publicStorage === 'granted',
          message: status.publicStorage === 'granted' ? 'Storage permission granted' : 'Storage permission denied'
        };
      } catch {
        return { granted: true, message: 'Native storage check fallback' };
      }
    }
  }

  // Web Browser environment (IndexedDB and Storage API available)
  if ('indexedDB' in window && 'caches' in window) {
    return { granted: true, message: 'Web Storage & Cache API available' };
  }

  return { granted: false, message: 'Web Storage API not supported' };
}

export async function requestStoragePermission(): Promise<PermissionResult> {
  if (typeof window === 'undefined') {
    return { granted: false, message: 'SSR Environment' };
  }

  const isCapacitor = Boolean((window as unknown as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor?.isNativePlatform());

  if (isCapacitor) {
    const fsModule = await loadCapacitorFilesystem();
    if (fsModule?.Filesystem) {
      try {
        const status = await fsModule.Filesystem.requestPermissions();
        const isGranted = status.publicStorage === 'granted';
        return {
          granted: isGranted,
          message: isGranted ? 'Storage permission granted' : 'Storage permission denied by user'
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Storage permission error';
        return { granted: false, message: errorMessage };
      }
    }
  }

  // Web storage is implicitly granted by the browser for origin
  return { granted: true, message: 'Web storage ready' };
}
