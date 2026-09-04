'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { executeCustomBackHandler } from '@/lib/utils/back-navigation';

// Global history stack persisted across re-renders
let navHistory: string[] = [];
let lastBackPressTime = 0;

export default function HardwareBackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const mountTimeRef = useRef(Date.now());

  // Track every pathname change into custom history stack
  useEffect(() => {
    if (!pathname) return;

    // Never add '/' (login page) to back history for authenticated sessions
    if (pathname === '/') {
      navHistory = [];
      return;
    }

    // Root app page - reset history so back never routes back to the login page
    if (pathname === '/catalogue') {
      navHistory = ['/catalogue'];
      return;
    }

    // Avoid duplicate consecutive entries
    if (navHistory.length === 0 || navHistory[navHistory.length - 1] !== pathname) {
      navHistory.push(pathname);
      if (navHistory.length > 50) navHistory.shift();
    }
  }, [pathname]);

  useEffect(() => {
    const goBack = () => {
      // 1. Run custom component back handlers (e.g. subcategory view -> category view, viewer modal, sidebar)
      if (executeCustomBackHandler()) {
        return;
      }

      // 2. If SweetAlert or modal is open, trigger escape key to close it first
      const swalContainer = document.querySelector('.swal2-container');
      if (swalContainer) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return;
      }

      // If we are on catalogue root or login page, never navigate back to '/'
      if (pathname === '/catalogue' || pathname === '/') {
        // Native Capacitor exit on double back press if in Capacitor Android app
        const now = Date.now();
        if (now - lastBackPressTime < 2000) {
          const capApp = (window as any)?.Capacitor?.Plugins?.App;
          if (capApp && typeof capApp.exitApp === 'function') {
            capApp.exitApp();
          }
        } else {
          lastBackPressTime = now;
        }
        return;
      }

      // 3. Pop current page off internal navigation stack
      while (navHistory.length > 0 && navHistory[navHistory.length - 1] === pathname) {
        navHistory.pop();
      }

      // Find valid target that is not '/' and not current pathname
      const validTargets = navHistory.filter((p) => p !== '/' && p !== pathname);
      if (validTargets.length > 0) {
        const target = validTargets[validTargets.length - 1];
        router.replace(target);
        return;
      }

      // If not on catalogue, fallback destination is always /catalogue
      router.replace('/catalogue');
    };

    // 1. Custom event dispatched by UI back button
    const handleCustomTriggerBack = () => {
      goBack();
    };
    window.addEventListener('app-trigger-back', handleCustomTriggerBack);

    // 2. Android Native Document backbutton Event
    const handleDocumentBack = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      goBack();
    };
    document.addEventListener('backbutton', handleDocumentBack, false);

    // 3. Capacitor Plugin Listener Fallback
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
        .catch(() => { });
    }

    // 4. Browser PopState Listener (Mobile Swipe Back Gesture / Hardware Back)
    const handlePopstate = (e: PopStateEvent) => {
      e.preventDefault();
      // Ignore spurious popstate events during initial route mount (within 800ms)
      if (Date.now() - mountTimeRef.current < 800) {
        return;
      }
      goBack();
    };
    window.addEventListener('popstate', handlePopstate);

    return () => {
      window.removeEventListener('app-trigger-back', handleCustomTriggerBack);
      document.removeEventListener('backbutton', handleDocumentBack, false);
      if (capacitorListener && typeof capacitorListener.remove === 'function') {
        capacitorListener.remove();
      }
      window.removeEventListener('popstate', handlePopstate);
    };
  }, [pathname, router]);

  return null;
}
