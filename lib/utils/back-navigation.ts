import { useEffect } from 'react';

type BackHandler = () => boolean;

const handlerStack: BackHandler[] = [];

/**
 * Register a custom back handler (e.g. for in-page subcategory view, sidebar, or modal state).
 * The handler should return `true` if it consumed the back event, `false` otherwise.
 */
export function registerBackHandler(handler: BackHandler): () => void {
  handlerStack.push(handler);
  return () => {
    const idx = handlerStack.lastIndexOf(handler);
    if (idx !== -1) {
      handlerStack.splice(idx, 1);
    }
  };
}

/**
 * Execute top registered handler if present.
 * Returns true if a custom handler handled the back event.
 */
export function executeCustomBackHandler(): boolean {
  for (let i = handlerStack.length - 1; i >= 0; i--) {
    const handler = handlerStack[i];
    try {
      const handled = handler();
      if (handled) return true;
    } catch (err) {
      console.error('Error in custom back handler:', err);
    }
  }
  return false;
}

/**
 * Global trigger for back navigation.
 * 1. Executes custom component back handlers (e.g. subcategory view -> category view).
 * 2. Closes SweetAlert modals if open.
 * 3. Navigates back in browser/app history.
 */
export function triggerBack(): void {
  // 1. Try custom back handlers
  if (executeCustomBackHandler()) {
    return;
  }

  // 2. Check for open SweetAlert containers
  if (typeof document !== 'undefined') {
    const swalContainer = document.querySelector('.swal2-container');
    if (swalContainer) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      return;
    }
  }

  // 3. Dispatch global app back event for HardwareBackButtonHandler
  if (typeof window !== 'undefined') {
    const backEvent = new CustomEvent('app-trigger-back');
    window.dispatchEvent(backEvent);
  }
}

/**
 * React Hook to register a custom back handler for component lifecycle.
 */
export function useBackHandler(handler: () => boolean, active: boolean = true): void {
  useEffect(() => {
    if (!active) return;
    return registerBackHandler(handler);
  }, [handler, active]);
}
