/**
 * Storage Permission Handler
 * Handles checking and requesting Storage and Photos permissions natively and in web context.
 */

export interface PermissionResult {
  granted: boolean;
  message?: string;
}

async function loadCapacitorFilesystem(): Promise<any> {
  if (typeof window === 'undefined') return null;
  try {
    const { Filesystem } = await import('@capacitor/filesystem');
    return { Filesystem };
  } catch {
    return null;
  }
}

async function loadCapacitorCamera(): Promise<any> {
  if (typeof window === 'undefined') return null;
  try {
    const { Camera } = await import('@capacitor/camera');
    return { Camera };
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
    const camModule = await loadCapacitorCamera();

    let fsGranted = false;
    let photosGranted = false;

    if (fsModule?.Filesystem) {
      try {
        const status = await fsModule.Filesystem.checkPermissions();
        fsGranted = status.publicStorage === 'granted';
      } catch {
        fsGranted = false;
      }
    }

    if (!fsGranted && camModule?.Camera) {
      try {
        const status = await camModule.Camera.checkPermissions();
        photosGranted = status.photos === 'granted';
      } catch {
        photosGranted = false;
      }
    }

    const userAgent = navigator.userAgent || '';
    const isAndroid13OrHigher = /Android\s+([1-9][3-9]|\d{3,})/i.test(userAgent);

    if (fsGranted || photosGranted || isAndroid13OrHigher) {
      return {
        granted: true,
        message: fsGranted || photosGranted ? 'Storage/Photos permission granted' : 'Native app local storage ready (Android 13+)'
      };
    }
  }

  if ('indexedDB' in window) {
    return { granted: true, message: 'Web Storage & LocalDB available' };
  }

  return { granted: false, message: 'Local Storage API not supported' };
}

export async function requestStoragePermission(): Promise<PermissionResult> {
  if (typeof window === 'undefined') {
    return { granted: false, message: 'SSR Environment' };
  }

  const isCapacitor = Boolean((window as unknown as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor?.isNativePlatform());

  if (isCapacitor) {
    const fsModule = await loadCapacitorFilesystem();
    const camModule = await loadCapacitorCamera();

    let fsGranted = false;
    let photosGranted = false;

    if (fsModule?.Filesystem) {
      try {
        const status = await fsModule.Filesystem.requestPermissions();
        fsGranted = status.publicStorage === 'granted';
      } catch (err) {
        console.warn('Filesystem permission request:', err);
      }
    }

    if (!fsGranted && camModule?.Camera) {
      try {
        const status = await camModule.Camera.requestPermissions({ permissions: ['photos'] });
        photosGranted = status.photos === 'granted';
      } catch (err) {
        console.warn('Camera photos permission request:', err);
      }
    }

    const userAgent = navigator.userAgent || '';
    const isAndroid13OrHigher = /Android\s+([1-9][3-9]|\d{3,})/i.test(userAgent);

    if (fsGranted || photosGranted || isAndroid13OrHigher) {
      return {
        granted: true,
        message: (fsGranted || photosGranted) ? 'Storage permission granted by user' : 'Native app storage ready'
      };
    }

    return { granted: false, message: 'Storage permission denied by user' };
  }

  return { granted: true, message: 'Web storage ready' };
}

