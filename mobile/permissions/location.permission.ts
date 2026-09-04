/**
 * Geolocation Permission Handler
 * Handles checking and requesting Location permissions for shop GPS check-ins.
 */

export interface PermissionResult {
  granted: boolean;
  message?: string;
}

async function loadCapacitorGeolocation(): Promise<any> {
  if (typeof window === 'undefined') return null;
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    return { Geolocation };
  } catch {
    return null;
  }
}

export async function checkLocationPermission(): Promise<PermissionResult> {
  if (typeof window === 'undefined') {
    return { granted: false, message: 'SSR Environment' };
  }

  const isCapacitor = Boolean((window as unknown as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor?.isNativePlatform());

  if (isCapacitor) {
    const geoModule = await loadCapacitorGeolocation();
    if (geoModule?.Geolocation) {
      try {
        const status = await geoModule.Geolocation.checkPermissions();
        const isGranted = status.location === 'granted' || status.coarseLocation === 'granted';
        return {
          granted: isGranted,
          message: isGranted ? 'Location permission granted' : 'Location permission denied'
        };
      } catch {
        return { granted: false, message: 'Native location check unavailable' };
      }
    }
  }

  // Web Browser context
  if ('geolocation' in navigator) {
    try {
      const permissions = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return {
        granted: permissions.state === 'granted',
        message: `Geolocation state: ${permissions.state}`
      };
    } catch {
      return { granted: true, message: 'Browser Geolocation API supported' };
    }
  }

  return { granted: false, message: 'Geolocation not supported by browser' };
}

export async function requestLocationPermission(): Promise<PermissionResult> {
  if (typeof window === 'undefined') {
    return { granted: false, message: 'SSR Environment' };
  }

  const isCapacitor = Boolean((window as unknown as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor?.isNativePlatform());

  if (isCapacitor) {
    const geoModule = await loadCapacitorGeolocation();
    if (geoModule?.Geolocation) {
      try {
        const status = await geoModule.Geolocation.requestPermissions();
        const isGranted = status.location === 'granted' || status.coarseLocation === 'granted';
        return {
          granted: isGranted,
          message: isGranted ? 'Location permission granted' : 'Location permission denied by user'
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Location permission error';
        return { granted: false, message: errorMessage };
      }
    }
  }

  // Web Browser fallback via navigator.geolocation.getCurrentPosition
  if ('geolocation' in navigator) {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve({ granted: true, message: 'Location permission granted' }),
        (err) => resolve({ granted: false, message: err.message || 'Location permission denied' }),
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  }

  return { granted: false, message: 'Geolocation unavailable' };
}
