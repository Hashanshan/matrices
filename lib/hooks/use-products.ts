import useSWRInfinite from 'swr/infinite';
import useSWR from 'swr';
import { resolveApiUrl, getAuthToken, handleTokenExpiredRedirect } from '../utils';
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
  updatedAt?: string;
  createdAt?: string;
}

export interface ProductsResponse {
  success: boolean;
  count: number;
  totalCount?: number;
  exactMatchFound?: boolean;
  nextCursor: string | null;
  hasNextPage: boolean;
  data: CatalogueProduct[];
}

// ─── Offline helpers ────────────────────────────────────────────────────────

// In-memory cache for instant offline retrieval (avoids repeated full-table deserialization)
let cachedRawProducts: any[] | null = null;
let cachedRawWishlist: any[] | null = null;
let cachedRawCategories: any[] | null = null;
let cachedRawSubcategories: any[] | null = null;

async function getRawProductsAndWishlist(): Promise<[any[], any[]]> {
  if (cachedRawProducts && cachedRawWishlist) {
    return [cachedRawProducts, cachedRawWishlist];
  }
  const [raw, dbWishlist] = await Promise.all([
    offlineDB.getAll<any>('products').catch(() => []),
    offlineDB.getAll<any>('wishlist').catch(() => []),
  ]);
  cachedRawProducts = raw;
  cachedRawWishlist = dbWishlist;
  return [raw, dbWishlist];
}

async function getRawFiltersData(): Promise<[any[], any[], any[], any[]]> {
  if (cachedRawCategories && cachedRawSubcategories && cachedRawProducts && cachedRawWishlist) {
    return [cachedRawCategories, cachedRawSubcategories, cachedRawProducts, cachedRawWishlist];
  }
  const [dbCategories, dbSubcategories, dbProducts, dbWishlist] = await Promise.all([
    offlineDB.getAll<any>('categories').catch(() => []),
    offlineDB.getAll<any>('subcategories').catch(() => []),
    cachedRawProducts ? Promise.resolve(cachedRawProducts) : offlineDB.getAll<any>('products').catch(() => []),
    cachedRawWishlist ? Promise.resolve(cachedRawWishlist) : offlineDB.getAll<any>('wishlist').catch(() => []),
  ]);
  cachedRawCategories = dbCategories;
  cachedRawSubcategories = dbSubcategories;
  cachedRawProducts = dbProducts;
  cachedRawWishlist = dbWishlist;
  return [dbCategories, dbSubcategories, dbProducts, dbWishlist];
}

