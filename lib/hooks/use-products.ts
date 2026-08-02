import useSWRInfinite from 'swr/infinite';
import useSWR from 'swr';
import { resolveApiUrl, getAuthToken } from '../utils';
import { offlineDB } from '../offline/indexed-db';

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
  subcategory?: string | string[];
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ProductsResponse> {
  const raw = await offlineDB.getAll<any>('products');
  const catFilter = options.category
    ? (Array.isArray(options.category) ? options.category : [options.category]).map(c => c.toLowerCase())
    : null;
  const subFilter = options.subcategory
    ? (Array.isArray(options.subcategory) ? options.subcategory : [options.subcategory]).map(s => s.toLowerCase())
    : null;
  const search = options.search?.toLowerCase() ?? '';

  let filtered = raw.filter((p: any) => {
    if (catFilter && catFilter.length > 0 && catFilter[0]) {
      const pCat = (p.categoryName || p.categories || '').toLowerCase();
      if (!catFilter.some(c => pCat.includes(c))) return false;
    }
    if (subFilter && subFilter.length > 0 && subFilter[0]) {
      const pSub = (p.subcategoryName || p.subcategories || '').toLowerCase();
      if (!subFilter.some(s => pSub.includes(s))) return false;
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

  // Map to CatalogueProduct shape
  const mapped: CatalogueProduct[] = filtered.map((p: any) => ({
    id: p.id || p.productId,
    name: p.name || '',
    productId: p.productId || p.id,
    categories: p.categoryName || p.categories || '',
    subcategories: p.subcategoryName || p.subcategories || '',
    image: p.imageUrl || p.image || '',
    sellPrice: p.price || 0,
    price: p.price || 0,
    description: p.description || '',
  }));

  const page = options.page ?? 1;
  const limit = options.limit ?? 500;
  const start = (page - 1) * limit;
  const slice = mapped.slice(start, start + limit);

  return {
    success: true,
    count: slice.length,
    totalCount: mapped.length,
    hasNextPage: start + limit < mapped.length,
    nextCursor: null,
    data: slice,
  };
}

/** Shape IndexedDB categories into FiltersResponse format */
async function getOfflineFilters(): Promise<FiltersResponse> {
  const products = await offlineDB.getAll<any>('products');

  const catMap = new Map<string, { image: string; subcats: Map<string, number> }>();
  for (const p of products) {
    const cat = (p.categoryName || p.categories || '').trim();
    const sub = (p.subcategoryName || p.subcategories || '').trim();
    if (!cat) continue;
    if (!catMap.has(cat)) catMap.set(cat, { image: p.imageUrl || '', subcats: new Map() });
    const entry = catMap.get(cat)!;
    if (sub) {
      entry.subcats.set(sub, (entry.subcats.get(sub) ?? 0) + 1);
    } else {
      entry.subcats.set('(General)', (entry.subcats.get('(General)') ?? 0) + 1);
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

// ─── Fetcher (network → IndexedDB fallback) ──────────────────────────────────

const fetcher = async <T = any>(url: string): Promise<T> => {
  const token = getAuthToken();
  const targetUrl = resolveApiUrl(url);

  // Parse options from the URL for offline fallback
  const parseOptions = () => {
    try {
      const u = new URL(url, 'http://x');
      return {
        category: u.searchParams.get('category') || undefined,
        subcategory: u.searchParams.get('subcategory') || undefined,
        search: u.searchParams.get('search') || undefined,
        page: parseInt(u.searchParams.get('page') || '1', 10),
        limit: parseInt(u.searchParams.get('limit') || '20', 10),
      };
    } catch {
      return {};
    }
  };

  // If already offline, skip the network call entirely
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (url.includes('/api/products/filters')) {
      return getOfflineFilters() as unknown as T;
    }
    if (url.includes('/api/products')) {
      return getOfflineProducts(parseOptions()) as unknown as T;
    }
    throw new Error('Offline');
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth-error'));
        }
      }
      throw new Error(`HTTP ${res.status}`);
    }

    return res.json();
  } catch (err) {
    // Network error → fall back to IndexedDB
    const hasOfflineData = await offlineDB.getMeta().then(m => m !== null).catch(() => false);
    if (hasOfflineData) {
      if (url.includes('/api/products/filters')) {
        return getOfflineFilters() as unknown as T;
      }
      if (url.includes('/api/products')) {
        return getOfflineProducts(parseOptions()) as unknown as T;
      }
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
  const { sort, category, subcategory, search, limit = 20, prioritizeCategory, fallbackData } = options;

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
    if (prioritizeCategory) params.set('prioritizeCategory', prioritizeCategory);
    const currentLimit = pageIndex > 0 ? limit : (options.initialLimit || limit);
    params.set('limit', String(currentLimit));
    params.set('page', String(pageIndex + 1));
    return params.toString();
  };

  const getKey = (pageIndex: number, previousPageData: ProductsResponse | null) => {
    if (pageIndex === 0) return `/api/products?${buildQuery(0)}`;
    if (previousPageData && !previousPageData.hasNextPage) return null;
    return `/api/products?${buildQuery(pageIndex)}`;
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

  const params = new URLSearchParams();
  params.set('sort', sort);
  params.set('limit', '500');
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
  const key = '/api/products/filters';

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
