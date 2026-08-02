import useSWRInfinite from 'swr/infinite';
import useSWR from 'swr';
import { resolveApiUrl, getAuthToken } from '../utils';
import { offlineDB } from '../offline/indexed-db';
import { useDataMode } from '../contexts/data-mode-context';
import { prewarmImageCache } from '../offline/image-cache';
import {
  getOfflineCatalogueProducts,
  getOfflineCatalogueFilters,
  getOfflineGalleryProducts,
  getOfflineViewProducts,
} from '../offline/page-offline-functions';

export {
  getOfflineCatalogueProducts,
  getOfflineCatalogueFilters,
  getOfflineGalleryProducts,
  getOfflineViewProducts,
};


// ─── Types ──────────────────────────────────────────────────────────────────

export interface CatalogueProduct {
  id: string;
  name: string;
  productId: string;
  categories: string;
  subcategories: string;
  image: string;
  sellPrice: number;
  price: number;
  description: string;
}

interface ProductsResponse {
  success: boolean;
  count: number;
  totalCount?: number;
  exactMatchFound?: boolean;
  nextCursor: string | null;
  hasNextPage: boolean;
  data: CatalogueProduct[];
}

// ─── Offline helpers ────────────────────────────────────────────────────────

/** Shape IndexedDB products into the ProductsResponse format the hooks expect */
async function getOfflineProducts(options: {
  sort?: string;
  category?: string | string[];
  prioritizeCategory?: string;
  subcategory?: string | string[];
  search?: string;
  productId?: string;
  page?: number;
  limit?: number;
}): Promise<ProductsResponse> {
  return getOfflineCatalogueProducts(options);
}

/** Shape IndexedDB categories into FiltersResponse format (matching backend aggregation) */
async function getOfflineFilters(): Promise<FiltersResponse> {
  return getOfflineCatalogueFilters();
}

// ─── Fetcher (LocalDB Priority → Live API Fallback) ──────────────────────────

/** Read the current data mode from localStorage */
const getDataMode = (): 'online' | 'offline' => {
  if (typeof window === 'undefined') return 'online';
  return (localStorage.getItem('matrices_data_mode') as 'online' | 'offline') || 'online';
};