/** Shape IndexedDB products into the ProductsResponse format the hooks expect */
export async function getOfflineProducts(options: {
  sort?: string;
  category?: string | string[];
  prioritizeCategory?: string;
  subcategory?: string | string[];
  search?: string;
  productId?: string;
  timeFilter?: string;
  page?: number;
  limit?: number;
}): Promise<ProductsResponse> {
  const [raw, dbWishlist] = await getRawProductsAndWishlist();

  const userWishlist = (dbWishlist || []).find((w: any) => w.id === 'user_wishlist') || (dbWishlist || [])[0] || {};

  const wishlistedProdMap = new Map<string, number>();
  (userWishlist.products || []).forEach((p: any, idx: number) => {
    const pId = String(p.productId || p.id || '').trim();
    if (pId) wishlistedProdMap.set(pId, p.order ?? idx);
  });

  const wishlistedSubMap = new Map<string, number>();
  (userWishlist.subcategories || []).forEach((s: any, idx: number) => {
    const sCat = typeof s === 'object' ? s?.category || s?.categoryName : '';
    const sName = typeof s === 'string' ? s : s?.name || s?.subcategoryName || '';
    if (sCat && sName) {
      wishlistedSubMap.set(`${String(sCat).toUpperCase()}>${String(sName).toUpperCase()}`, s.order ?? idx);
    }
  });

  const wishlistedCatMap = new Map<string, number>();
  (userWishlist.categories || []).forEach((c: any, idx: number) => {
    const cName = typeof c === 'string' ? c : c?.name || c?.categoryName || '';
    if (cName) wishlistedCatMap.set(String(cName).toUpperCase(), c.order ?? idx);
  });

  const getWishlistScore = (p: any): number => {
    const pCat = (p.categoryName || p.categories || p.category || (typeof p.category === 'object' ? p.category?.name : '') || '').trim().toUpperCase();
    const pSub = (p.subcategoryName || p.subcategories || p.subcategory || (typeof p.subcategory === 'object' ? p.subcategory?.name : '') || '').trim().toUpperCase();
    const pId = String(p.productId || p.id || p._id || '').trim();
    const pCode = String(p.code || p.productCode || '').trim();

    if (pCat && wishlistedCatMap.has(pCat)) {
      return wishlistedCatMap.get(pCat)!;
    }

    if (pCat && pSub) {
      const subKey = `${pCat}>${pSub}`;
      if (wishlistedSubMap.has(subKey)) return 1000 + wishlistedSubMap.get(subKey)!;
    }

    if (pId && wishlistedProdMap.has(pId)) return 10000 + wishlistedProdMap.get(pId)!;
    if (pCode && wishlistedProdMap.has(pCode)) return 10000 + wishlistedProdMap.get(pCode)!;

    return 999999;
  };

  const parseList = (val?: string | string[] | null): string[] | null => {
    if (!val) return null;
    const arr = Array.isArray(val) ? val : [val];
    const items = arr
      .flatMap(item => String(item || '').split(','))
      .map(s => s.toLowerCase().trim())
      .filter(Boolean);
    return items.length > 0 ? items : null;
  };

  const targetCategory = options.category || options.prioritizeCategory;
  const catFilter = parseList(targetCategory);
  const subFilter = parseList(options.subcategory);
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

  // Pre-warm image cache when offline products are fetched
  prewarmImageCache().catch(() => {});

  const isSingleProductView = Boolean(options.productId || (search && prioritizedProd));

  // 2. Base category/subcategory/search filtering
  let filtered = raw.filter((p: any) => {
    // In single product view (e.g. /view?productId=...&category=...), do NOT exclude other categories/subcategories so user can swipe through target -> subcategory -> category -> other products
    if (!isSingleProductView && catFilter && catFilter.length > 0) {
      const pCat = (p.categoryName || p.categories || p.category || (typeof p.category === 'object' ? p.category?.name : '') || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const pCatId = String(p.categoryId || (typeof p.category === 'object' ? p.category?._id : '') || '').trim().toLowerCase();
      const matchesCat = catFilter.some(c => {
        const cleanC = c.toLowerCase().trim().replace(/\s+/g, ' ');
        if (!cleanC) return false;
        if (pCat === cleanC || (pCatId && pCatId === cleanC)) return true;
        if (pCat && pCat.split(',').map((x: string) => x.trim()).includes(cleanC)) return true;
        if (pCat && pCat.includes(cleanC)) return true;
        return false;
      });
      if (!matchesCat) return false;
    }

    if (!isSingleProductView && subFilter && subFilter.length > 0) {
      const pSub = (p.subcategoryName || p.subcategories || p.subcategory || (typeof p.subcategory === 'object' ? p.subcategory?.name : '') || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const pSubId = String(p.subcategoryId || (typeof p.subcategory === 'object' ? p.subcategory?._id : '') || '').trim().toLowerCase();
      const matchesSub = subFilter.some(s => {
        const cleanS = s.toLowerCase().trim().replace(/\s+/g, ' ');
        if (!cleanS) return false;
        if (pSub === cleanS || (pSubId && pSubId === cleanS)) return true;
        if (pSub && pSub.split(',').map((x: string) => x.trim()).includes(cleanS)) return true;
        if (pSub && pSub.includes(cleanS)) return true;
        return false;
      });
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

  // Apply time filter (e.g. 1week, 2week, 3week)
  if (options.timeFilter && options.timeFilter !== 'all' && options.timeFilter !== 'null') {
    const now = Date.now();
    let cutoff = 0;
    if (options.timeFilter === '1week' || options.timeFilter === '1w' || options.timeFilter === '7d') {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
    } else if (options.timeFilter === '2week' || options.timeFilter === '2w' || options.timeFilter === '14d') {
      cutoff = now - 14 * 24 * 60 * 60 * 1000;
    } else if (options.timeFilter === '3week' || options.timeFilter === '3w' || options.timeFilter === '21d') {
      cutoff = now - 21 * 24 * 60 * 60 * 1000;
    }

    if (cutoff > 0) {
      filtered = filtered.filter((p: any) => {
        const pTime = p.updatedAt ? new Date(p.updatedAt).getTime() : (p.createdAt ? new Date(p.createdAt).getTime() : 0);
        return pTime >= cutoff;
      });
    }
  }

  const hasWishlist = wishlistedProdMap.size > 0 || wishlistedSubMap.size > 0 || wishlistedCatMap.size > 0;

  // Apply sorting (Wishlist score primary, options.sort / category priority secondary)
  if (hasWishlist || options.sort || options.prioritizeCategory) {
    const s = (options.sort || '').toLowerCase();
    const prioCat = options.prioritizeCategory ? options.prioritizeCategory.trim().toUpperCase() : null;

    filtered.sort((a: any, b: any) => {
      // 1. Target prioritized category if requested
      if (prioCat) {
        const catA = (a.categoryName || a.categories || a.category || '').trim().toUpperCase();
        const catB = (b.categoryName || b.categories || b.category || '').trim().toUpperCase();
        const aPrio = catA === prioCat ? 0 : 1;
        const bPrio = catB === prioCat ? 0 : 1;
        if (aPrio !== bPrio) return aPrio - bPrio;
      }

      // 2. Primary sort: Wishlist score (matches backend productController.js MongoDB aggregation)
      if (hasWishlist && !prioritizedProd) {
        const scoreA = getWishlistScore(a);
        const scoreB = getWishlistScore(b);
        if (scoreA !== scoreB) return scoreA - scoreB;
      }

      // 3. Secondary sort: Explicit sort option
      if (s === 'price_asc' || s === 'price-low' || s === 'low-to-high') {
        return (a.sellPrice || a.price || 0) - (b.sellPrice || b.price || 0);
      } else if (s === 'price_desc' || s === 'price-high' || s === 'high-to-low') {
        return (b.sellPrice || b.price || 0) - (a.sellPrice || a.price || 0);
      } else if (s === 'name_asc' || s === 'a-z') {
        return String(a.name || '').localeCompare(String(b.name || ''));
      } else if (s === 'name_desc' || s === 'z-a') {
        return String(b.name || '').localeCompare(String(a.name || ''));
      } else if (s === 'view') {
        const subA = String(a.subcategoryName || a.subcategories || '');
        const subB = String(b.subcategoryName || b.subcategories || '');
        if (subA !== subB) return subA.localeCompare(subB);
        return String(a.name || '').localeCompare(String(b.name || ''));
      } else if (s === 'newest' || s === 'newest-first' || s === 'latest' || s === 'updatedat' || s === 'default' || !s) {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      }

      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });
  }

  const getSortComparator = (sortStr: string) => {
    const s = (sortStr || '').toLowerCase();
    if (s === 'price_asc' || s === 'price-low' || s === 'low-to-high') {
      return (a: any, b: any) => (a.sellPrice || a.price || 0) - (b.sellPrice || b.price || 0);
    } else if (s === 'price_desc' || s === 'price-high' || s === 'high-to-low') {
      return (a: any, b: any) => (b.sellPrice || b.price || 0) - (a.sellPrice || a.price || 0);
    } else if (s === 'name_asc' || s === 'a-z') {
      return (a: any, b: any) => String(a.name || '').localeCompare(String(b.name || ''));
    } else if (s === 'name_desc' || s === 'z-a') {
      return (a: any, b: any) => String(b.name || '').localeCompare(String(a.name || ''));
    } else if (s === 'rating') {
      return (a: any, b: any) => (b.rating || 0) - (a.rating || 0);
    } else if (s === 'newest' || s === 'newest-first' || s === 'latest' || s === 'updatedat' || s === 'default' || !s) {
      return (a: any, b: any) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      };
    }
    return (a: any, b: any) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    };
  };

  const sortFn = getSortComparator(options.sort || '');

  // 3. Re-order if prioritizedProd or category/subcategory grouping active:
  // Target Product -> Subcategory (sorted) -> Category (sorted) -> Remaining (Category A-Z -> Subcategory A-Z -> sorted)
  const targetCatStr = options.category
    ? (Array.isArray(options.category) ? options.category[0] : options.category).toLowerCase().trim()
    : (prioritizedProd ? (prioritizedProd.categoryName || prioritizedProd.categories || prioritizedProd.category || '').toLowerCase().trim() : '');

  const targetSubStr = options.subcategory
    ? (Array.isArray(options.subcategory) ? options.subcategory[0] : options.subcategory).toLowerCase().trim()
    : (prioritizedProd ? (prioritizedProd.subcategoryName || prioritizedProd.subcategories || prioritizedProd.subcategory || '').toLowerCase().trim() : '');

  if (prioritizedProd || targetSubStr || targetCatStr || (catFilter && catFilter.length > 0) || (subFilter && subFilter.length > 0)) {
    const targetId = prioritizedProd ? String(prioritizedProd.id || prioritizedProd.productId || prioritizedProd._id) : null;

    const subMatches: any[] = [];
    const catMatches: any[] = [];
    const others: any[] = [];

    for (const p of filtered) {
      const currentId = String(p.id || p.productId || p._id);
      if (targetId && currentId === targetId) continue;

      const pCat = (p.categoryName || p.categories || p.category || (typeof p.category === 'object' ? p.category?.name : '') || '').toLowerCase().trim();
      const pSub = (p.subcategoryName || p.subcategories || p.subcategory || (typeof p.subcategory === 'object' ? p.subcategory?.name : '') || '').toLowerCase().trim();

      const matchesSubcategory = subFilter && subFilter.some(s => pSub === s || pSub.includes(s));
      const matchesCategory = catFilter && catFilter.some(c => pCat === c || pCat.includes(c));

      if (targetSubStr && (pSub === targetSubStr || pSub.includes(targetSubStr) || matchesSubcategory)) {
        subMatches.push(p);
      } else if (targetCatStr && (pCat === targetCatStr || pCat.includes(targetCatStr) || matchesCategory)) {
        catMatches.push(p);
      } else if (matchesSubcategory) {
        subMatches.push(p);
      } else if (matchesCategory) {
        catMatches.push(p);
      } else {
        others.push(p);
      }
    }

    subMatches.sort(sortFn);
    catMatches.sort(sortFn);
    others.sort((a: any, b: any) => {
      const catA = (a.categoryName || a.categories || a.category || '').toLowerCase().trim();
      const catB = (b.categoryName || b.categories || b.category || '').toLowerCase().trim();
      if (catA !== catB) return catA.localeCompare(catB);

      const subA = (a.subcategoryName || a.subcategories || a.subcategory || '').toLowerCase().trim();
      const subB = (b.subcategoryName || b.subcategories || b.subcategory || '').toLowerCase().trim();
      if (subA !== subB) return subA.localeCompare(subB);

      const customSortResult = sortFn(a, b);
      if (customSortResult !== 0) return customSortResult;

      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    filtered = [
      ...(prioritizedProd ? [prioritizedProd] : []),
      ...subMatches,
      ...catMatches,
      ...others
    ];
  }

  const hasFilterActive = Boolean(
    (options.category && (Array.isArray(options.category) ? options.category.length > 0 : Boolean(options.category))) ||
    (options.subcategory && (Array.isArray(options.subcategory) ? options.subcategory.length > 0 : Boolean(options.subcategory))) ||
    Boolean(options.search) ||
    Boolean(options.productId) ||
    (options.timeFilter && options.timeFilter !== 'all' && options.timeFilter !== 'null')
  );

  const totalCount = hasFilterActive ? filtered.length : (raw.length > 0 ? raw.length : filtered.length);
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
    categories: String(p.categoryName || p.categories || p.category || '').trim().replace(/\s+/g, ' ').toUpperCase(),
    subcategories: String(p.subcategoryName || p.subcategories || p.subcategory || '').trim().replace(/\s+/g, ' ').toUpperCase(),
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
export async function getOfflineFilters(timeFilter?: string): Promise<FiltersResponse> {
  const hasTimeFilter = Boolean(timeFilter && timeFilter !== 'all' && timeFilter !== 'null');

  // Fast path for default view (no timeFilter): load only categories and wishlist (< 5ms)
  if (!hasTimeFilter) {
    if (!cachedRawCategories) {
      cachedRawCategories = await offlineDB.getAll<any>('categories').catch(() => []);
    }
    if (!cachedRawWishlist) {
      cachedRawWishlist = await offlineDB.getAll<any>('wishlist').catch(() => []);
    }

    if (cachedRawCategories && cachedRawCategories.length > 0) {
      const userWishlist = (cachedRawWishlist || []).find((w: any) => w.id === 'user_wishlist') || (cachedRawWishlist || [])[0] || {};
      const wishlistedCatMap = new Map<string, number>();
      (userWishlist.categories || []).forEach((c: any, idx: number) => {
        const cName = typeof c === 'string' ? c : c?.name || c?.categoryName || '';
        if (cName) wishlistedCatMap.set(String(cName).trim().replace(/\s+/g, ' ').toUpperCase(), c.order ?? idx);
      });

      const wishlistedSubMap = new Map<string, number>();
      (userWishlist.subcategories || []).forEach((s: any, idx: number) => {
        const sCat = typeof s === 'object' ? s?.category || s?.categoryName : '';
        const sName = typeof s === 'string' ? s : s?.name || s?.subcategoryName || '';
        if (sCat && sName) {
          const normCat = String(sCat).trim().replace(/\s+/g, ' ').toUpperCase();
          const normSub = String(sName).trim().replace(/\s+/g, ' ').toUpperCase();
          wishlistedSubMap.set(`${normCat}>${normSub}`, s.order ?? idx);
        }
      });

      // Deduplicate and merge categories from cachedRawCategories
      const catMap = new Map<string, {
        name: string;
        image: string;
        totalCount: number;
        subcats: Map<string, SubcategoryFilter>;
      }>();

      for (const c of cachedRawCategories) {
        const cName = (c.name || c.categoryName || '').trim().replace(/\s+/g, ' ').toUpperCase();
        if (!cName) continue;
        const cImg = c.image || c.imageUrl || c.categoryImage || '';

        if (!catMap.has(cName)) {
          catMap.set(cName, {
            name: cName,
            image: cImg,
            totalCount: 0,
            subcats: new Map(),
          });
        }

        const catObj = catMap.get(cName)!;
        catObj.totalCount += Number(c.totalCount || 0);
        if (!catObj.image && cImg) {
          catObj.image = cImg;
        }

        const rawSubs = Array.isArray(c.subcategories) ? c.subcategories : [];
        for (const s of rawSubs) {
          const sName = (typeof s === 'string' ? s : s.name || s.subcategoryName || '').trim().replace(/\s+/g, ' ').toUpperCase();
          if (!sName) continue;
          const sImg = (typeof s === 'object' ? s.image || s.imageUrl : '') || '';
          const sCount = typeof s === 'object' ? Number(s.count || 0) : 0;

          if (!catObj.subcats.has(sName)) {
            catObj.subcats.set(sName, {
              name: sName,
              image: sImg,
              count: 0,
            });
          }

          const subObj = catObj.subcats.get(sName)!;
          subObj.count += sCount;
          if (!subObj.image && sImg) {
            subObj.image = sImg;
          }
        }
      }

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
        priceRange: { min: 0, max: 60125 },
      };
    }
  }

  // Fallback or when timeFilter is active: compute dynamically across products
  const [dbCategories, dbSubcategories, dbProducts, dbWishlist] = await getRawFiltersData();

  if (dbProducts.length === 0 && dbCategories.length === 0) {
    return {
      success: true,
      categories: [],
      priceRange: { min: 0, max: 60125 },
    };
  }

  let cutoff = 0;
  if (timeFilter && timeFilter !== 'all' && timeFilter !== 'null') {
    const now = Date.now();
    if (timeFilter === '1week' || timeFilter === '1w' || timeFilter === '7d') {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
    } else if (timeFilter === '2week' || timeFilter === '2w' || timeFilter === '14d') {
      cutoff = now - 14 * 24 * 60 * 60 * 1000;
    } else if (timeFilter === '3week' || timeFilter === '3w' || timeFilter === '21d') {
      cutoff = now - 21 * 24 * 60 * 60 * 1000;
    }
  }

  const activeProducts = dbProducts.filter((p: any) => {
    if (p.isDeleted) return false;
    if (cutoff > 0) {
      const pTime = p.updatedAt ? new Date(p.updatedAt).getTime() : (p.createdAt ? new Date(p.createdAt).getTime() : 0);
      if (pTime < cutoff) return false;
    }
    return true;
  });

  // 1. Calculate dynamic min and max price range across active filtered products
  let minPrice = 0;
  let maxPrice = 60125;
  if (activeProducts.length > 0) {
    let minP = Infinity;
    let maxP = -Infinity;
    for (const p of activeProducts) {
      const val = Number(p.sellPrice || p.price || 0);
      if (val > 0) {
        if (val < minP) minP = val;
        if (val > maxP) maxP = val;
      }
    }
    if (minP !== Infinity) minPrice = Math.floor(minP);
    if (maxP !== -Infinity) maxPrice = Math.ceil(maxP);
  }

  // 2. Build Category & Subcategory Aggregation Map directly from activeProducts
  const catMap = new Map<string, {
    name: string;
    image: string;
    totalCount: number;
    subcats: Map<string, { name: string; image: string; count: number }>;
  }>();

  for (const p of activeProducts) {
    const rawCat = (p.categoryName || p.categories || p.category || (typeof p.category === 'object' ? p.category?.name : '') || '').trim().replace(/\s+/g, ' ');
    if (!rawCat) continue;
    const catName = rawCat.toUpperCase();

    const rawSub = (p.subcategoryName || p.subcategories || p.subcategory || p.subCategory || (typeof p.subcategory === 'object' ? p.subcategory?.name : '') || '').trim().replace(/\s+/g, ' ');
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

  // Incorporate dbCategories store records only when NO timeFilter is active
  if (cutoff === 0 && dbCategories.length > 0) {
    for (const c of dbCategories) {
      const cName = (c.name || c.categoryName || '').trim().replace(/\s+/g, ' ').toUpperCase();
      const cImg = c.image || c.imageUrl || c.categoryImage || '';

      if (cName && !catMap.has(cName)) {
        const subMap = new Map<string, { name: string; image: string; count: number }>();
        if (Array.isArray(c.subcategories)) {
          c.subcategories.forEach((s: any) => {
            const sName = (typeof s === 'string' ? s : s.name || s.subcategoryName || '').trim().replace(/\s+/g, ' ').toUpperCase();
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
      } else if (cName && catMap.has(cName)) {
        const existingCat = catMap.get(cName)!;
        if (!existingCat.image && cImg) {
          existingCat.image = cImg;
        }
        if (Array.isArray(c.subcategories)) {
          c.subcategories.forEach((s: any) => {
            const sName = (typeof s === 'string' ? s : s.name || s.subcategoryName || '').trim().replace(/\s+/g, ' ').toUpperCase();
            const sImg = (typeof s === 'object' ? s.image || s.imageUrl : '') || '';
            const sCount = typeof s === 'object' ? Number(s.count || 0) : 0;
            if (sName) {
              if (existingCat.subcats.has(sName)) {
                const existingSub = existingCat.subcats.get(sName)!;
                existingSub.count += sCount;
                if (!existingSub.image && sImg) {
                  existingSub.image = sImg;
                }
              } else {
                existingCat.subcats.set(sName, {
                  name: sName,
                  image: sImg,
                  count: sCount,
                });
              }
            }
          });
        }
      }
    }
  }

  // 3. Process Wishlist priorities for sorting
  const userWishlist = dbWishlist.find((w: any) => w.id === 'user_wishlist') || dbWishlist[0] || {};
  const wishlistedCatMap = new Map<string, number>();
  (userWishlist.categories || []).forEach((c: any, idx: number) => {
    const cName = typeof c === 'string' ? c : c?.name || c?.categoryName || '';
    if (cName) wishlistedCatMap.set(String(cName).trim().replace(/\s+/g, ' ').toUpperCase(), c.order ?? idx);
  });

  const wishlistedSubMap = new Map<string, number>();
  (userWishlist.subcategories || []).forEach((s: any, idx: number) => {
    const sCat = typeof s === 'object' ? s?.category || s?.categoryName : '';
    const sName = typeof s === 'string' ? s : s?.name || s?.subcategoryName || '';
    if (sCat && sName) {
      const normCat = String(sCat).trim().replace(/\s+/g, ' ').toUpperCase();
      const normSub = String(sName).trim().replace(/\s+/g, ' ').toUpperCase();
      wishlistedSubMap.set(`${normCat}>${normSub}`, s.order ?? idx);
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
        timeFilter: u.searchParams.get('timeFilter') || u.searchParams.get('timeRange') || u.searchParams.get('updatedWithin') || undefined,
        page: parseInt(u.searchParams.get('page') || '1', 10),
        limit: parseInt(u.searchParams.get('limit') || '20', 10),
      };
    } catch {
      return {};
    }
  };

  const isProductsFilters = url.includes('/api/products/filters');
  const isProducts = url.includes('/api/products') && !isProductsFilters;
  const mode = getDataMode();
  const isOffline = mode === 'offline' || (typeof navigator !== 'undefined' && !navigator.onLine);

  // ── OFFLINE MODE / DATA OFF: Instant local IndexedDB return (in-memory cached) ──
  if (isOffline) {
    if (isProductsFilters) return (await getOfflineFilters(parseOptions().timeFilter)) as unknown as T;
    if (isProducts) return (await getOfflineProducts(parseOptions())) as unknown as T;
    return { success: false } as unknown as T;
  }

  // ── ONLINE MODE: network fetch ────────────────────────────────────────────────
  const targetUrl = resolveApiUrl(url);
  try {
    const res = await fetch(targetUrl, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });

    const data = await res.json().catch(() => ({}));

    if (handleTokenExpiredRedirect(data, res.status)) {
      return { success: false, data: [] } as unknown as T;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    // Pre-warm image cache in the background after a successful products fetch
    if (isProducts && data?.data?.length > 0) {
      prewarmImageCache().catch(() => { });
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
    if (isProductsFilters) return (await getOfflineFilters(parseOptions().timeFilter)) as unknown as T;
    if (isProducts) return (await getOfflineProducts(parseOptions())) as unknown as T;
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
  timeFilter?: string;
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
  const { sort, category, subcategory, search, productId, timeFilter, limit = 20, prioritizeCategory, fallbackData } = options;

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
    if (productId && !search) params.set('search', productId);
    if (prioritizeCategory) params.set('prioritizeCategory', prioritizeCategory);
    if (timeFilter && timeFilter !== 'all') params.set('timeFilter', timeFilter);
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
  const { sort = 'view', category, subcategory, search, productId, fallbackData } = options;
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
  if (productId && !search) params.set('search', productId);

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

export function useFilters(options: { timeFilter?: string; fallbackData?: FiltersResponse } = {}) {
  const { timeFilter, fallbackData } = options;
  const { dataMode } = useDataMode();
  const timeQuery = timeFilter && timeFilter !== 'all' && timeFilter !== 'null' ? `&timeFilter=${encodeURIComponent(timeFilter)}` : '';
  const key = `/api/products/filters?_mode=${dataMode}${timeQuery}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<FiltersResponse>(key, fetcher, {
    fallbackData: fallbackData && fallbackData.categories && fallbackData.categories.length > 0 ? fallbackData : undefined,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    // Short deduping so fresh synced filters update immediately
    dedupingInterval: 2000,
    keepPreviousData: true,
  });
  // console.log("data", data);

  return {
    categories: data?.categories || [],
    priceRange: data?.priceRange || { min: 0, max: 40000 },
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
