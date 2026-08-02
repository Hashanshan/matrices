'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function HardwareBackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Listen for Capacitor native back button event on Android/iOS devices
    const handleNativeBackButton = (e: any) => {
      if (pathname !== '/') {
        e.preventDefault();
        router.back();
      }
    };

    // Attach to CapacitorApp backButton if available
    const capApp = (window as any)?.Capacitor?.Plugins?.App;
    let listener: any = null;

    if (capApp && typeof capApp.addListener === 'function') {
      capApp.addListener('backButton', (state: { canGoBack: boolean }) => {
        if (pathname !== '/' && state.canGoBack) {
          router.back();
        }
      }).then((l: any) => {
        listener = l;
      }).catch(() => { /* ignore */ });
    }

    return () => {
      if (listener && typeof listener.remove === 'function') {
        listener.remove();
      }
    };
  }, [pathname, router]);

  return null;
}
