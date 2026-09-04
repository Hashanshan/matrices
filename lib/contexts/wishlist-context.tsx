'use client';

import React, { createContext, useContext, useCallback } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { CatalogueProduct } from '../hooks/use-products';
import { resolveApiUrl, getAuthToken } from '../utils';
import { offlineDB } from '../offline/indexed-db';
import { addToSyncQueue } from '../offline/pending-sync';
import { prewarmImageCache } from '../offline/image-cache';

export interface WishlistCategory {
  name: string;
  order: number;
  addedAt?: string;
}

export interface WishlistSubcategory {
  category: string;
  name: string;
  order: number;
  addedAt?: string;
}

export interface WishlistProductItem {
  productId: string;
  order: number;
  addedAt?: string;
}

export interface FullWishlistProduct {
  wishlistId: string;
  order: number;
  addedAt?: string;
  product: CatalogueProduct | null;
}

export interface WishlistData {
  categories: WishlistCategory[];
  subcategories: WishlistSubcategory[];
  products: WishlistProductItem[];
  fullProducts?: FullWishlistProduct[];
}

interface WishlistResponse {
  success: boolean;
  wishlist: WishlistData;
}

interface WishlistContextType {
  wishlist: WishlistData;
  isLoading: boolean;
  isCategoryWishlisted: (name: string) => boolean;
  isSubcategoryWishlisted: (category: string, name: string) => boolean;
  isProductWishlisted: (productId: string) => boolean;
  toggleCategoryWishlist: (name: string) => Promise<void>;
  toggleSubcategoryWishlist: (category: string, name: string) => Promise<void>;
  toggleProductWishlist: (productId: string) => Promise<void>;
  reorderWishlist: (type: 'category' | 'subcategory' | 'product', items: any[]) => Promise<void>;
  totalWishlistCount: number;
  mutate: () => Promise<any>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

/** Read data mode from localStorage (mirrors data-mode-context) */
const getDataMode = () =>
  typeof window !== 'undefined'
    ? (localStorage.getItem('matrices_data_mode') as 'online' | 'offline') || 'online'
    : 'online';

const isShopUser = () => {
  if (typeof window === 'undefined') return false;
  try {
    const userStr = localStorage.getItem('user') || localStorage.getItem('matrices_user');
    if (userStr) {
      const u = JSON.parse(userStr);
      return u?.role === 'shop';
    }
  } catch {}
  return false;
};

/** Read wishlist snapshot from IndexedDB */
const readOfflineWishlist = async (): Promise<WishlistData> => {
  try {
    const items = await offlineDB.getAll<any>('wishlist');
    const first = items[0];
    if (first) {
      return {
        categories: first.categories || [],
        subcategories: first.subcategories || [],
        products: first.products || [],
        fullProducts: first.fullProducts || [],
      };
    }
  } catch { /* ignore */ }
  return { categories: [], subcategories: [], products: [], fullProducts: [] };
};

const fetcher = async (url: string): Promise<WishlistResponse> => {
  const token = getAuthToken();
  if (!token) {
    return { success: true, wishlist: { categories: [], subcategories: [], products: [], fullProducts: [] } };
  }

  const isShop = isShopUser();
  const mode = getDataMode();
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  // Offline mode OR device offline (for non-shops) → serve from IndexedDB
  if (!isShop && (mode === 'offline' || isOffline)) {
    return { success: true, wishlist: await readOfflineWishlist() };
  }

  const targetUrl = resolveApiUrl(url);
  try {
    const res = await fetch(targetUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch wishlist');
    return res.json();
  } catch {
    if (!isShop) {
      return { success: true, wishlist: await readOfflineWishlist() };
    }
    return { success: true, wishlist: { categories: [], subcategories: [], products: [], fullProducts: [] } };
  }
};

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const token = typeof window !== 'undefined' ? getAuthToken() : null;
  const { data, isLoading, mutate } = useSWR<WishlistResponse>('/api/wishlist', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
    keepPreviousData: true,
  });

  const wishlistData: WishlistData = data?.wishlist || {
    categories: [],
    subcategories: [],
    products: [],
    fullProducts: [],
  };

  React.useEffect(() => {
    prewarmImageCache().catch(() => {});
  }, [data]);

  const isCategoryWishlisted = useCallback(
    (name: string) => {
      if (!name) return false;
      const target = name.trim().replace(/\s+/g, ' ').toUpperCase();
      return (wishlistData.categories || []).some(
        c => (c.name || '').trim().replace(/\s+/g, ' ').toUpperCase() === target
      );
    },
    [wishlistData.categories]
  );

