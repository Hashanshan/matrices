/**
 * Camera Permission Handler
 * Handles checking and requesting Camera permissions for shop check-ins and barcode scanning.
 */

export interface PermissionResult {
  granted: boolean;
  message?: string;
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

export async function checkCameraPermission(): Promise<PermissionResult> {
  if (typeof window === 'undefined') {
    return { granted: false, message: 'SSR Environment' };
  }

  const isCapacitor = Boolean((window as unknown as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor?.isNativePlatform());

  if (isCapacitor) {
    const camModule = await loadCapacitorCamera();
    if (camModule?.Camera) {
      try {
        const status = await camModule.Camera.checkPermissions();
        const isGranted = status.camera === 'granted';
        return {
          granted: isGranted,
          message: isGranted ? 'Camera permission granted' : 'Camera permission denied'
        };
      } catch {
        return { granted: false, message: 'Native camera check unavailable' };
      }
    }
  }

  // Web Browser context
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return {
        granted: permissions.state === 'granted',
        message: `Camera state: ${permissions.state}`
      };
    } catch {
      return { granted: true, message: 'Browser camera API supported' };
    }
  }

  return { granted: false, message: 'Camera API not supported on this browser' };
}

export async function requestCameraPermission(): Promise<PermissionResult> {
  if (typeof window === 'undefined') {
    return { granted: false, message: 'SSR Environment' };
  }

  const isCapacitor = Boolean((window as unknown as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor?.isNativePlatform());

  if (isCapacitor) {
    const camModule = await loadCapacitorCamera();
    if (camModule?.Camera) {
      try {
        const status = await camModule.Camera.requestPermissions({ permissions: ['camera'] });
        const isGranted = status.camera === 'granted';
        return {
          granted: isGranted,
          message: isGranted ? 'Camera permission granted' : 'Camera permission denied by user'
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Camera permission error';
        return { granted: false, message: errorMessage };
      }
    }
  }

  // Web Browser fallback via getUserMedia
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      return { granted: true, message: 'Web Camera permission granted' };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Camera access denied';
      return { granted: false, message: errorMessage };
    }
  }

  return { granted: false, message: 'Camera device not found' };
}
