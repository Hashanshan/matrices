import useSWRInfinite from 'swr/infinite';
import useSWR from 'swr';
import { resolveApiUrl, getAuthToken } from '../utils';
import { offlineDB } from '../offline/indexed-db';
import { useDataMode } from '../contexts/data-mode-context';

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
  category?: string | string[];
  prioritizeCategory?: string;
  subcategory?: string | string[];
  search?: string;
  productId?: string;
  page?: number;
  limit?: number;
}): Promise<ProductsResponse> {
  const raw = await offlineDB.getAll<any>('products').catch(() => []);
  const targetCategory = options.category || options.prioritizeCategory;
  const catFilter = targetCategory
    ? (Array.isArray(targetCategory) ? targetCategory : [targetCategory]).map(c => c.toLowerCase().trim())
    : null;
  const subFilter = options.subcategory
    ? (Array.isArray(options.subcategory) ? options.subcategory : [options.subcategory]).map(s => s.toLowerCase().trim())
    : null;
  const search = options.search?.toLowerCase().trim() ?? '';

  let filtered = raw.filter((p: any) => {
    if (catFilter && catFilter.length > 0 && catFilter[0]) {
      const pCat = (p.categoryName || p.categories || p.category || '').toLowerCase().trim();
      if (!catFilter.some(c => pCat === c || pCat.includes(c) || c.includes(pCat))) return false;
    }
    if (subFilter && subFilter.length > 0 && subFilter[0]) {
      const pSub = (p.subcategoryName || p.subcategories || p.subcategory || '').toLowerCase().trim();
      if (!subFilter.some(s => pSub === s || pSub.includes(s) || s.includes(pSub))) return false;
    }
    if (search) {
      return (
        (p.name || '').toLowerCase().includes(search) ||
        (p.productId || '').toLowerCase().includes(search) ||
        (p.code || '').toLowerCase().includes(search)
      );
    }
    return true;
  });

  // If a specific productId is requested, bring it to the very front
  if (options.productId) {
    const targetStr = options.productId.toLowerCase().trim();
    const targetIdx = filtered.findIndex((p: any) =>
      String(p.productId || '').toLowerCase().trim() === targetStr ||
      String(p.id || '').toLowerCase().trim() === targetStr ||
      String(p.code || '').toLowerCase().trim() === targetStr
    );
    if (targetIdx > 0) {
      const targetProd = filtered[targetIdx];
      filtered.splice(targetIdx, 1);
      filtered.unshift(targetProd);
    }
  }

  const mapped: CatalogueProduct[] = filtered.map((p: any) => ({
    id: String(p.id || p.productId || ''),
    name: p.name || '',
    productId: String(p.productId || p.id || ''),
    categories: p.categoryName || p.categories || '',
    subcategories: p.subcategoryName || p.subcategories || '',
    image: p.imageUrl || p.image || '',
    sellPrice: p.sellPrice || p.price || 0,
    price: p.price || 0,
    description: p.description || '',
  }));

  return {
    success: true,
    count: mapped.length,
    totalCount: mapped.length,
    hasNextPage: false,
    nextCursor: null,
    data: mapped,
  };
}

