'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Global history stack persisted across re-renders
const navHistory: string[] = [];

export default function HardwareBackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const prevPathname = useRef<string | null>(null);

  // Track every pathname change into our custom history stack
  useEffect(() => {
    if (!pathname) return;

    // Avoid duplicate consecutive entries (e.g. fast re-renders)
    if (navHistory.length === 0 || navHistory[navHistory.length - 1] !== pathname) {
      navHistory.push(pathname);
      // Keep stack bounded to last 50 entries
      if (navHistory.length > 50) navHistory.shift();
    }

    prevPathname.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const goBack = () => {
      // Pop the current page off the stack
      if (navHistory.length > 0 && navHistory[navHistory.length - 1] === pathname) {
        navHistory.pop();
      }

      if (navHistory.length > 0) {
        // Navigate to the previous entry in our stack
        const target = navHistory[navHistory.length - 1];
        router.replace(target);
      } else if (pathname !== '/') {
        // Fallback: try browser back, then go to catalogue
        try {
          router.back();
        } catch {
          router.replace('/catalogue');
        }
      }
      // If already on root '/', do nothing (prevent app exit flicker)
    };

    // ── Capacitor native back button (Android hardware / iOS gesture) ──────────
    const capApp = (window as any)?.Capacitor?.Plugins?.App;
    let capacitorListener: any = null;

    if (capApp && typeof capApp.addListener === 'function') {
      capApp
        .addListener('backButton', () => {
          goBack();
        })
        .then((l: any) => {
          capacitorListener = l;
        })
        .catch(() => {/* ignore */});
    }

    // ── Browser popstate fallback (for web / PWA testing) ─────────────────────
    const handlePopstate = () => {
      goBack();
    };
    window.addEventListener('popstate', handlePopstate);

    return () => {
      if (capacitorListener && typeof capacitorListener.remove === 'function') {
        capacitorListener.remove();
      }
      window.removeEventListener('popstate', handlePopstate);
    };
  }, [pathname, router]);

  return null;
}
