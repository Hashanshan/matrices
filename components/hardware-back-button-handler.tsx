'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { executeCustomBackHandler } from '@/lib/utils/back-navigation';

// Global history stack persisted across re-renders
const navHistory: string[] = [];
let lastBackPressTime = 0;

export default function HardwareBackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();

  // Track every pathname change into custom history stack
  useEffect(() => {
    if (!pathname) return;

    // Avoid duplicate consecutive entries
    if (navHistory.length === 0 || navHistory[navHistory.length - 1] !== pathname) {
      navHistory.push(pathname);
      if (navHistory.length > 50) navHistory.shift();
    }

    // Trap popstate on root catalogue page so touch back gesture stays inside app
    if (typeof window !== 'undefined' && (pathname === '/catalogue' || pathname === '/')) {
      window.history.pushState({ appPage: pathname }, '', window.location.href);
    }
  }, [pathname]);

  useEffect(() => {
    const goBack = () => {
      // 1. Run custom component back handlers (e.g. subcategory view -> category view, viewer modal, sidebar)
      if (executeCustomBackHandler()) {
        if (typeof window !== 'undefined' && pathname === '/catalogue') {
          window.history.pushState({ appPage: '/catalogue' }, '', window.location.href);
        }
        return;
      }

      // 2. If SweetAlert or modal is open, trigger escape key to close it first
      const swalContainer = document.querySelector('.swal2-container');
      if (swalContainer) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        if (typeof window !== 'undefined' && pathname === '/catalogue') {
          window.history.pushState({ appPage: '/catalogue' }, '', window.location.href);
        }
        return;
      }

      // 3. Pop current page off internal navigation stack
      if (navHistory.length > 0 && navHistory[navHistory.length - 1] === pathname) {
        navHistory.pop();
      }

      if (navHistory.length > 0) {
        const target = navHistory[navHistory.length - 1];
        if (target !== pathname) {
          router.replace(target);
          return;
        }
      }

      // If not on catalogue, final destination is always catalogue
      if (pathname !== '/catalogue' && pathname !== '/') {
        router.replace('/catalogue');
      } else {
        // We are on /catalogue root page: prevent leaving site/app by pushing state
        if (typeof window !== 'undefined') {
          window.history.pushState({ appPage: '/catalogue' }, '', window.location.href);
        }

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
      }
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