/** Shape IndexedDB categories into FiltersResponse format */
async function getOfflineFilters(): Promise<FiltersResponse> {
  const [dbCategories, dbSubcategories, dbProducts] = await Promise.all([
    offlineDB.getAll<any>('categories').catch(() => []),
    offlineDB.getAll<any>('subcategories').catch(() => []),
    offlineDB.getAll<any>('products').catch(() => []),
  ]);

  if (dbCategories.length > 0) {
    const categories: CategoryFilter[] = dbCategories.map((c: any) => {
      const cNameClean = (c.name || c.categoryName || '').trim().toLowerCase();
      const cIdClean = String(c.id || c._id || c.categoryId || '').trim();

      // Tier 1: Check subcategories from dbSubcategories table
      let subList: SubcategoryFilter[] = dbSubcategories
        .filter((s: any) => {
          const sCatName = (s.categoryName || s.category || s.category?.name || '').trim().toLowerCase();
          const sCatId = String(s.categoryId || s.category?._id || '').trim();
          return (sCatName && sCatName === cNameClean) || (sCatId && sCatId === cIdClean);
        })
        .map((s: any) => {
          const sName = (s.name || s.subcategoryName || '').trim();
          const sNameLower = sName.toLowerCase();
          return {
            name: sName,
            image: s.image || s.imageUrl || '',
            count: dbProducts.filter((p: any) => {
              const pSub = (p.subcategoryName || p.subcategories || p.subcategory || '').trim().toLowerCase();
              return pSub === sNameLower;
            }).length,
          };
        });

      // Tier 2: Check subcategories array stored directly on category object
      if (subList.length === 0 && Array.isArray(c.subcategories) && c.subcategories.length > 0) {
        subList = c.subcategories.map((s: any) => {
          const sName = typeof s === 'string' ? s.trim() : (s.name || s.subcategoryName || '').trim();
          const sImage = typeof s === 'string' ? '' : (s.image || s.imageUrl || '');
          const sNameLower = sName.toLowerCase();
          return {
            name: sName,
            image: sImage,
            count: dbProducts.filter((p: any) => {
              const pSub = (p.subcategoryName || p.subcategories || p.subcategory || '').trim().toLowerCase();
              return pSub === sNameLower;
            }).length,
          };
        });
      }

      // Tier 3: Extract subcategories directly from offline products for this category
      if (subList.length === 0) {
        const subMap = new Map<string, { image: string; count: number; name: string }>();
        dbProducts.forEach((p: any) => {
          const pCat = (p.categoryName || p.categories || p.category || '').trim().toLowerCase();
          if (pCat === cNameClean) {
            const pSub = (p.subcategoryName || p.subcategories || p.subcategory || '').trim();
            if (pSub) {
              const pSubLower = pSub.toLowerCase();
              const existing = subMap.get(pSubLower) || { image: p.image || p.imageUrl || '', count: 0, name: pSub };
              existing.count += 1;
              if (!existing.image && (p.image || p.imageUrl)) {
                existing.image = p.image || p.imageUrl;
              }
              subMap.set(pSubLower, existing);
            }
          }
        });

        subMap.forEach((val) => {
          subList.push({
            name: val.name,
            image: val.image,
            count: val.count,
          });
        });
      }

      const totalProdCount = dbProducts.filter((p: any) => {
        const pCat = (p.categoryName || p.categories || p.category || '').trim().toLowerCase();
        return pCat === cNameClean;
      }).length;

      return {
        name: c.name || c.categoryName || '',
        image: c.image || c.imageUrl || '',
        totalCount: totalProdCount > 0 ? totalProdCount : (c.totalCount || 0),
        subcategories: subList,
      };
    });

    return {
      success: true,
      categories,
      priceRange: { min: 0, max: 40000 },
    };
  }

  const catMap = new Map<string, { image: string; subcats: Map<string, number> }>();
  for (const p of dbProducts) {
    const cat = (p.categoryName || p.categories || 'Uncategorized').trim();
    const sub = (p.subcategoryName || p.subcategories || '').trim();
    if (!catMap.has(cat)) {
      catMap.set(cat, { image: p.image || p.imageUrl || '', subcats: new Map() });
    }
    const entry = catMap.get(cat)!;
    if (sub) {
      entry.subcats.set(sub, (entry.subcats.get(sub) ?? 0) + 1);
    }
  }

  const categories: CategoryFilter[] = [];
  catMap.forEach((val, name) => {
    const subs: SubcategoryFilter[] = [];
    val.subcats.forEach((count, subName) => {
      subs.push({ name: subName, image: '', count });
    });
    categories.push({
      name,
      image: val.image,
      totalCount: Array.from(val.subcats.values()).reduce((a, b) => a + b, 0),
      subcategories: subs,
    });
  });

  return {
    success: true,
    categories: categories.sort((a, b) => a.name.localeCompare(b.name)),
    priceRange: { min: 0, max: 40000 },
  };
}

// ─── Fetcher (data-mode-aware: offline-first or network-first) ──────────────

/** Read the current data mode from localStorage (avoids React context in SWR fetcher) */
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
        category: u.searchParams.get('category') || u.searchParams.get('prioritizeCategory') || undefined,
        prioritizeCategory: u.searchParams.get('prioritizeCategory') || undefined,
        subcategory: u.searchParams.get('subcategory') || undefined,
        search: u.searchParams.get('search') || undefined,
        productId: u.searchParams.get('productId') || undefined,
        page: parseInt(u.searchParams.get('page') || '1', 10),
        limit: parseInt(u.searchParams.get('limit') || '20', 10),
      };
    } catch {
      return {};
    }
  };

  const isProductsFilters = url.includes('/api/products/filters');
  const isProducts = url.includes('/api/products');

  // ── OFFLINE MODE: serve from IndexedDB, skip network ──────────────────────
  const mode = getDataMode();
  if (mode === 'offline' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    const rawProducts = await offlineDB.getAll<any>('products').catch(() => []);
    if (rawProducts.length > 0) {
      if (isProductsFilters) return getOfflineFilters() as unknown as T;
      if (isProducts) return getOfflineProducts(parseOptions()) as unknown as T;
    }
    // No synced data — if user explicitly chose offline, return empty; otherwise fall through
    if (mode === 'offline') {
      if (isProductsFilters) return { success: true, categories: [], priceRange: { min: 0, max: 40000 } } as unknown as T;
      if (isProducts) return { success: true, count: 0, totalCount: 0, hasNextPage: false, nextCursor: null, data: [] } as unknown as T;
    }
  }

  // ── ONLINE MODE: network fetch with IndexedDB fallback on failure ──────────
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

    return res.json();
  } catch (err) {
    // Network error fallback → try IndexedDB
    const meta = await offlineDB.getMeta().catch(() => null);
    if (meta && meta.totalProducts > 0) {
      if (isProductsFilters) return getOfflineFilters() as unknown as T;
      if (isProducts) return getOfflineProducts(parseOptions()) as unknown as T;
    }
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
    if (productId) params.set('productId', productId);
    if (prioritizeCategory) params.set('prioritizeCategory', prioritizeCategory);
    const currentLimit = pageIndex > 0 ? limit : (options.initialLimit || limit);
    params.set('limit', String(currentLimit));
    params.set('page', String(pageIndex + 1));
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
    dedupingInterval: 5000,
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
 * Falls back to IndexedDB when offline.
 */
export function useAllProducts(options: Omit<UseProductsOptions, 'limit'> & { fallbackData?: ProductsResponse } = {}) {
  const { sort = 'view', category, subcategory, search, fallbackData } = options;
  const { dataMode } = useDataMode();

  const params = new URLSearchParams();
  params.set('sort', sort);
  params.set('limit', '500');
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
    dedupingInterval: 5000,
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
    fallbackData,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60000,
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
