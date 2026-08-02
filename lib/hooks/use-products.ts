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

/** Shape IndexedDB products into the ProductsResponse format */
async function getOfflineProducts(options: any = {}): Promise<ProductsResponse> {
  const [raw, dbWishlist] = await Promise.all([
    offlineDB.getAll<any>('products').catch(() => []),
    offlineDB.getAll<any>('wishlist').catch(() => []),
  ]);

  if (raw.length === 0) {
    return {
      success: true,
      count: 0,
      totalCount: 0,
      exactMatchFound: options.search ? false : undefined,
      hasNextPage: false,
      nextCursor: null,
      data: [],
    };
  }

  const { sort, category, subcategory, search, prioritizeCategory, productId, page: rawPage, limit: rawLimit } = options;

  const limit = Math.min(Math.max(Number(rawLimit) || 20, 1), 10000);
  const page = Number(rawPage) || 1;

  // 1. Fetch salesrep wishlist for scoring
  const userWishlist = dbWishlist.find((w: any) => w.id === 'user_wishlist') || dbWishlist[0] || {};
  const wishProdMap = new Map<string, number>();
  (userWishlist.products || []).forEach((p: any, idx: number) => {
    if (p.productId) wishProdMap.set(String(p.productId).trim().toLowerCase(), p.order ?? idx);
  });

  const wishSubMap = new Map<string, number>();
  (userWishlist.subcategories || []).forEach((s: any, idx: number) => {
    if (s.category && s.name) {
      wishSubMap.set(`${String(s.category).trim().toLowerCase()}>${String(s.name).trim().toLowerCase()}`, s.order ?? idx);
    }
  });

  const wishCatMap = new Map<string, number>();
  (userWishlist.categories || []).forEach((c: any, idx: number) => {
    if (c.name) wishCatMap.set(String(c.name).trim().toLowerCase(), c.order ?? idx);
  });

  const hasWishlist = wishProdMap.size > 0 || wishSubMap.size > 0 || wishCatMap.size > 0;

  // Helper to compute wishlist score
  const getWishlistScore = (p: any): number => {
    const pId = String(p.productId || p.productCode || p.id || '').trim().toLowerCase();
    if (wishProdMap.has(pId)) return wishProdMap.get(pId)!;

    const pCat = (p.categoryName || p.categories || p.category || '').trim().toLowerCase();
    const pSub = (p.subcategoryName || p.subcategories || p.subcategory || p.subCategory || '').trim().toLowerCase();

    const subKey = `${pCat}>${pSub}`;
    if (wishSubMap.has(subKey)) return 1000 + wishSubMap.get(subKey)!;

    if (wishCatMap.has(pCat)) return 10000 + wishCatMap.get(pCat)!;

    return 999999;
  };

  // 2. Base Filter
  let filterList = raw.filter((p: any) => !p.isDeleted);

  let prioritizedProduct: any = null;

  // If productId parameter is passed, find prioritizedProduct
  if (productId) {
    const cleanId = String(productId).trim().toLowerCase();
    const numMatch = cleanId.match(/\d+/);
    const numPattern = numMatch ? numMatch[0] : null;

    prioritizedProduct = filterList.find((p: any) => {
      const pProdId = String(p.productId || p.id || '').trim().toLowerCase();
      const pCode = String(p.code || p.productCode || '').trim().toLowerCase();
      if (pProdId === cleanId || pCode === cleanId) return true;
      if (numPattern && (pProdId.includes(numPattern) || pCode.includes(numPattern))) return true;
      return false;
    });
  }

  // Category filter (comma-separated or array)
  if (category) {
    const cats = (Array.isArray(category) ? category : String(category).split(','))
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    if (cats.length > 0) {
      filterList = filterList.filter((p: any) => {
        const pCat = (p.categoryName || p.categories || p.category || (typeof p.category === 'object' ? p.category?.name : '') || '').trim().toLowerCase();
        const pCatId = String(p.categoryId || (typeof p.category === 'object' ? p.category?._id : '') || '').trim().toLowerCase();
        return cats.some((c) => pCat === c || pCat.includes(c) || c.includes(pCat) || (pCatId && pCatId === c));
      });
    }
  }

  // Subcategory filter (comma-separated or array)
  if (subcategory) {
    const subs = (Array.isArray(subcategory) ? subcategory : String(subcategory).split(','))
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (subs.length > 0) {
      filterList = filterList.filter((p: any) => {
        const pSub = (p.subcategoryName || p.subcategories || p.subcategory || p.subCategory || (typeof p.subcategory === 'object' ? p.subcategory?.name : '') || '').trim().toLowerCase();
        const pSubId = String(p.subcategoryId || (typeof p.subcategory === 'object' ? p.subcategory?._id : '') || '').trim().toLowerCase();
        return subs.some((s) => pSub === s || pSub.includes(s) || s.includes(pSub) || (pSubId && pSubId === s));
      });
    }
  }

  const totalMatching = filterList.length;

  let paginatedList = [...filterList];

  if (prioritizedProduct && page === 1) {
    const pIdStr = String(prioritizedProduct.id || prioritizedProduct.productId || prioritizedProduct._id);
    paginatedList = paginatedList.filter((p: any) => String(p.id || p.productId || p._id) !== pIdStr);
  }

  // 3. Search & Scoring logic (matching backend aggregate 100%)
  let exactMatchFound = false;
  let searchScores = new Map<string, number>();

  if (search) {
    const cleanSearch = String(search).trim();
    const searchLower = cleanSearch.toLowerCase();
    const cleanNum = searchLower.replace(/[^0-9]/g, '');
    const numMatch = cleanSearch.match(/\d+/);
    const numberPart = numMatch ? numMatch[0] : (cleanNum.length >= 3 ? cleanNum : null);

    // Find related categories and subcategories matching search terms
    const searchSubCategories = new Set<string>();
    const searchCategories = new Set<string>();

    for (const p of paginatedList) {
      const pName = String(p.name || '').toLowerCase();
      const pProdId = String(p.productId || p.id || '').toLowerCase();
      const pCode = String(p.code || p.productCode || '').toLowerCase();
      const pDesc = String(p.description || '').toLowerCase();
      const pProdNum = pProdId.replace(/[^0-9]/g, '');

      const isDirectMatch =
        pProdId === searchLower ||
        pProdId === `mtx-${searchLower}` ||
        pCode === searchLower ||
        pCode === `mtx-${searchLower}` ||
        (numberPart && (pProdId.includes(numberPart) || pCode.includes(numberPart) || pProdNum === numberPart)) ||
        pName.includes(searchLower) ||
        pDesc.includes(searchLower);

      if (isDirectMatch) {
        exactMatchFound = true;
        const pSub = (p.subcategoryName || p.subcategories || p.subcategory || p.subCategory || '').trim().toLowerCase();
        const pCat = (p.categoryName || p.categories || p.category || '').trim().toLowerCase();
        if (pSub) searchSubCategories.add(pSub);
        if (pCat) searchCategories.add(pCat);
      }
    }

    // Compute search score per product matching backend score branches
    for (const p of paginatedList) {
      const pKey = String(p.id || p.productId || p._id);
      const pName = String(p.name || '').toLowerCase();
      const pProdId = String(p.productId || p.id || '').toLowerCase();
      const pCode = String(p.code || p.productCode || '').toLowerCase();
      const pDesc = String(p.description || '').toLowerCase();
      const pSub = (p.subcategoryName || p.subcategories || p.subcategory || p.subCategory || '').trim().toLowerCase();
      const pCat = (p.categoryName || p.categories || p.category || '').trim().toLowerCase();
      const pProdNum = pProdId.replace(/[^0-9]/g, '');

      let score = 0;

      // Exact match on productId or productCode (e.g. 10049 or MTX-10049)
      const isExactProd =
        pProdId === searchLower ||
        pProdId === `mtx-${searchLower}` ||
        pCode === searchLower ||
        pCode === `mtx-${searchLower}` ||
        (numberPart && pProdNum === numberPart);

      if (isExactProd) {
        score = Math.max(score, 100);
      } else if (pProdId.includes(searchLower) || pCode.includes(searchLower)) {
        score = Math.max(score, 20);
      } else if (numberPart && (pProdId.includes(numberPart) || pCode.includes(numberPart))) {
        score = Math.max(score, 15);
      }

      if (pName.includes(searchLower)) score = Math.max(score, 6);
      if (pDesc.includes(searchLower)) score = Math.max(score, 5);
      if (pSub && searchSubCategories.has(pSub)) score = Math.max(score, 4);
      if (pCat && searchCategories.has(pCat)) score = Math.max(score, 3);
      if (pSub && pSub.includes(searchLower)) score = Math.max(score, 2);
      if (pCat && pCat.includes(searchLower)) score = Math.max(score, 1);

      if (score > 0) {
        searchScores.set(pKey, score);
      }
    }

    // Keep products with searchScore > 0
    paginatedList = paginatedList.filter((p: any) => {
      const pKey = String(p.id || p.productId || p._id);
      return searchScores.has(pKey);
    });
  }

  // 4. Sort Products
  const priorityCategoryLower = prioritizeCategory ? String(prioritizeCategory).trim().toLowerCase() : '';

  paginatedList.sort((a: any, b: any) => {
    const aKey = String(a.id || a.productId || a._id);
    const bKey = String(b.id || b.productId || b._id);

    // Primary: Search score DESC
    if (search) {
      const scoreA = searchScores.get(aKey) || 0;
      const scoreB = searchScores.get(bKey) || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
    }

    // Secondary: Priority Category ASC
    if (priorityCategoryLower) {
      const catA = (a.categoryName || a.categories || a.category || '').trim().toLowerCase();
      const catB = (b.categoryName || b.categories || b.category || '').trim().toLowerCase();
      const isPriA = catA === priorityCategoryLower ? 0 : 1;
      const isPriB = catB === priorityCategoryLower ? 0 : 1;
      if (isPriA !== isPriB) return isPriA - isPriB;
    }

    // Tertiary: Wishlist score ASC
    if (hasWishlist) {
      const wScoreA = getWishlistScore(a);
      const wScoreB = getWishlistScore(b);
      if (wScoreA !== wScoreB) return wScoreA - wScoreB;
    }

    // Quaternary: Sort order
    const s = sort ? String(sort).toLowerCase() : '';
    if (s === 'price-low' || s === 'price_asc' || s === 'low-to-high') {
      const priceA = Number(a.sellPrice || a.price || 0);
      const priceB = Number(b.sellPrice || b.price || 0);
      if (priceA !== priceB) return priceA - priceB;
    } else if (s === 'price-high' || s === 'price_desc' || s === 'high-to-low') {
      const priceA = Number(a.sellPrice || a.price || 0);
      const priceB = Number(b.sellPrice || b.price || 0);
      if (priceA !== priceB) return priceB - priceA;
    } else if (s === 'view') {
      const subA = String(a.subcategoryName || a.subcategories || a.subCategory || '');
      const subB = String(b.subcategoryName || b.subcategories || b.subCategory || '');
      if (subA !== subB) return subA.localeCompare(subB);

      const catA = String(a.categoryName || a.categories || a.category || '');
      const catB = String(b.categoryName || b.categories || b.category || '');
      if (catA !== catB) return catA.localeCompare(catB);

      const nameA = String(a.name || '');
      const nameB = String(b.name || '');
      if (nameA !== nameB) return nameA.localeCompare(nameB);
    }

    return String(bKey).localeCompare(String(aKey));
  });

  // 5. Pagination & Unshift prioritizedProduct
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const pageProducts = paginatedList.slice(startIndex, endIndex);
  const hasNextPage = endIndex < paginatedList.length;

  let finalProducts = pageProducts;
  if (prioritizedProduct && page === 1) {
    finalProducts = [prioritizedProduct, ...pageProducts];
  }

  const mappedProducts: CatalogueProduct[] = finalProducts.map((p: any) => ({
    id: String(p.id || p.productId || p._id || ''),
    name: String(p.name || '').toUpperCase(),
    productId: String(p.productId || p.productCode || p.id || ''),
    categories: String(p.categoryName || p.categories || p.category || '').toUpperCase(),
    subcategories: String(p.subcategoryName || p.subcategories || p.subcategory || p.subCategory || '').toUpperCase(),
    image: p.imageUrl || p.image || '',
    sellPrice: Number(p.sellPrice || p.price || 0),
    price: Number(p.price || p.sellPrice || 0),
    description: p.description || '',
  }));

  const nextCursor = hasNextPage && pageProducts.length > 0 ? String(pageProducts[pageProducts.length - 1].id || pageProducts[pageProducts.length - 1].productId) : null;

  return {
    success: true,
    count: mappedProducts.length,
    totalCount: totalMatching,
    exactMatchFound: search ? exactMatchFound : undefined,
    nextCursor,
    hasNextPage,
    data: mappedProducts,
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
    const effectiveSearch = search || productId;
    if (effectiveSearch) params.set('search', effectiveSearch);
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