  const isSubcategoryWishlisted = useCallback(
    (category: string, name: string) => {
      if (!category || !name) return false;
      const targetCat = category.trim().replace(/\s+/g, ' ').toUpperCase();
      const targetSub = name.trim().replace(/\s+/g, ' ').toUpperCase();
      return (wishlistData.subcategories || []).some(
        s => (s.category || '').trim().replace(/\s+/g, ' ').toUpperCase() === targetCat &&
             (s.name || '').trim().replace(/\s+/g, ' ').toUpperCase() === targetSub
      );
    },
    [wishlistData.subcategories]
  );

  const isProductWishlisted = useCallback(
    (productId: string) => {
      if (!productId) return false;
      const strId = String(productId).trim();
      return (wishlistData.products || []).some(
        p => String(p.productId).trim() === strId
      );
    },
    [wishlistData.products]
  );

  const notifyWishlistChanged = (newWishlistData: WishlistData) => {
    mutate({ success: true, wishlist: newWishlistData }, { revalidate: false });
    globalMutate((key) => typeof key === 'string' && key.startsWith('/api/products'));
  };

  const toggleCategoryWishlist = async (name: string) => {
    const isShop = isShopUser();
    const mode = getDataMode();
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const cleanName = name.trim().replace(/\s+/g, ' ');
    const nameUpper = cleanName.toUpperCase();

    if (!isShop && (mode === 'offline' || isOffline)) {
      // Offline mode: Toggle category locally in IndexedDB & queue to SyncQueue (Salesrep only)
      const current = { ...wishlistData };
      const exists = (current.categories || []).some(c => (c.name || '').trim().replace(/\s+/g, ' ').toUpperCase() === nameUpper);
      if (exists) {
        current.categories = (current.categories || []).filter(c => (c.name || '').trim().replace(/\s+/g, ' ').toUpperCase() !== nameUpper);
      } else {
        current.categories = [...(current.categories || []), { name: cleanName, order: (current.categories?.length || 0) + 1 }];
      }
      await offlineDB.saveBatch('wishlist', [{ id: 'user_wishlist', ...current }]);
      await addToSyncQueue({
        operation: exists ? 'DELETE' : 'CREATE',
        entity: 'Wishlist',
        entityId: `cat_${nameUpper.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        endpoint: '/api/wishlist/toggle',
        method: 'POST',
        payload: { type: 'category', item: { name: cleanName } },
        title: `${exists ? 'Removed' : 'Added'} Category Wishlist (${cleanName})`,
      });
      notifyWishlistChanged(current);
      return;
    }

    const token = getAuthToken();
    const exists = (wishlistData.categories || []).some(c => (c.name || '').trim().replace(/\s+/g, ' ').toUpperCase() === nameUpper);
    const updatedCategories = exists
      ? (wishlistData.categories || []).filter(c => (c.name || '').trim().replace(/\s+/g, ' ').toUpperCase() !== nameUpper)
      : [...(wishlistData.categories || []), { name: cleanName, order: (wishlistData.categories?.length || 0) + 1 }];

    const optimistic: WishlistData = { ...wishlistData, categories: updatedCategories };
    notifyWishlistChanged(optimistic);

    try {
      const targetUrl = resolveApiUrl('/api/wishlist/toggle');
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: 'category', item: { name: cleanName } }),
      });
      const updated = await res.json();
      if (updated?.success && updated?.wishlist) {
        if (!isShop) {
          await offlineDB.saveBatch('wishlist', [{ id: 'user_wishlist', ...updated.wishlist }]);
        }
        notifyWishlistChanged(updated.wishlist);
      }
    } catch (err) {
      console.error('Failed to toggle category wishlist', err);
    }
  };

  const toggleSubcategoryWishlist = async (category: string, name: string) => {
    const isShop = isShopUser();
    const mode = getDataMode();
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const cleanCat = category.trim().replace(/\s+/g, ' ');
    const cleanSub = name.trim().replace(/\s+/g, ' ');
    const catUpper = cleanCat.toUpperCase();
    const subUpper = cleanSub.toUpperCase();

    if (!isShop && (mode === 'offline' || isOffline)) {
      // Offline mode: Toggle subcategory locally in IndexedDB & queue (Salesrep only)
      const current = { ...wishlistData };
      const exists = (current.subcategories || []).some(
        s => (s.category || '').trim().replace(/\s+/g, ' ').toUpperCase() === catUpper &&
             (s.name || '').trim().replace(/\s+/g, ' ').toUpperCase() === subUpper
      );
      if (exists) {
        current.subcategories = (current.subcategories || []).filter(
          s => !((s.category || '').trim().replace(/\s+/g, ' ').toUpperCase() === catUpper &&
                 (s.name || '').trim().replace(/\s+/g, ' ').toUpperCase() === subUpper)
        );
      } else {
        current.subcategories = [...(current.subcategories || []), { category: cleanCat, name: cleanSub, order: (current.subcategories?.length || 0) + 1 }];
      }
      await offlineDB.saveBatch('wishlist', [{ id: 'user_wishlist', ...current }]);
      await addToSyncQueue({
        operation: exists ? 'DELETE' : 'CREATE',
        entity: 'Wishlist',
        entityId: `subcat_${cleanCat}_${cleanSub}`.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        endpoint: '/api/wishlist/toggle',
        method: 'POST',
        payload: { type: 'subcategory', item: { category: cleanCat, name: cleanSub } },
        title: `${exists ? 'Removed' : 'Added'} Subcategory Wishlist (${cleanSub})`,
      });
      notifyWishlistChanged(current);
      return;
    }

    const token = getAuthToken();
    const exists = (wishlistData.subcategories || []).some(
      s => (s.category || '').trim().replace(/\s+/g, ' ').toUpperCase() === catUpper &&
           (s.name || '').trim().replace(/\s+/g, ' ').toUpperCase() === subUpper
    );
    const updatedSubcategories = exists
      ? (wishlistData.subcategories || []).filter(s => !((s.category || '').trim().replace(/\s+/g, ' ').toUpperCase() === catUpper && (s.name || '').trim().replace(/\s+/g, ' ').toUpperCase() === subUpper))
      : [...(wishlistData.subcategories || []), { category: cleanCat, name: cleanSub, order: (wishlistData.subcategories?.length || 0) + 1 }];

    const optimistic: WishlistData = { ...wishlistData, subcategories: updatedSubcategories };
    notifyWishlistChanged(optimistic);

    try {
      const targetUrl = resolveApiUrl('/api/wishlist/toggle');
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: 'subcategory', item: { category, name } }),
      });
      const updated = await res.json();
      if (updated?.success && updated?.wishlist) {
        if (!isShop) {
          await offlineDB.saveBatch('wishlist', [{ id: 'user_wishlist', ...updated.wishlist }]);
        }
        notifyWishlistChanged(updated.wishlist);
      }
    } catch (err) {
      console.error('Failed to toggle subcategory wishlist', err);
    }
  };

  const toggleProductWishlist = async (productId: string) => {
    const isShop = isShopUser();
    const mode = getDataMode();
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (!isShop && (mode === 'offline' || isOffline)) {
      // Offline mode: Toggle product locally in IndexedDB & queue (Salesrep only)
      const current = { ...wishlistData };
      const strId = String(productId).trim();
      const exists = (current.products || []).some(p => String(p.productId).trim() === strId);
      if (exists) {
        current.products = (current.products || []).filter(p => String(p.productId).trim() !== strId);
        current.fullProducts = (current.fullProducts || []).filter(p => p.product && String(p.product.productId || p.product.id).trim() !== strId);
      } else {
        // Find product details in local products store to populate fullProducts
        const allProducts = await offlineDB.getAll<any>('products').catch(() => []);
        const foundProd = allProducts.find(p => String(p.productId || p.id).trim() === strId);
        
        current.products = [...(current.products || []), { productId, order: (current.products?.length || 0) + 1 }];
        if (foundProd) {
          current.fullProducts = [
            ...(current.fullProducts || []),
            {
              wishlistId: `wish_local_${Date.now()}`,
              order: (current.fullProducts?.length || 0) + 1,
              addedAt: new Date().toISOString(),
              product: {
                id: foundProd.id || foundProd.productId,
                name: foundProd.name || '',
                productId: foundProd.productId || foundProd.id,
                categories: foundProd.categoryName || foundProd.categories || '',
                subcategories: foundProd.subcategoryName || foundProd.subcategories || '',
                image: foundProd.imageUrl || foundProd.image || '',
                sellPrice: foundProd.price || 0,
                price: foundProd.price || 0,
                description: foundProd.description || '',
              }
            }
          ];
        }
      }
      await offlineDB.saveBatch('wishlist', [{ id: 'user_wishlist', ...current }]);
      await addToSyncQueue({
        operation: exists ? 'DELETE' : 'CREATE',
        entity: 'Wishlist',
        entityId: strId,
        endpoint: '/api/wishlist/toggle',
        method: 'POST',
        payload: { type: 'product', item: { productId } },
        title: `${exists ? 'Removed' : 'Added'} Product Wishlist (${strId})`,
      });
      notifyWishlistChanged(current);
      return;
    }

    const token = getAuthToken();
    const strId = String(productId).trim();
    const exists = (wishlistData.products || []).some(p => String(p.productId).trim() === strId);
    const updatedProducts = exists
      ? (wishlistData.products || []).filter(p => String(p.productId).trim() !== strId)
      : [...(wishlistData.products || []), { productId: strId, order: (wishlistData.products?.length || 0) + 1 }];

    const updatedFullProducts = exists
      ? (wishlistData.fullProducts || []).filter(p => p.product && String(p.product.productId || p.product.id).trim() !== strId)
      : wishlistData.fullProducts;

    const optimistic: WishlistData = {
      ...wishlistData,
      products: updatedProducts,
      fullProducts: updatedFullProducts,
    };

    notifyWishlistChanged(optimistic);

    try {
      const targetUrl = resolveApiUrl('/api/wishlist/toggle');
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: 'product', item: { productId } }),
      });
      const updated = await res.json();
      if (updated?.success && updated?.wishlist) {
        if (!isShop) {
          await offlineDB.saveBatch('wishlist', [{ id: 'user_wishlist', ...updated.wishlist }]);
        }
        notifyWishlistChanged(updated.wishlist);
      }
    } catch (err) {
      console.error('Failed to toggle product wishlist', err);
    }
  };

  const reorderWishlist = async (type: 'category' | 'subcategory' | 'product', items: any[]) => {
    const isShop = isShopUser();
    const mode = getDataMode();
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    // ── Build the reordered state locally (shared by both paths) ─────────────
    const reordered = { ...wishlistData };
    if (type === 'category') {
      reordered.categories = items.map((name, idx) => ({ name, order: idx + 1 }));
    } else if (type === 'subcategory') {
      reordered.subcategories = items.map((item, idx) => ({ category: item.category, name: item.name, order: idx + 1 }));
    } else if (type === 'product') {
      const reorderedFull: any[] = [];
      items.forEach((id, idx) => {
        const found = (reordered.fullProducts || []).find(
          p => (p.wishlistId || p.product?.productId || p.product?.id) === id
        );
        if (found) reorderedFull.push({ ...found, order: idx + 1 });
      });
      reordered.fullProducts = reorderedFull;
      reordered.products = reorderedFull.map((p, idx) => ({
        productId: p.product?.productId || p.product?.id || '',
        order: idx + 1,
      }));
    }

    // ── Always write to IDB (for salesreps) & update SWR optimistically (zero-latency UI) ────
    if (!isShop) {
      await offlineDB.saveBatch('wishlist', [{ id: 'user_wishlist', ...reordered }]);
    }
    notifyWishlistChanged(reordered);

    // ── Offline / no-network for salesreps: queue for sync and return ─────────
    if (!isShop && (mode === 'offline' || isOffline)) {
      await addToSyncQueue({
        operation: 'UPDATE',
        entity: 'Wishlist',
        entityId: `reorder_${type}`,
        endpoint: '/api/wishlist/reorder',
        method: 'PUT',
        payload: { type, items },
        title: `Reorder ${type} Wishlist`,
      });
      return;
    }

    // ── Online mode / shop: push to live API, mirror confirmed state back ────
    const token = getAuthToken();
    try {
      const targetUrl = resolveApiUrl('/api/wishlist/reorder');
      const res = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type, items }),
      });
      const updated = await res.json();
      if (updated?.success && updated?.wishlist) {
        if (!isShop) {
          await offlineDB.saveBatch('wishlist', [{ id: 'user_wishlist', ...updated.wishlist }]);
        }
        mutate(updated, { revalidate: false });
      }
    } catch (err) {
      if (!isShop) {
        console.warn('Wishlist reorder API failed, queuing for sync:', err);
        await addToSyncQueue({
          operation: 'UPDATE',
          entity: 'Wishlist',
          entityId: `reorder_${type}`,
          endpoint: '/api/wishlist/reorder',
          method: 'PUT',
          payload: { type, items },
          title: `Reorder ${type} Wishlist`,
        });
      } else {
        console.error('Failed to reorder shop wishlist:', err);
      }
    }
  };

  const totalWishlistCount =
    (wishlistData.categories?.length || 0) +
    (wishlistData.subcategories?.length || 0) +
    (wishlistData.products?.length || 0);

  return (
    <WishlistContext.Provider
      value={{
        wishlist: wishlistData,
        isLoading,
        isCategoryWishlisted,
        isSubcategoryWishlisted,
        isProductWishlisted,
        toggleCategoryWishlist,
        toggleSubcategoryWishlist,
        toggleProductWishlist,
        reorderWishlist,
        totalWishlistCount,
        mutate,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