const fetcher = async <T = any>(url: string): Promise<T> => {
  const token = getAuthToken();

  // Parse URL params for offline helpers
  const parseOptions = () => {
    try {
      const u = new URL(url, 'http://x');
      return {
        sort: u.searchParams.get('sort') || undefined,
        category: u.searchParams.get('category') || u.searchParams.get('prioritizeCategory') || undefined,
        prioritizeCategory: u.searchParams.get('prioritizeCategory') || undefined,
        subcategory: u.searchParams.get('subcategory') || undefined,
        search: u.searchParams.get('search') || undefined,
        productId: u.searchParams.get('productId') || u.searchParams.get('search') || undefined,
        page: parseInt(u.searchParams.get('page') || '1', 10),
        limit: parseInt(u.searchParams.get('limit') || '20', 10),
      };
    } catch {
      return {};
    }
  };

  const isProductsFilters = url.includes('/api/products/filters');
  const isProducts = url.includes('/api/products');
  const mode = getDataMode();
  const isOfflineNetwork = typeof navigator !== 'undefined' && !navigator.onLine;

  // ── LOCAL DB PRIORITY FIRST: Check local IndexedDB data ───────────────────
  if (isProducts || isProductsFilters) {
    try {
      if (isProducts) {
        const localData = await getOfflineProducts(parseOptions());
        if (localData.data.length > 0) {
          return localData as unknown as T;
        }
      } else if (isProductsFilters) {
        const localFilters = await getOfflineFilters();
        if (localFilters.categories.length > 0) {
          return localFilters as unknown as T;
        }
      }
    } catch {
      /* Fallback to live API if local read fails */
    }

    if (mode === 'offline' || isOfflineNetwork) {
      if (isProductsFilters) return getOfflineFilters() as unknown as T;
      if (isProducts) return getOfflineProducts(parseOptions()) as unknown as T;
    }
  }

  // ── No network → final IDB fallback ──────────────────────────────────────────
  if (isOfflineNetwork) {
    if (isProductsFilters) return getOfflineFilters() as unknown as T;
    if (isProducts) return getOfflineProducts(parseOptions()) as unknown as T;
    return { success: false } as unknown as T;
  }

  // ── ONLINE MODE: network fetch ────────────────────────────────────────────────
  const targetUrl = resolveApiUrl(url);
  try {
    const res = await fetch(targetUrl, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth-error'));
      }
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    // Pre-warm image cache in the background after a successful products fetch
    if (isProducts && data?.data?.length > 0) {
      prewarmImageCache().catch(() => {});
    }

    // Reorder: if a search/productId was provided, bring the best match to front
    const opts = parseOptions();
    if (isProducts && opts.productId && data?.data && Array.isArray(data.data)) {
      const targetStr = opts.productId.toLowerCase().trim();
      const targetClean = opts.productId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

      const targetIdx = data.data.findIndex((p: any) => {
        const pProdId = String(p.productId || '').trim().toLowerCase();
        const pId = String(p.id || '').trim().toLowerCase();
        const pCode = String(p.code || p.productCode || '').trim().toLowerCase();
        const pName = String(p.name || '').trim().toLowerCase();

        if (pProdId === targetStr || pId === targetStr || pCode === targetStr) return true;
        if (targetClean) {
          const cProdId = pProdId.replace(/[^a-zA-Z0-9]/g, '');
          const cCode = pCode.replace(/[^a-zA-Z0-9]/g, '');
          const cId = pId.replace(/[^a-zA-Z0-9]/g, '');
          const cName = pName.replace(/[^a-zA-Z0-9]/g, '');
          if (cProdId === targetClean || cCode === targetClean || cId === targetClean) return true;
          if (cName.includes(targetClean)) return true;
        }
        if (pName.includes(targetStr) || pCode.includes(targetStr) || pProdId.includes(targetStr)) return true;
        return false;
      });
      if (targetIdx >= 0) {
        const targetProd = data.data[targetIdx];
        const targetCat = (targetProd.categoryName || targetProd.categories || targetProd.category || '').toLowerCase().trim();
        const targetSub = (targetProd.subcategoryName || targetProd.subcategories || targetProd.subcategory || '').toLowerCase().trim();

        const subMatches: any[] = [];
        const catMatches: any[] = [];
        const others: any[] = [];

        for (let i = 0; i < data.data.length; i++) {
          if (i === targetIdx) continue;
          const p = data.data[i];
          const pCat = (p.categoryName || p.categories || p.category || '').toLowerCase().trim();
          const pSub = (p.subcategoryName || p.subcategories || p.subcategory || '').toLowerCase().trim();

          if (targetSub && pSub === targetSub) {
            subMatches.push(p);
          } else if (targetCat && pCat === targetCat) {
            catMatches.push(p);
          } else {
            others.push(p);
          }
        }

        data.data = [targetProd, ...subMatches, ...catMatches, ...others];
      }
    }

    return data;
  } catch (err) {
    // Network error fallback → return IndexedDB offline data
    if (isProductsFilters) return getOfflineFilters() as unknown as T;
    if (isProducts) return getOfflineProducts(parseOptions()) as unknown as T;
    throw err;
  }
};

// ─── Hook: useProducts (Cursor Paginated + SWR Cached) ──────────────────────

interface UseProductsOptions {
  sort?: string;
  category?: string | string[];
  subcategory?: string | string[];
  search?: string;
  productId?: string;
  limit?: number;
  initialLimit?: number;
  prioritizeCategory?: string;
  fallbackData?: ProductsResponse[];
}

/**
 * Cursor-paginated, SWR-cached hook for fetching products.
 * Falls back to IndexedDB when offline.
 */
