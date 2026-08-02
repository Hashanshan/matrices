/**
 * Page-Specific Offline Data Engine for Catalogue, Gallery, and View Pages
 * 
 * Provides client-side offline querying for:
 * 1. /catalogue page - getOfflineCatalogueProducts & getOfflineCatalogueFilters
 * 2. /gallery page   - getOfflineGalleryProducts
 * 3. /view page      - getOfflineViewProducts
 * 
 * Implemented directly against live API controller specifications:
 * - Cursor & Page Pagination
 * - Image URL Regex Filtering (/^https?:\/\/.+/i or valid local path) with safety fallback
 * - Wishlist Score Ranking (Products -> Subcategories -> Categories -> Default)
 * - Search Score Ranking (Exact ID/Code [100] -> Regex [20] -> Numeric [15] -> Name [6] -> Description [5] -> Subcat [4] -> Cat [3])
 * - Category Prioritization
 * - Dynamic Price Range Aggregation (MongoDB $group pipeline equivalent)
 * - Wishlist-First Filter Sorting
 */

import { offlineDB } from './indexed-db';

// ─── Interfaces ─────────────────────────────────────────────────────────────

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

export interface CatalogueProductsResponse {
  success: boolean;
  count: number;
  totalCount: number;
  exactMatchFound?: boolean;
  nextCursor: string | null;
  hasNextPage: boolean;
  data: CatalogueProduct[];
}

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

export interface CatalogueFiltersResponse {
  success: boolean;
  categories: CategoryFilter[];
  priceRange: {
    min: number;
    max: number;
  };
}

export interface OfflinePageOptions {
  cursor?: string | null;
  limit?: number;
  page?: number;
  sort?: 'view' | 'price-low' | 'price-high' | 'newest' | 'price_asc' | 'price_desc' | 'name' | string;
  category?: string | string[];
  subcategory?: string | string[];
  search?: string;
  prioritizeCategory?: string;
  productId?: string;
}

// ─── Internal Helper Functions ────────────────────────────────────────────────

/** Check if image URL is valid (matches http/https regex or non-empty string) */
function isValidImageUrl(img: string | undefined | null): boolean {
  if (!img || typeof img !== 'string') return false;
  const trimmed = img.trim();
  if (!trimmed) return false;
  return /^https?:\/\/.+/i.test(trimmed) || trimmed.startsWith('/');
}

