'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { resolveApiUrl, getAuthToken, handleTokenExpiredRedirect } from '../utils';
import { useDataMode } from '../contexts/data-mode-context';
import { prewarmImageCache, getCachedImageUrl } from '../offline/image-cache';
import { CatalogueProduct, ProductsResponse, getOfflineProducts } from './use-products';

export interface ViewProduct extends CatalogueProduct {
  isPlaceholder?: boolean;
}

interface UseViewProductsOptions {
  sort?: string;
  category?: string | string[];
  subcategory?: string | string[];
  search?: string;
  productId?: string;
  timeFilter?: string;
  prioritizeCategory?: string;
  fallbackData?: any;
  limit?: number;
}

export function useViewProducts(options: UseViewProductsOptions = {}) {
  const { sort, category, subcategory, search, productId, timeFilter, prioritizeCategory, fallbackData, limit = 20 } = options;
  const { dataMode } = useDataMode();

  const [products, setProducts] = useState<ViewProduct[]>(() => {
    if (Array.isArray(fallbackData) && fallbackData.length > 0) return fallbackData;
    return [];
  });
  const [totalCount, setTotalCount] = useState<number>(() => {
    if (Array.isArray(fallbackData) && fallbackData.length > 0) return fallbackData.length;
    return 0;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => products.length === 0);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [exactMatchFound, setExactMatchFound] = useState<boolean | undefined>(undefined);
  const [error, setError] = useState<any>(null);

  // Track loaded pages, pending queue, and shared sparse products cache
  const loadedPagesRef = useRef<Set<number>>(new Set());
  const fetchingPagesRef = useRef<Set<number>>(new Set());
  const cancelControllerRef = useRef<AbortController | null>(null);
  const productStoreRef = useRef<ViewProduct[]>([]);

  const isOffline = dataMode === 'offline' || (typeof navigator !== 'undefined' && !navigator.onLine);

  const buildQuery = useCallback((pageIndex: number, pageLimit = 50) => {
    const params = new URLSearchParams();
    if (sort) params.set('sort', sort);
    if (category) {
      const catVal = Array.isArray(category) ? category.join(',') : category;
      if (catVal) params.set('category', catVal);
    }
    if (subcategory) {
      const subVal = Array.isArray(subcategory) ? subcategory.join(',') : subcategory;
      if (subVal) params.set('subcategory', subVal);
    }
    if (search) params.set('search', search);
    if (productId && !search) params.set('search', productId);
    if (prioritizeCategory) params.set('prioritizeCategory', prioritizeCategory);
    if (timeFilter && timeFilter !== 'all') params.set('timeFilter', timeFilter);
    params.set('limit', String(pageLimit));
    params.set('page', String(pageIndex));
    params.set('_mode', dataMode);
    return params.toString();
  }, [sort, category, subcategory, search, productId, prioritizeCategory, timeFilter, dataMode]);

  const fetchPage = useCallback(async (pageIndex: number, pageLimit = 50, signal?: AbortSignal): Promise<ProductsResponse | null> => {
    if (fetchingPagesRef.current.has(pageIndex) || loadedPagesRef.current.has(pageIndex)) {
      return null;
    }
    fetchingPagesRef.current.add(pageIndex);

    try {
      const token = getAuthToken();
      const query = buildQuery(pageIndex, pageLimit);
      const url = resolveApiUrl(`/api/products?${query}`);

      const res = await fetch(url, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal,
      });

      const data = await res.json().catch(() => ({}));
      if (handleTokenExpiredRedirect(data, res.status)) {
        return null;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      loadedPagesRef.current.add(pageIndex);

      // Prewarm image cache for the fetched products in the background
      if (data?.data && Array.isArray(data.data)) {
        data.data.forEach((p: any) => {
          if (p.image) getCachedImageUrl(p.image).catch(() => {});
        });
      }

      return data;
    } catch (err: any) {
      if (err.name === 'AbortError') return null;
      console.error(`Error fetching page ${pageIndex}:`, err);
      return null;
    } finally {
      fetchingPagesRef.current.delete(pageIndex);
    }
  }, [buildQuery]);

  // Main fetch and background streaming effect
  useEffect(() => {
    let isCancelled = false;
    const abortController = new AbortController();
    cancelControllerRef.current = abortController;

    loadedPagesRef.current.clear();
    fetchingPagesRef.current.clear();
    productStoreRef.current = [];

    const effectiveLimit = Math.max(limit, 50);

    const loadData = async () => {
      // ── OFFLINE MODE: untouched full load from IndexedDB ────────────────
      if (isOffline) {
        setIsLoading(true);
        try {
          const offlineData = await getOfflineProducts({
            sort,
            category,
            subcategory,
            search: search || productId,
            productId,
            prioritizeCategory,
            timeFilter,
            limit: 5000,
          });

          if (!isCancelled) {
            productStoreRef.current = offlineData.data || [];
            setProducts(offlineData.data || []);
            setTotalCount(offlineData.totalCount || offlineData.data.length);
            setExactMatchFound(offlineData.exactMatchFound);
            setIsLoading(false);
            prewarmImageCache().catch(() => {});
          }
        } catch (err) {
          if (!isCancelled) {
            setError(err);
            setIsLoading(false);
          }
        }
        return;
      }

      // ── ONLINE MODE: Bidirectional Upfront Buffers + Smooth Streaming ───
      setIsLoading(true);
      setIsValidating(true);

      try {
        // 1. Fetch Page 1 (First 50 items)
        const page1Data = await fetchPage(1, effectiveLimit, abortController.signal);
        if (isCancelled || !page1Data || !page1Data.data) {
          setIsLoading(false);
          setIsValidating(false);
          return;
        }

        const firstBatch = page1Data.data;
        const total = page1Data.totalCount || firstBatch.length;
        const totalPages = Math.ceil(total / effectiveLimit);

        setExactMatchFound(page1Data.exactMatchFound);
        setTotalCount(total);

        // Prewarm first few images
        firstBatch.slice(0, 8).forEach((p) => {
          if (p.image) {
            const img = new window.Image();
            img.src = p.image;
          }
        });

        // Case A: Single page catalog
        if (totalPages <= 1 || total <= effectiveLimit) {
          if (!isCancelled) {
            productStoreRef.current = firstBatch;
            setProducts(firstBatch);
            setIsLoading(false);
            setIsValidating(false);
          }
          return;
        }

        // Case B: Multi-page catalog — Initialize sparse array
        const sparse: ViewProduct[] = new Array(total);

        // Fill Page 1
        for (let i = 0; i < firstBatch.length; i++) {
          sparse[i] = firstBatch[i];
        }

        // Fill placeholders for remaining slots
        for (let i = firstBatch.length; i < total; i++) {
          sparse[i] = {
            id: `__ph_${i}`,
            productId: `...`,
            name: 'LOADING...',
            categories: '',
            subcategories: '',
            image: '',
            sellPrice: 0,
            price: 0,
            description: '',
            isPlaceholder: true,
          };
        }

        productStoreRef.current = sparse;

        if (!isCancelled) {
          setProducts([...sparse]);
          setIsLoading(false); // First batch ready for instant browsing!
        }

        // 2. Fetch Last Page (Reverse swipe buffer) in parallel
        const lastPageNumber = totalPages;
        const lastPageData = await fetchPage(lastPageNumber, effectiveLimit, abortController.signal);

        if (!isCancelled && lastPageData && Array.isArray(lastPageData.data)) {
          const lastBatch = lastPageData.data;
          const lastPageStartIndex = (lastPageNumber - 1) * effectiveLimit;

          for (let i = 0; i < lastBatch.length; i++) {
            const targetIdx = lastPageStartIndex + i;
            if (targetIdx < total) {
              productStoreRef.current[targetIdx] = lastBatch[i];
            }
          }

          // Prewarm last products for instant reverse swiping
          lastBatch.slice(-6).forEach((p) => {
            if (p.image) {
              const img = new window.Image();
              img.src = p.image;
            }
          });

          setProducts([...productStoreRef.current]);
        }

        if (!isCancelled) {
          setIsValidating(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err);
          setIsLoading(false);
          setIsValidating(false);
        }
      }
    };

    loadData();

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [sort, category, subcategory, search, productId, prioritizeCategory, limit, isOffline, fetchPage]);

  // High-priority on-demand page loader for user jumping or swiping near any index (forward or reverse)
  const prioritizeIndex = useCallback(async (index: number) => {
    if (isOffline || index < 0 || index >= totalCount) return;
    const effectiveLimit = Math.max(limit, 50);
    const pageNum = Math.floor(index / effectiveLimit) + 1;
    if (loadedPagesRef.current.has(pageNum) || fetchingPagesRef.current.has(pageNum)) return;

    try {
      const pageData = await fetchPage(pageNum, effectiveLimit);
      if (pageData && Array.isArray(pageData.data)) {
        const startIndex = (pageNum - 1) * effectiveLimit;
        pageData.data.forEach((p, i) => {
          const targetIdx = startIndex + i;
          if (targetIdx < productStoreRef.current.length) {
            productStoreRef.current[targetIdx] = p;
          }
        });

        // Prewarm image assets of the newly loaded page immediately
        pageData.data.forEach((p) => {
          if (p.image) {
            const img = new window.Image();
            img.src = p.image;
          }
        });

        setProducts([...productStoreRef.current]);
      }
    } catch {
      /* ignore */
    }
  }, [isOffline, totalCount, limit, fetchPage]);

  return {
    products,
    totalCount,
    isLoading,
    isValidating,
    exactMatchFound,
    error,
    prioritizeIndex,
    isOffline,
  };
}