export function useProducts(options: UseProductsOptions = {}) {
  const { sort, category, subcategory, search, productId, limit = 20, prioritizeCategory, fallbackData } = options;

  const buildQuery = (pageIndex: number) => {
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
    if (productId && !search) params.set('productId', productId);
    if (prioritizeCategory) params.set('prioritizeCategory', prioritizeCategory);
    const currentLimit = pageIndex > 0 ? limit : (options.initialLimit || limit);
    params.set('limit', String(currentLimit));
    params.set('page', String(pageIndex + 1));
    return params.toString();
  };

  const { dataMode } = useDataMode();

  const getKey = (pageIndex: number, previousPageData: ProductsResponse | null) => {
    if (pageIndex === 0) return `/api/products?${buildQuery(0)}&_mode=${dataMode}`;
    if (previousPageData && !previousPageData.hasNextPage) return null;
    return `/api/products?${buildQuery(pageIndex)}&_mode=${dataMode}`;
  };

  const {
    data: pages,
    error,
    size,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ProductsResponse>(getKey, fetcher, {
    revalidateFirstPage: true,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    // Short deduping so stale IDB data gets refreshed quickly from API
    dedupingInterval: 2000,
    keepPreviousData: true,
    fallbackData,
  });

  const products: CatalogueProduct[] = pages ? pages.flatMap((page) => page.data) : [];
  const isLoadingInitial = isLoading;
  const isLoadingMore = size > 0 && pages && typeof pages[size - 1] === 'undefined';
  const hasMore = pages ? pages[pages.length - 1]?.hasNextPage ?? false : false;
  const totalCount = pages && pages[0] ? pages[0].totalCount ?? products.length : products.length;
  const exactMatchFound = pages && pages[0] ? pages[0].exactMatchFound : undefined;

  const loadMore = () => {
    if (!isLoadingMore && hasMore) setSize(size + 1);
  };

  return {
    products,
    isLoading: isLoadingInitial,
    isLoadingMore: isLoadingMore ?? false,
    isValidating,
    hasMore,
    totalCount,
    exactMatchFound,
    loadMore,
    error,
    mutate,
  };
}

// ─── Hook: useAllProducts (Non-paginated, for /view page) ───────────────────

/**
 * Fetches ALL products in a single request (for the /view fullscreen viewer).
 * Uses stale-while-revalidate: returns IDB data immediately, then refreshes from API.
 */
export function useAllProducts(options: Omit<UseProductsOptions, 'limit'> & { fallbackData?: ProductsResponse } = {}) {
  const { sort = 'view', category, subcategory, search, fallbackData } = options;
  const { dataMode } = useDataMode();

  const params = new URLSearchParams();
  params.set('sort', sort);
  // Fetch a large page so the viewer has most products locally
  params.set('limit', '5000');
  params.set('_mode', dataMode);
  if (category) {
    const catVal = Array.isArray(category) ? category.join(',') : category;
    if (catVal) params.set('category', catVal);
  }
  if (subcategory) {
    const subVal = Array.isArray(subcategory) ? subcategory.join(',') : subcategory;
    if (subVal) params.set('subcategory', subVal);
  }
  if (search) params.set('search', search);

  const key = `/api/products?${params.toString()}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<ProductsResponse>(key, fetcher, {
    fallbackData,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    // Stale-while-revalidate: short deduping so UI updates quickly after IDB serves stale data
    dedupingInterval: 3000,
    keepPreviousData: true,
  });

  return {
    products: data?.data || [],
    exactMatchFound: data?.exactMatchFound,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

// ─── Hook: useFilters (Fetch Categories & Price Range) ────────────────────

export interface SubcategoryFilter {
  name: string;
  image: string;
  count: number;
}

export interface CategoryFilter {
  name: string;
  image: string;
  totalCount: number;
  subcategories: SubcategoryFilter[];
}

export interface FiltersResponse {
  success: boolean;
  categories: CategoryFilter[];
  priceRange: { min: number; max: number };
}

export function useFilters(options: { fallbackData?: FiltersResponse } = {}) {
  const { fallbackData } = options;
  const { dataMode } = useDataMode();
  const key = `/api/products/filters?_mode=${dataMode}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<FiltersResponse>(key, fetcher, {
    fallbackData: fallbackData && fallbackData.categories && fallbackData.categories.length > 0 ? fallbackData : undefined,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    // Short deduping so fresh synced filters update immediately
    dedupingInterval: 2000,
    keepPreviousData: true,
  });

  return {
    categories: data?.categories || [],
    priceRange: data?.priceRange || { min: 0, max: 40000 },
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
