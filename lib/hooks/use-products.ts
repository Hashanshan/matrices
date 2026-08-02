import useSWRInfinite from 'swr/infinite';
import useSWR from 'swr';
import { resolveApiUrl, getAuthToken } from '../utils';
import { offlineDB } from '../offline/indexed-db';
import { useDataMode } from '../contexts/data-mode-context';
import { prewarmImageCache } from '../offline/image-cache';

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
  const raw = await offlineDB.getAll<any>('products').catch(() => []);
  const targetCategory = options.category || options.prioritizeCategory;
  const catFilter = targetCategory
    ? (Array.isArray(targetCategory) ? targetCategory : [targetCategory]).map(c => c.toLowerCase().trim())
    : null;
  const subFilter = options.subcategory
    ? (Array.isArray(options.subcategory) ? options.subcategory : [options.subcategory]).map(s => s.toLowerCase().trim())
    : null;
  const search = (options.search || options.productId || '').trim();
  const searchLower = search.toLowerCase();
  const searchClean = searchLower.replace(/[^a-zA-Z0-9]/g, '');
  const numMatch = searchLower.match(/\d+/);
  const numPattern = numMatch ? numMatch[0] : null;

  let exactMatchFound = false;
  let prioritizedProd: any = null;

  // 1. Identify prioritized match across entire raw DB (matching backend search logic)
  if (search) {
    const rawMatchIdx = raw.findIndex((p: any) => {
      const pProdId = String(p.productId || '').trim().toLowerCase();
      const pId = String(p.id || p._id || '').trim().toLowerCase();
      const pCode = String(p.code || p.productCode || '').trim().toLowerCase();

      if (pProdId === searchLower || pId === searchLower || pCode === searchLower) return true;

      if (searchClean && searchClean.length >= 3) {
        const cProdId = pProdId.replace(/[^a-zA-Z0-9]/g, '');
        const cCode = pCode.replace(/[^a-zA-Z0-9]/g, '');
        const cId = pId.replace(/[^a-zA-Z0-9]/g, '');
        if (cProdId === searchClean || cCode === searchClean || cId === searchClean) return true;
      }

      if (numPattern) {
        if (pProdId.includes(numPattern) || pCode.includes(numPattern)) return true;
      }

      return false;
    });

    if (rawMatchIdx >= 0) {
      exactMatchFound = true;
      prioritizedProd = raw[rawMatchIdx];
    } else {
      // Check for partial name match if no ID/code match found
      const nameMatchIdx = raw.findIndex((p: any) => {
        const pName = String(p.name || '').trim().toLowerCase();
        return pName.includes(searchLower);
      });
      if (nameMatchIdx >= 0) {
        prioritizedProd = raw[nameMatchIdx];
      }
    }
  }

  // 2. Base category/subcategory/search filtering
  let filtered = raw.filter((p: any) => {
    if (catFilter && catFilter.length > 0 && catFilter[0]) {
      const pCat = (p.categoryName || p.categories || p.category || (typeof p.category === 'object' ? p.category?.name : '') || '').toLowerCase().trim();
      const pCatId = String(p.categoryId || (typeof p.category === 'object' ? p.category?._id : '') || '').trim().toLowerCase();
      const matchesCat = catFilter.some(c => pCat === c || pCat.includes(c) || c.includes(pCat) || (pCatId && pCatId === c));
      if (!matchesCat) return false;
    }

    if (subFilter && subFilter.length > 0 && subFilter[0]) {
      const pSub = (p.subcategoryName || p.subcategories || p.subcategory || (typeof p.subcategory === 'object' ? p.subcategory?.name : '') || '').toLowerCase().trim();
      const pSubId = String(p.subcategoryId || (typeof p.subcategory === 'object' ? p.subcategory?._id : '') || '').trim().toLowerCase();
      const matchesSub = subFilter.some(s => pSub === s || pSub.includes(s) || s.includes(pSub) || (pSubId && pSubId === s));
      if (!matchesSub) return false;
    }

    // If search was performed but no target product prioritized, filter by query substring
    if (searchLower && !prioritizedProd) {
      const pName = (p.name || '').toLowerCase();
      const pProdId = String(p.productId || p.id || '').toLowerCase();
      const pCode = String(p.code || p.productCode || '').toLowerCase();
      const pCat = (p.categoryName || p.categories || '').toLowerCase();
      const pSub = (p.subcategoryName || p.subcategories || '').toLowerCase();

      return (
        pName.includes(searchLower) ||
        pProdId.includes(searchLower) ||
        pCode.includes(searchLower) ||
        pCat.includes(searchLower) ||
        pSub.includes(searchLower)
      );
    }

    return true;
  });

  // Apply sorting
  if (options.sort) {
    const s = options.sort.toLowerCase();
    if (s === 'price_asc' || s === 'price-low' || s === 'low-to-high') {
      filtered.sort((a: any, b: any) => (a.sellPrice || a.price || 0) - (b.sellPrice || b.price || 0));
    } else if (s === 'price_desc' || s === 'price-high' || s === 'high-to-low') {
      filtered.sort((a: any, b: any) => (b.sellPrice || b.price || 0) - (a.sellPrice || a.price || 0));
    } else if (s === 'name_asc' || s === 'a-z') {
      filtered.sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')));
    } else if (s === 'name_desc' || s === 'z-a') {
      filtered.sort((a: any, b: any) => String(b.name || '').localeCompare(String(a.name || '')));
    } else if (s === 'view') {
      filtered.sort((a: any, b: any) => {
        const subA = String(a.subcategoryName || a.subcategories || '');
        const subB = String(b.subcategoryName || b.subcategories || '');
        if (subA !== subB) return subA.localeCompare(subB);
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
    }
  }

  // 3. Re-order if prioritizedProd is present: Target Product -> Subcategory -> Category -> Remaining
  if (prioritizedProd) {
    const targetId = String(prioritizedProd.id || prioritizedProd.productId || prioritizedProd._id);
    const targetCat = (prioritizedProd.categoryName || prioritizedProd.categories || prioritizedProd.category || '').toLowerCase().trim();
    const targetSub = (prioritizedProd.subcategoryName || prioritizedProd.subcategories || prioritizedProd.subcategory || '').toLowerCase().trim();

    const subMatches: any[] = [];
    const catMatches: any[] = [];
    const others: any[] = [];

    for (const p of filtered) {
      const currentId = String(p.id || p.productId || p._id);
      if (currentId === targetId) continue;

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

    filtered = [prioritizedProd, ...subMatches, ...catMatches, ...others];
  }

  const totalCount = raw.length > 0 ? raw.length : filtered.length;
  const page = options.page || 1;
  const limit = options.limit || 5000;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const pageItems = filtered.slice(startIndex, endIndex);
  const hasNextPage = endIndex < filtered.length;

  const mapped: CatalogueProduct[] = pageItems.map((p: any) => ({
    id: String(p.id || p.productId || p._id || ''),
    name: String(p.name || '').toUpperCase(),
    productId: String(p.productId || p.productCode || p.id || ''),
    categories: String(p.categoryName || p.categories || p.category || '').toUpperCase(),
    subcategories: String(p.subcategoryName || p.subcategories || p.subcategory || '').toUpperCase(),
    image: p.imageUrl || p.image || '',
    sellPrice: Number(p.sellPrice || p.price || 0),
    price: Number(p.price || p.sellPrice || 0),
    description: p.description || '',
  }));

  return {
    success: true,
    count: mapped.length,
    totalCount,
    exactMatchFound: search ? exactMatchFound : undefined,
    hasNextPage,
    nextCursor: hasNextPage && pageItems.length > 0 ? String(pageItems[pageItems.length - 1].id) : null,
    data: mapped,
  };
}

/** Shape IndexedDB categories into FiltersResponse format (matching backend aggregation) */
async function getOfflineFilters(): Promise<FiltersResponse> {
  const [dbCategories, dbSubcategories, dbProducts, dbWishlist] = await Promise.all([
    offlineDB.getAll<any>('categories').catch(() => []),
    offlineDB.getAll<any>('subcategories').catch(() => []),
    offlineDB.getAll<any>('products').catch(() => []),
    offlineDB.getAll<any>('wishlist').catch(() => []),
  ]);

  if (dbProducts.length === 0 && dbCategories.length === 0) {
    return {
      success: true,
      categories: [],
      priceRange: { min: 0, max: 60125 },
    };
  }

  // 1. Calculate dynamic min and max price range across all products
  let minPrice = 0;
  let maxPrice = 60125;
  if (dbProducts.length > 0) {
    let minP = Infinity;
    let maxP = -Infinity;
    for (const p of dbProducts) {
      const val = Number(p.sellPrice || p.price || 0);
      if (val > 0) {
        if (val < minP) minP = val;
        if (val > maxP) maxP = val;
      }
    }
    if (minP !== Infinity) minPrice = Math.floor(minP);
    if (maxP !== -Infinity) maxPrice = Math.ceil(maxP);
  }

  // 2. Build Category & Subcategory Aggregation Map directly from dbProducts
  const catMap = new Map<string, {
    name: string;
    image: string;
    totalCount: number;
    subcats: Map<string, { name: string; image: string; count: number }>;
  }>();

  for (const p of dbProducts) {
    const rawCat = (p.categoryName || p.categories || p.category || (typeof p.category === 'object' ? p.category?.name : '') || '').trim();
    if (!rawCat) continue;
    const catName = rawCat.toUpperCase();

    const rawSub = (p.subcategoryName || p.subcategories || p.subcategory || p.subCategory || (typeof p.subcategory === 'object' ? p.subcategory?.name : '') || '').trim();
    const subName = rawSub ? rawSub.toUpperCase() : '';

    const pImg = p.image || p.imageUrl || (Array.isArray(p.images) && p.images[0]) || '';

    if (!catMap.has(catName)) {
      catMap.set(catName, {
        name: catName,
        image: pImg,
        totalCount: 0,
        subcats: new Map(),
      });
    }

    const catObj = catMap.get(catName)!;
    catObj.totalCount += 1;
    if (!catObj.image && pImg) {
      catObj.image = pImg;
    }

    if (subName) {
      if (!catObj.subcats.has(subName)) {
        catObj.subcats.set(subName, {
          name: subName,
          image: pImg,
          count: 0,
        });
      }
      const subObj = catObj.subcats.get(subName)!;
      subObj.count += 1;
      if (!subObj.image && pImg) {
        subObj.image = pImg;
      }
    }
  }

  // Incorporate dbCategories store records if not already in catMap
  if (dbCategories.length > 0) {
    for (const c of dbCategories) {
      const cName = (c.name || c.categoryName || '').trim().toUpperCase();
      if (cName && !catMap.has(cName)) {
        const cImg = c.image || c.imageUrl || c.categoryImage || '';
        const subMap = new Map<string, { name: string; image: string; count: number }>();
        if (Array.isArray(c.subcategories)) {
          c.subcategories.forEach((s: any) => {
            const sName = (typeof s === 'string' ? s : s.name || s.subcategoryName || '').trim().toUpperCase();
            if (sName) {
              subMap.set(sName, {
                name: sName,
                image: (typeof s === 'object' ? s.image || s.imageUrl : '') || '',
                count: typeof s === 'object' ? Number(s.count || 0) : 0,
              });
            }
          });
        }
        catMap.set(cName, {
          name: cName,
          image: cImg,
          totalCount: Number(c.totalCount || 0),
          subcats: subMap,
        });
      }
    }
  }

  // 3. Process Wishlist priorities for sorting
  const userWishlist = dbWishlist.find((w: any) => w.id === 'user_wishlist') || dbWishlist[0] || {};
  const wishlistedCatMap = new Map<string, number>();
  (userWishlist.categories || []).forEach((c: any, idx: number) => {
    if (c?.name) wishlistedCatMap.set(String(c.name).toUpperCase(), c.order ?? idx);
  });

  const wishlistedSubMap = new Map<string, number>();
  (userWishlist.subcategories || []).forEach((s: any, idx: number) => {
    if (s?.category && s?.name) {
      wishlistedSubMap.set(`${String(s.category).toUpperCase()}>${String(s.name).toUpperCase()}`, s.order ?? idx);
    }
  });

  // 4. Format Categories & Subcategories
  const formattedCategories: CategoryFilter[] = Array.from(catMap.values()).map(catObj => {
    const sortedSubs = Array.from(catObj.subcats.values());

    sortedSubs.sort((a, b) => {
      const keyA = `${catObj.name}>${a.name}`;
      const keyB = `${catObj.name}>${b.name}`;
      const aWish = wishlistedSubMap.has(keyA);
      const bWish = wishlistedSubMap.has(keyB);
      if (aWish && bWish) {
        return (wishlistedSubMap.get(keyA) ?? 0) - (wishlistedSubMap.get(keyB) ?? 0);
      }
      if (aWish) return -1;
      if (bWish) return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      name: catObj.name,
      image: catObj.image,
      totalCount: catObj.totalCount,
      subcategories: sortedSubs,
    };
  });

  // Sort main categories: Wishlisted FIRST (by order), then A-Z
  formattedCategories.sort((a, b) => {
    const aWish = wishlistedCatMap.has(a.name);
    const bWish = wishlistedCatMap.has(b.name);
    if (aWish && bWish) {
      return (wishlistedCatMap.get(a.name) ?? 0) - (wishlistedCatMap.get(b.name) ?? 0);
    }
    if (aWish) return -1;
    if (bWish) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    success: true,
    categories: formattedCategories,
    priceRange: { min: minPrice, max: maxPrice },
  };
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
