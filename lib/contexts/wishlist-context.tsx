'use client';

import React, { createContext, useContext, useCallback } from 'react';
import useSWR from 'swr';
import { CatalogueProduct } from '../hooks/use-products';

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
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const fetcher = async (url: string): Promise<WishlistResponse> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch wishlist');
  }
  return res.json();
};

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, mutate } = useSWR<WishlistResponse>('/api/wishlist', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });

  const wishlistData: WishlistData = data?.wishlist || {
    categories: [],
    subcategories: [],
    products: [],
    fullProducts: [],
  };

  const isCategoryWishlisted = useCallback(
    (name: string) => {
      if (!name) return false;
      return (wishlistData.categories || []).some(
        c => c.name.toUpperCase() === name.trim().toUpperCase()
      );
    },
    [wishlistData.categories]
  );

  const isSubcategoryWishlisted = useCallback(
    (category: string, name: string) => {
      if (!category || !name) return false;
      return (wishlistData.subcategories || []).some(
        s => s.category.toUpperCase() === category.trim().toUpperCase() && s.name.toUpperCase() === name.trim().toUpperCase()
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

  const toggleCategoryWishlist = async (name: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      // Optimistic mutate
      mutate(async (currentData) => {
        const res = await fetch('/api/wishlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ type: 'category', item: { name } }),
        });
        const updated = await res.json();
        return updated;
      }, { revalidate: true });
    } catch (err) {
      console.error('Failed to toggle category wishlist', err);
    }
  };

  const toggleSubcategoryWishlist = async (category: string, name: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      mutate(async (currentData) => {
        const res = await fetch('/api/wishlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ type: 'subcategory', item: { category, name } }),
        });
        const updated = await res.json();
        return updated;
      }, { revalidate: true });
    } catch (err) {
      console.error('Failed to toggle subcategory wishlist', err);
    }
  };

  const toggleProductWishlist = async (productId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      mutate(async (currentData) => {
        const res = await fetch('/api/wishlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ type: 'product', item: { productId } }),
        });
        const updated = await res.json();
        return updated;
      }, { revalidate: true });
    } catch (err) {
      console.error('Failed to toggle product wishlist', err);
    }
  };

  const reorderWishlist = async (type: 'category' | 'subcategory' | 'product', items: any[]) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      mutate(async () => {
        const res = await fetch('/api/wishlist/reorder', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ type, items }),
        });
        const updated = await res.json();
        return updated;
      }, { revalidate: true });
    } catch (err) {
      console.error('Failed to reorder wishlist', err);
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