/** Escape special regex characters in a query string */
function escapeRegex(str: string): string {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/** Extract string representation of a category or subcategory name */
function extractStr(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (Array.isArray(val)) return extractStr(val[0]);
  if (typeof val === 'object') {
    return (val.name || val.categoryName || val.subcategoryName || val.title || val.label || val._id || '').toString().trim();
  }
  return String(val).trim();
}

/** Extract category name from product record matching MongoDB $category field */
function getProductCategory(p: any): string {
  if (!p) return '';
  const raw = p.category || p.categoryName || p.categories || (typeof p.category === 'object' ? p.category?.name : '');
  return extractStr(raw).toUpperCase();
}

/** Extract subcategory name from product record matching MongoDB $subCategory field */
function getProductSubcategory(p: any): string {
  if (!p) return '';
  const raw = p.subCategory || p.subcategoryName || p.subcategories || p.subcategory || (typeof p.subcategory === 'object' ? p.subcategory?.name : '');
  return extractStr(raw).toUpperCase();
}

/** Fetch user wishlist object from IndexedDB */
async function getOfflineWishlist(): Promise<any | null> {
  try {
    const list = await offlineDB.getAll<any>('wishlist').catch(() => []);
    if (!list || list.length === 0) return null;
    return list.find((w: any) => w.id === 'user_wishlist' || w.userId) || list[0] || null;
  } catch {
    return null;
  }
}

// ─── 1. /catalogue Page Offline Functions ────────────────────────────────────

/**
 * GET /api/catelogue/products (Offline equivalent)
 * 
 * Cursor & page-paginated product listing for the catalogue.
 * Implements wishlist priority scoring, category prioritization, exact-match search scoring,
 * and field projection as per live API controller specifications.
 */
export async function getOfflineCatalogueProducts(
  options: OfflinePageOptions = {}
): Promise<CatalogueProductsResponse> {
  const {
    sort = 'newest',
    category,
    subcategory,
    search,
    cursor,
    limit: rawLimit = 20,
    page: rawPage,
    prioritizeCategory,
    productId,
  } = options;

  const limit = Math.min(Math.max(Number(rawLimit) || 20, 1), 10000);
  const page = Number(rawPage) || (cursor ? null : 1);

  // 1. Fetch raw products & wishlist from IndexedDB
  const rawProducts = await offlineDB.getAll<any>('products').catch(() => []);
  const wishlist = await getOfflineWishlist();

  // Non-deleted base product set
  const nonDeleted = rawProducts.filter((p: any) => p.isDeleted !== true);

  // 2. Base filter: valid image URL
  let products = nonDeleted.filter((p: any) => {
    const img = p.image || p.imageUrl || (Array.isArray(p.images) && p.images[0]) || '';
    return isValidImageUrl(img);
  });

  // Safety fallback: if strict image URL filter returned 0 items but non-deleted products exist, use all non-deleted products
  if (products.length === 0 && nonDeleted.length > 0) {
    products = nonDeleted;
  }

  // 3. Identify prioritized product if productId query parameter is provided
  let prioritizedProduct: any = null;
  if (productId) {
    const cleanId = String(productId).trim();
    const escapedId = escapeRegex(cleanId);
    const numMatch = cleanId.match(/\d+/);
    const numPattern = numMatch ? numMatch[0] : null;

    const idRegex = new RegExp(escapedId, 'i');
    const numRegex = numPattern ? new RegExp(numPattern, 'i') : null;

    const matchIdx = products.findIndex((p: any) => {
      const pId = String(p.productId || p._id || p.id || '');
      const pCode = String(p.productCode || p.code || '');
      if (idRegex.test(pId) || idRegex.test(pCode)) return true;
      if (numRegex && (numRegex.test(pId) || numRegex.test(pCode))) return true;
      return false;
    });

    if (matchIdx >= 0) {
      prioritizedProduct = products[matchIdx];
    }
  }

  // 4. Category filter
  if (category) {
    const catList = (Array.isArray(category) ? category : String(category).split(','))
      .map((c) => c.trim())
      .filter(Boolean);

    if (catList.length > 0) {
      const catRegexes = catList.map((c) => new RegExp(`^${escapeRegex(c)}$`, 'i'));
      products = products.filter((p: any) => {
        const pCat = getProductCategory(p);
        return catRegexes.some((rx) => rx.test(pCat));
      });
    }
  }

  // 5. Subcategory filter
  if (subcategory) {
    const subList = (Array.isArray(subcategory) ? subcategory : String(subcategory).split(','))
      .map((s) => s.trim())
      .filter(Boolean);

    if (subList.length > 0) {
      const subRegexes = subList.map((s) => new RegExp(`^${escapeRegex(s)}$`, 'i'));
      products = products.filter((p: any) => {
        const pSub = getProductSubcategory(p);
        return subRegexes.some((rx) => rx.test(pSub));
      });
    }
  }

  // Filter out prioritized product from paginated list if first page to prevent duplicates
  if (prioritizedProduct && (!page || page === 1) && !cursor) {
    const prioId = String(prioritizedProduct._id || prioritizedProduct.id || prioritizedProduct.productId);
    products = products.filter((p: any) => String(p._id || p.id || p.productId) !== prioId);
  }

  // 6. Build Wishlist Priority Scores
  const wishlistProdScoreMap = new Map<string, number>();
  (wishlist?.products || []).forEach((p: any, idx: number) => {
    if (p.productId) wishlistProdScoreMap.set(String(p.productId), p.order ?? idx);
  });

  const wishlistSubBranches: Array<{ categoryRx: RegExp; nameRx: RegExp; score: number }> = [];
  (wishlist?.subcategories || []).forEach((s: any, idx: number) => {
    if (s.category && s.name) {
      wishlistSubBranches.push({
        categoryRx: new RegExp(`^${escapeRegex(s.category)}$`, 'i'),
        nameRx: new RegExp(`^${escapeRegex(s.name)}$`, 'i'),
        score: 1000 + (s.order ?? idx),
      });
    }
  });

  const wishlistCatBranches: Array<{ nameRx: RegExp; score: number }> = [];
  (wishlist?.categories || []).forEach((c: any, idx: number) => {
    if (c.name) {
      wishlistCatBranches.push({
        nameRx: new RegExp(`^${escapeRegex(c.name)}$`, 'i'),
        score: 10000 + (c.order ?? idx),
      });
    }
  });

  const getWishlistScore = (p: any): number => {
    const pProdId = String(p.productId || p._id || p.id || '');
    if (wishlistProdScoreMap.has(pProdId)) return wishlistProdScoreMap.get(pProdId)!;

    const pCat = getProductCategory(p);
    const pSub = getProductSubcategory(p);

    for (const b of wishlistSubBranches) {
      if (b.categoryRx.test(pCat) && b.nameRx.test(pSub)) return b.score;
    }

    for (const b of wishlistCatBranches) {
      if (b.nameRx.test(pCat)) return b.score;
    }

    return 999999; // Default score if no wishlist match
  };

  // 7. Search Scoring & Exact Match Detection
  let exactMatchFound = false;
  const searchScoreMap = new Map<string, number>();

  if (search) {
    const cleanSearch = String(search).trim();
    const escapedSearch = escapeRegex(cleanSearch);
    const numMatch = cleanSearch.match(/\d+/);
    const numberPart = numMatch ? numMatch[0] : null;

    const exactIdRx = new RegExp(`^(${escapedSearch}|MTX-${escapedSearch})$`, 'i');
    const containsIdRx = new RegExp(escapedSearch, 'i');
    const numRx = numberPart ? new RegExp(numberPart, 'i') : null;
    const nameRx = new RegExp(escapedSearch, 'i');
    const descRx = new RegExp(escapedSearch, 'i');

    // Find related categories and subcategories from search direct matches
    const searchSubCategories = new Set<string>();
    const searchCategories = new Set<string>();

    products.forEach((p: any) => {
      const pProdId = String(p.productId || p._id || p.id || '');
      const pCode = String(p.productCode || p.code || '');
      const pName = String(p.name || '');
      const pDesc = String(p.description || '');

      const isMatch =
        exactIdRx.test(pProdId) ||
        exactIdRx.test(pCode) ||
        containsIdRx.test(pProdId) ||
        containsIdRx.test(pCode) ||
        nameRx.test(pName) ||
        descRx.test(pDesc) ||
        (numRx && (numRx.test(pProdId) || numRx.test(pCode)));

      if (isMatch) {
        exactMatchFound = true;
        const pSub = getProductSubcategory(p);
        const pCat = getProductCategory(p);
        if (pSub) searchSubCategories.add(pSub.toUpperCase());
        if (pCat) searchCategories.add(pCat.toUpperCase());
      }
    });

    const filteredScored: any[] = [];
    products.forEach((p: any) => {
      const pProdId = String(p.productId || p._id || p.id || '');
      const pCode = String(p.productCode || p.code || '');
      const pName = String(p.name || '');
      const pDesc = String(p.description || '');
      const pSub = getProductSubcategory(p).toUpperCase();
      const pCat = getProductCategory(p).toUpperCase();

      let score = 0;
      if (exactIdRx.test(pProdId) || exactIdRx.test(pCode)) score = 100;
      else if (containsIdRx.test(pProdId) || containsIdRx.test(pCode)) score = 20;
      else if (numRx && (numRx.test(pProdId) || numRx.test(pCode))) score = 15;
      else if (nameRx.test(pName)) score = 6;
      else if (descRx.test(pDesc)) score = 5;
      else if (pSub && searchSubCategories.has(pSub)) score = 4;
      else if (pCat && searchCategories.has(pCat)) score = 3;
      else if (pSub && containsIdRx.test(pSub)) score = 2;
      else if (pCat && containsIdRx.test(pCat)) score = 1;

      if (score > 0) {
        const itemKey = String(p._id || p.id || p.productId);
        searchScoreMap.set(itemKey, score);
        filteredScored.push(p);
      }
    });

    products = filteredScored;
  }

  // 8. Category Prioritization Branch
  const prioCatRx = prioritizeCategory ? new RegExp(`^${escapeRegex(prioritizeCategory)}$`, 'i') : null;
  const getIsPriority = (p: any): number => {
    if (!prioCatRx) return 1;
    const pCat = getProductCategory(p);
    return prioCatRx.test(pCat) ? 0 : 1;
  };

  // 9. Multi-tier Sorting Pipeline
  const hasWishlist = wishlistProdScoreMap.size > 0 || wishlistSubBranches.length > 0 || wishlistCatBranches.length > 0;

  products.sort((a: any, b: any) => {
    const keyA = String(a._id || a.id || a.productId);
    const keyB = String(b._id || b.id || b.productId);

    // Tier 1: Search Score (descending)
    if (search) {
      const scoreA = searchScoreMap.get(keyA) || 0;
      const scoreB = searchScoreMap.get(keyB) || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
    }

    // Tier 2: Wishlist Score (ascending)
    if (hasWishlist) {
      const wScoreA = getWishlistScore(a);
      const wScoreB = getWishlistScore(b);
      if (wScoreA !== wScoreB) return wScoreA - wScoreB;
    }

    // Tier 3: Category Priority Score (ascending, 0 prioritized first)
    if (prioritizeCategory) {
      const prioA = getIsPriority(a);
      const prioB = getIsPriority(b);
      if (prioA !== prioB) return prioA - prioB;
    }

    // Tier 4: Base requested sort
    const priceA = Number(a.sellPrice || a.price || 0);
    const priceB = Number(b.sellPrice || b.price || 0);
    const nameA = String(a.name || '').toUpperCase();
    const nameB = String(b.name || '').toUpperCase();
    const subA = getProductSubcategory(a).toUpperCase();
    const subB = getProductSubcategory(b).toUpperCase();
    const catA = getProductCategory(a).toUpperCase();
    const catB = getProductCategory(b).toUpperCase();

    if (sort === 'view') {
      if (subA !== subB) return subA.localeCompare(subB);
      if (catA !== catB) return catA.localeCompare(catB);
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      return keyA.localeCompare(keyB);
    } else if (sort === 'price-low' || sort === 'price_asc') {
      if (priceA !== priceB) return priceA - priceB;
      return keyA.localeCompare(keyB);
    } else if (sort === 'price-high' || sort === 'price_desc') {
      if (priceA !== priceB) return priceB - priceA;
      return keyB.localeCompare(keyA);
    } else if (sort === 'name') {
      return nameA.localeCompare(nameB);
    } else {
      // Default: newest / _id descending
      return keyB.localeCompare(keyA);
    }
  });

  const totalMatching = products.length + (prioritizedProduct && (!page || page === 1) && !cursor ? 1 : 0);

  // 10. Cursor or Page Pagination Slicing
  let startIndex = 0;
  if (cursor) {
    const cursorIdx = products.findIndex((p: any) => String(p._id || p.id || p.productId) === String(cursor));
    if (cursorIdx >= 0) {
      startIndex = cursorIdx + 1;
    }
  } else if (page) {
    startIndex = (page - 1) * limit;
  }

  const slicedProducts = products.slice(startIndex, startIndex + limit + 1);
  const hasNextPage = slicedProducts.length > limit;
  const pageProducts = hasNextPage ? slicedProducts.slice(0, limit) : slicedProducts;

  let finalProducts = pageProducts;
  if (prioritizedProduct && (!page || page === 1) && !cursor) {
    finalProducts = [prioritizedProduct, ...pageProducts];
  }

  // 11. Project Fields to Match Live Controller Output Schema
  const mappedProducts: CatalogueProduct[] = finalProducts.map((p: any) => {
    const pIdStr = String(p._id || p.id || p.productId || '');
    const pCodeStr = String(p.productId || p.productCode || p.code || pIdStr);
    const catStr = getProductCategory(p).toUpperCase();
    const subStr = getProductSubcategory(p).toUpperCase();
    const imgStr = p.image || p.imageUrl || (Array.isArray(p.images) && p.images[0]) || '';
    const sellPriceVal = Number(p.sellPrice || p.price || 0);

    return {
      id: pIdStr,
      name: String(p.name || '').toUpperCase(),
      productId: pCodeStr,
      categories: catStr,
      subcategories: subStr,
      image: imgStr,
      sellPrice: sellPriceVal,
      price: sellPriceVal,
      description: String(p.description || ''),
    };
  });

  const nextCursor = hasNextPage && pageProducts.length > 0
    ? String(pageProducts[pageProducts.length - 1]._id || pageProducts[pageProducts.length - 1].id || pageProducts[pageProducts.length - 1].productId)
    : null;

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

/**
 * GET /api/catelogue/products/filters (Offline equivalent)
 * 
 * Replicates live MongoDB aggregation pipeline:
 * - Match image: /^https?:\/\/.+/i and isDeleted: false
 * - Group 1 by { category: "$category", subCategory: "$subCategory" }
 * - Group 2 by category, pushing subcategories with name, image, count
 * - Calculates minPrice & maxPrice stats
 * - Sorts Wishlisted categories/subcategories FIRST (by order), then A-Z
 */
export async function getOfflineCatalogueFilters(): Promise<CatalogueFiltersResponse> {
  const [rawProducts, dbCategories, wishlist] = await Promise.all([
    offlineDB.getAll<any>('products').catch(() => []),
    offlineDB.getAll<any>('categories').catch(() => []),
    getOfflineWishlist(),
  ]);

  // 1. Match filter (non-deleted products)
  const nonDeleted = rawProducts.filter((p: any) => p.isDeleted !== true);

  // Filter valid image URLs (/^https?:\/\/.+/i or valid local path)
  let matchingProducts = nonDeleted.filter((p: any) => {
    const img = p.image || p.imageUrl || (Array.isArray(p.images) && p.images[0]) || '';
    return isValidImageUrl(img);
  });

  // Safety fallback: if strict image filter leaves 0 products, use all non-deleted products
  if (matchingProducts.length === 0 && nonDeleted.length > 0) {
    matchingProducts = nonDeleted;
  }

  // 2. Aggregate price stats (minPrice, maxPrice)
  let minPrice = Infinity;
  let maxPrice = -Infinity;

  matchingProducts.forEach((p: any) => {
    const val = Number(p.sellPrice || p.price || 0);
    if (val > 0) {
      if (val < minPrice) minPrice = val;
      if (val > maxPrice) maxPrice = val;
    }
  });

  const finalMinPrice = minPrice !== Infinity ? Math.floor(minPrice) : 0;
  const finalMaxPrice = maxPrice !== -Infinity ? Math.ceil(maxPrice) : 40000;

  // 3. Two-stage MongoDB Aggregation Equivalent (Category -> Subcategories)
  const catMap = new Map<string, {
    name: string;
    image: string;
    totalCount: number;
    subcats: Map<string, { name: string; image: string; count: number }>;
  }>();

  // Aggregate directly from matching products (Single Source of Truth)
  matchingProducts.forEach((p: any) => {
    const catName = getProductCategory(p);
    if (!catName) return;

    const subName = getProductSubcategory(p);
    const img = p.image || p.imageUrl || (Array.isArray(p.images) && p.images[0]) || '';

    if (!catMap.has(catName)) {
      catMap.set(catName, {
        name: catName,
        image: img,
        totalCount: 0,
        subcats: new Map(),
      });
    }

    const catObj = catMap.get(catName)!;
    catObj.totalCount += 1;
    if (!catObj.image && img) {
      catObj.image = img;
    }

    if (subName) {
      if (!catObj.subcats.has(subName)) {
        catObj.subcats.set(subName, {
          name: subName,
          image: img,
          count: 0,
        });
      }
      const subObj = catObj.subcats.get(subName)!;
      subObj.count += 1;
      if (!subObj.image && img) {
        subObj.image = img;
      }
    }
  });

  // Blend any categories/subcategories from synced dbCategories store
  if (Array.isArray(dbCategories) && dbCategories.length > 0) {
    dbCategories.forEach((c: any) => {
      const cName = extractStr(c.name || c.categoryName).toUpperCase();
      if (!cName) return;

      const cImg = c.image || c.imageUrl || c.categoryImage || '';
      if (!catMap.has(cName)) {
        catMap.set(cName, {
          name: cName,
          image: cImg,
          totalCount: Number(c.totalCount || c.count || 0),
          subcats: new Map(),
        });
      }

      const catObj = catMap.get(cName)!;
      if (!catObj.image && cImg) catObj.image = cImg;

      if (Array.isArray(c.subcategories)) {
        c.subcategories.forEach((s: any) => {
          const sName = extractStr(typeof s === 'string' ? s : s.name || s.subcategoryName).toUpperCase();
          if (sName && !catObj.subcats.has(sName)) {
            const sImg = (typeof s === 'object' ? s.image || s.imageUrl : '') || '';
            const sCount = typeof s === 'object' ? Number(s.count || 0) : 0;
            catObj.subcats.set(sName, {
              name: sName,
              image: sImg,
              count: sCount,
            });
          }
        });
      }
    });
  }

  // 4. Process Wishlist Priority Maps
  const wishlistedCatMap = new Map<string, number>();
  (wishlist?.categories || []).forEach((c: any, idx: number) => {
    if (c.name) wishlistedCatMap.set(String(c.name).toUpperCase(), c.order ?? idx);
  });

  const wishlistedSubMap = new Map<string, number>();
  (wishlist?.subcategories || []).forEach((s: any, idx: number) => {
    if (s.category && s.name) {
      wishlistedSubMap.set(`${String(s.category).toUpperCase()}>${String(s.name).toUpperCase()}`, s.order ?? idx);
    }
  });

  // 5. Format & Sort Subcategories & Categories (matching backend sort logic)
  const formattedCategories: CategoryFilter[] = Array.from(catMap.values()).map((catObj) => {
    const sortedSubcategories = Array.from(catObj.subcats.values())
      .filter((s) => s.name);

    // Sort subcategories: Wishlisted FIRST (by order), then A-Z
    sortedSubcategories.sort((a, b) => {
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
      subcategories: sortedSubcategories,
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
    priceRange: {
      min: finalMinPrice,
      max: finalMaxPrice,
    },
  };
}

// ─── 2. /gallery Page Offline Function ──────────────────────────────────────

/**
 * Specialized Offline Function for /gallery Page
 * 
 * Provides fast layout-optimized catalogue listing for the gallery view with category & subcategory scope.
 */
export async function getOfflineGalleryProducts(
  options: OfflinePageOptions = {}
): Promise<CatalogueProductsResponse> {
  const result = await getOfflineCatalogueProducts({
    sort: 'view',
    ...options,
  });

  return result;
}

// ─── 3. /view Page Offline Function ─────────────────────────────────────────

/**
 * Specialized Offline Function for /view Page (Fullscreen Product Viewer)
 * 
 * Prioritizes the target product (productId) at index 0, followed sequentially by matching subcategory
 * and matching category items, ensuring fluid fullscreen navigation offline.
 */
export async function getOfflineViewProducts(
  options: OfflinePageOptions = {}
): Promise<CatalogueProductsResponse> {
  const result = await getOfflineCatalogueProducts({
    sort: 'view',
    limit: options.limit || 5000,
    ...options,
  });

  // If a specific target product was requested, ensure it sits at index 0
  const targetIdStr = options.productId || options.search;
  if (targetIdStr && result.data.length > 0) {
    const cleanTarget = String(targetIdStr).trim().toLowerCase();
    const targetIdx = result.data.findIndex(
      (p) =>
        p.id.toLowerCase() === cleanTarget ||
        p.productId.toLowerCase() === cleanTarget ||
        p.name.toLowerCase().includes(cleanTarget)
    );

    if (targetIdx > 0) {
      const targetItem = result.data[targetIdx];
      const targetSub = targetItem.subcategories.toLowerCase();
      const targetCat = targetItem.categories.toLowerCase();

      const subMatches: CatalogueProduct[] = [];
      const catMatches: CatalogueProduct[] = [];
      const others: CatalogueProduct[] = [];

      result.data.forEach((p, idx) => {
        if (idx === targetIdx) return;
        const pSub = p.subcategories.toLowerCase();
        const pCat = p.categories.toLowerCase();

        if (targetSub && pSub === targetSub) subMatches.push(p);
        else if (targetCat && pCat === targetCat) catMatches.push(p);
        else others.push(p);
      });

      result.data = [targetItem, ...subMatches, ...catMatches, ...others];
    }
  }

  return result;
}
