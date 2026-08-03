'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { executeCustomBackHandler } from '@/lib/utils/back-navigation';

// Global history stack persisted across re-renders
const navHistory: string[] = [];
let lastBackPressTime = 0;

export default function HardwareBackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const prevPathname = useRef<string | null>(null);

  // Track every pathname change into custom history stack
  useEffect(() => {
    if (!pathname) return;

    // Avoid duplicate consecutive entries
    if (navHistory.length === 0 || navHistory[navHistory.length - 1] !== pathname) {
      navHistory.push(pathname);
      if (navHistory.length > 50) navHistory.shift();
    }

    prevPathname.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const goBack = () => {
      // 1. First run custom component back handlers (e.g. subcategory view -> category view)
      if (executeCustomBackHandler()) {
        return;
      }

      // 2. If SweetAlert or modal is open, trigger escape key to close it first
      const swalContainer = document.querySelector('.swal2-container');
      if (swalContainer) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return;
      }

      // 3. Pop current page off stack
      if (navHistory.length > 0 && navHistory[navHistory.length - 1] === pathname) {
        navHistory.pop();
      }

      if (navHistory.length > 0) {
        const target = navHistory[navHistory.length - 1];
        router.replace(target);
      } else if (pathname !== '/' && pathname !== '/catalogue') {
        router.replace('/catalogue');
      } else {
        // We are on home / catalogue root
        const now = Date.now();
        if (now - lastBackPressTime < 2000) {
          // Double back press -> exit app natively if in Capacitor
          const capApp = (window as any)?.Capacitor?.Plugins?.App;
          if (capApp && typeof capApp.exitApp === 'function') {
            capApp.exitApp();
          }
        } else {
          lastBackPressTime = now;
        }
      }
    };

    // ── 1. Android Native Document backbutton Event (Capacitor Android WebView) ──
    const handleDocumentBack = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      goBack();
    };
    document.addEventListener('backbutton', handleDocumentBack, false);

    // ── 2. Capacitor Plugin Listener Fallback ────────────────────────────────
    const capApp = (window as any)?.Capacitor?.Plugins?.App;
    let capacitorListener: any = null;

    if (capApp && typeof capApp.addListener === 'function') {
      capApp
        .addListener('backButton', (data: any) => {
          goBack();
        })
        .then((l: any) => {
          capacitorListener = l;
        })
        .catch(() => { });
    }

    // ── 3. Browser PopState Listener ──────────────────────────────────────────
    const handlePopstate = (e: PopStateEvent) => {
      e.preventDefault();
      goBack();
    };
    window.addEventListener('popstate', handlePopstate);

    return () => {
      document.removeEventListener('backbutton', handleDocumentBack, false);
      if (capacitorListener && typeof capacitorListener.remove === 'function') {
        capacitorListener.remove();
      }
      window.removeEventListener('popstate', handlePopstate);
    };
  }, [pathname, router]);

  return null;
}

