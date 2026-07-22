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
    const error = await res.json().catch(() => ({ msg: 'Network error' }));
    throw new Error(error.msg || 'Failed to fetch');
  }

  return res.json();
};

// ─── Hook: useProducts (Cursor Paginated + SWR Cached) ──────────────────────

interface UseProductsOptions {
  sort?: string;
  category?: string;
  subcategory?: string;
  search?: string;
  limit?: number;
}

/**
 * Cursor-paginated, SWR-cached hook for fetching products.
 * 
 * - First visit: fetches from the API proxy (`/api/products`)
 * - Revisits: instantly shows cached data, then silently revalidates in background
 * - "Load More": appends the next page via cursor pagination
 * 
 * Usage:
 *   const { products, isLoading, isLoadingMore, hasMore, loadMore, error } = useProducts({ sort: 'view' });
 */
export function useProducts(options: UseProductsOptions = {}) {
  const { sort, category, subcategory, search, limit = 20 } = options;

  // Build query string from options
  const buildQuery = (cursor?: string) => {
    const params = new URLSearchParams();
    if (sort) params.set('sort', sort);
    if (category) params.set('category', category);
    if (subcategory) params.set('subcategory', subcategory);
    if (search) params.set('search', search);
    params.set('limit', String(limit));
    if (cursor) params.set('cursor', cursor);
    return params.toString();
  };

  const getKey = (pageIndex: number, previousPageData: ProductsResponse | null) => {
    // First page
    if (pageIndex === 0) return `/api/products?${buildQuery()}`;

    // No more pages
    if (previousPageData && !previousPageData.hasNextPage) return null;

    // Next page using cursor
    const cursor = previousPageData?.data?.[previousPageData.data.length - 1]?.id;
    if (!cursor) return null;

    return `/api/products?${buildQuery(cursor)}`;
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
  });

  // Flatten all pages into a single array
  const products: CatalogueProduct[] = pages ? pages.flatMap((page) => page.data) : [];

  // Determine loading states
  const isLoadingInitial = isLoading;
  const isLoadingMore = size > 0 && pages && typeof pages[size - 1] === 'undefined';
  const hasMore = pages ? pages[pages.length - 1]?.hasNextPage ?? false : false;
  const totalCount = products.length;

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
