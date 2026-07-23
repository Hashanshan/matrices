import useSWRInfinite from 'swr/infinite';
import useSWR from 'swr';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CatalogueProduct {
  id: string;
  name: string;
  productCode: string;
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
  nextCursor: string | null;
  hasNextPage: boolean;
  data: CatalogueProduct[];
}

// ─── Fetcher ────────────────────────────────────────────────────────────────

const fetcher = async (url: string): Promise<ProductsResponse> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const res = await fetch(url, {
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
    const error = await res.json().catch(() => ({ msg: 'Network error' }));
    throw new Error(error.msg || 'Failed to fetch');
  }

  return res.json();
};

// ─── Hook: useProducts (Cursor Paginated + SWR Cached) ──────────────────────

interface UseProductsOptions {
  sort?: string;
  category?: string | string[];
  subcategory?: string | string[];
  search?: string;
  limit?: number;
  initialLimit?: number;
  productId?: string;
  prioritizeCategory?: string;
  fallbackData?: ProductsResponse[];
}

/**
 * Cursor-paginated, SWR-cached hook for fetching products.
 */
export function useProducts(options: UseProductsOptions = {}) {
  const { sort, category, subcategory, search, limit = 20, productId, prioritizeCategory, fallbackData } = options;

  // Build query string from options
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
    return params.toString();
  };

  const getKey = (pageIndex: number, previousPageData: ProductsResponse | null) => {
    // First page
    if (pageIndex === 0) return `/api/products?${buildQuery(0)}`;

    // No more pages
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
    revalidateFirstPage: true,      // Revalidate first page on focus/revisit
    revalidateOnFocus: true,         // Auto-revalidate when tab regains focus
    revalidateOnReconnect: true,     // Auto-revalidate when network reconnects
    dedupingInterval: 5000,          // Dedupe identical requests within 5s
    keepPreviousData: true,          // Keep showing old data while revalidating
    fallbackData,
  });

  // Flatten all pages into a single array
  const products: CatalogueProduct[] = pages ? pages.flatMap((page) => page.data) : [];

  // Determine loading states
  const isLoadingInitial = isLoading;
  const isLoadingMore = size > 0 && pages && typeof pages[size - 1] === 'undefined';
  const hasMore = pages ? pages[pages.length - 1]?.hasNextPage ?? false : false;
  const totalCount = pages && pages[0] ? pages[0].totalCount ?? products.length : products.length;

  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      setSize(size + 1);
    }
  };

  return {
    products,
    isLoading: isLoadingInitial,
    isLoadingMore: isLoadingMore ?? false,
    isValidating,
    hasMore,
    totalCount,
    loadMore,
    error,
    mutate,
  };
}

// ─── Hook: useAllProducts (Non-paginated, for /view page) ───────────────────

/**
 * Fetches ALL products in a single request (for the /view fullscreen viewer).
 * Uses a high limit to get everything in one shot with the 'view' sort order.
 * SWR handles caching and background revalidation.
 */
export function useAllProducts(options: Omit<UseProductsOptions, 'limit'> & { fallbackData?: ProductsResponse } = {}) {
  const { sort = 'view', category, subcategory, search, fallbackData } = options;

  const params = new URLSearchParams();
  params.set('sort', sort);
  params.set('limit', '500'); // High limit to get all products
  if (category) params.set('category', category);
  if (subcategory) params.set('subcategory', subcategory);
  if (search) params.set('search', search);

  const key = `/api/products?${params.toString()}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<ProductsResponse>(key, fetcher, {
    fallbackData,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
    keepPreviousData: true,
  });

  return {
    products: data?.data || [],
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

// ─── Hook: useFilters (Fetch Categories & Price Range) ───────────────────

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
    revalidateOnFocus: true,
    dedupingInterval: 60000, // cache for 1 minute
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
