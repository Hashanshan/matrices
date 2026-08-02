/**
 * Enhanced Client-Side Offline Search & Filter Engine
 *
 * Performs fast, prioritized, paginated search and filtering on locally stored
 * IndexedDB catalog data. Maintains an in-memory product index for instant subsequent queries.
 *
 * Features:
 * - Exact match prioritization (productId, code)
 * - Alphanumeric fuzzy match (MTX-11646 == MTX11646)
 * - Category + subcategory filtering
 * - Pagination support
 * - Sort options (price, name, newest)
 * - In-memory index (rebuilt once per session or after sync)
 */

import { offlineDB } from './indexed-db';

export interface ProductItem {
  id: string;
  productId?: string;
  name: string;
  code?: string;
  description?: string;
  price?: number;
  sellPrice?: number;
  categoryId?: string;
  subcategoryId?: string;
  categoryName?: string;
  categories?: string;
  subcategoryName?: string;
  subcategories?: string;
  image?: string;
  imageUrl?: string;
  images?: string[];
  [key: string]: unknown;
}

export interface OfflineSearchOptions {
  query?: string;
  categoryId?: string;
  subcategoryId?: string;
  categoryName?: string;
  subcategoryName?: string;
  sort?: 'name' | 'price_asc' | 'price_desc' | 'newest' | 'default';
  page?: number;
  limit?: number;
}

export interface OfflineSearchResult {
  products: ProductItem[];
  total: number;
  page: number;
  totalPages: number;
  exactMatchFound?: boolean;
  source: 'indexeddb';
}

// ── In-memory product index ───────────────────────────────────────────────────

let productIndex: ProductItem[] | null = null;
let productIndexLoading = false;
let productIndexCallbacks: Array<() => void> = [];

/** Load all products into memory (called once, reused for all searches) */
async function getProductIndex(): Promise<ProductItem[]> {
  if (productIndex) return productIndex;

  if (productIndexLoading) {
    return new Promise((resolve) => {
      productIndexCallbacks.push(() => resolve(productIndex!));
    });
  }

  productIndexLoading = true;
  try {
    productIndex = await offlineDB.getAll<ProductItem>('products').catch(() => []);
  } catch {
    productIndex = [];
  } finally {
    productIndexLoading = false;
    productIndexCallbacks.forEach((cb) => cb());
    productIndexCallbacks = [];
  }

  return productIndex;
}

/** Invalidate the product index (call after sync or local mutations) */
export function invalidateProductIndex(): void {
  productIndex = null;
}

/** Pre-warm the in-memory index — call after sync completes */
export async function prewarmProductIndex(): Promise<void> {
  await getProductIndex();
}

// ── Search engine ─────────────────────────────────────────────────────────────

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Score a product against a search query.
 * Higher score = better match. Returns -1 if no match.
 */
function scoreProduct(product: ProductItem, query: string, queryClean: string): number {
  if (!query) return 0; // No query = include all, equal score

  const pId = (product.productId || product.id || '').toLowerCase();
  const pCode = (product.code || '').toLowerCase();
  const pName = (product.name || '').toLowerCase();
  const pDesc = (product.description || '').toLowerCase();

  const pIdClean = normalizeStr(pId);
  const pCodeClean = normalizeStr(pCode);
  const pNameClean = normalizeStr(pName);

  // Tier 1: Exact match on productId or code (highest priority)
  if (pId === query || pCode === query) return 100;

  // Tier 2: Exact alphanumeric match (MTX-11646 == MTX11646)
  if (queryClean && (pIdClean === queryClean || pCodeClean === queryClean)) return 90;

  // Tier 3: Starts-with on productId or code
  if (pId.startsWith(query) || pCode.startsWith(query)) return 80;
  if (queryClean && (pIdClean.startsWith(queryClean) || pCodeClean.startsWith(queryClean))) return 75;

  // Tier 4: Exact name match
  if (pName === query) return 70;

  // Tier 5: Name starts-with
  if (pName.startsWith(query)) return 60;

  // Tier 6: Contains match on id/code/name
  if (pId.includes(query) || pCode.includes(query)) return 50;
  if (pIdClean.includes(queryClean) || pCodeClean.includes(queryClean)) return 45;
  if (pName.includes(query) || pNameClean.includes(queryClean)) return 40;

  // Tier 7: Description match (lowest priority)
  if (pDesc.includes(query)) return 10;

  return -1; // No match
}

/**
 * Main offline search function — fast in-memory search with scoring and pagination.
 */
export async function searchOfflineProducts(
  queryOrOptions: string | OfflineSearchOptions = '',
  legacyCategoryId?: string,
  legacySubcategoryId?: string
): Promise<OfflineSearchResult> {
  // Support both legacy (query, catId, subId) and new options object API
  let opts: OfflineSearchOptions;
  if (typeof queryOrOptions === 'string') {
    opts = {
      query: queryOrOptions,
      categoryId: legacyCategoryId,
      subcategoryId: legacySubcategoryId,
    };
  } else {
    opts = queryOrOptions;
  }

  const {
    query = '',
    categoryId,
    subcategoryId,
    categoryName,
    subcategoryName,
    sort = 'default',
    page = 1,
    limit = 20,
  } = opts;

  const allProducts = await getProductIndex();
  const normalizedQuery = query.trim().toLowerCase();
  const queryClean = normalizeStr(normalizedQuery);

  // ── Filter & Search Scoring ──────────────────────────────────────────────────

  let exactMatchFound = false;
  const searchSubCategories = new Set<string>();
  const searchCategories = new Set<string>();

  if (normalizedQuery) {
    for (const product of allProducts) {
      const pId = (product.productId || product.id || '').toLowerCase();
      const pCode = (product.code || '').toLowerCase();
      const pName = (product.name || '').toLowerCase();
      const pIdClean = normalizeStr(pId);
      const pCodeClean = normalizeStr(pCode);

      const isDirectMatch =
        pId === normalizedQuery ||
        pCode === normalizedQuery ||
        (queryClean && (pIdClean === queryClean || pCodeClean === queryClean)) ||
        pName.includes(normalizedQuery);

      if (isDirectMatch) {
        exactMatchFound = true;
        const pSub = (product.subcategoryName || product.subcategories || '').toLowerCase().trim();
        const pCat = (product.categoryName || product.categories || '').toLowerCase().trim();
        if (pSub) searchSubCategories.add(pSub);
        if (pCat) searchCategories.add(pCat);
      }
    }
  }

  const scored: Array<{ product: ProductItem; score: number }> = [];

  for (const product of allProducts) {
    // Category filter
    if (categoryName || categoryId) {
      const pCat = (
        product.categoryName ||
        product.categories ||
        ''
      ).toLowerCase().trim();
      const pCatId = (product.categoryId || '').toLowerCase();

      if (categoryName && !pCat.includes(categoryName.toLowerCase())) continue;
      if (categoryId && !pCat.includes(categoryId.toLowerCase()) && pCatId !== categoryId.toLowerCase()) continue;
    }

    // Subcategory filter
    if (subcategoryName || subcategoryId) {
      const pSub = (
        product.subcategoryName ||
        product.subcategories ||
        ''
      ).toLowerCase().trim();
      const pSubId = (product.subcategoryId || '').toLowerCase();

      if (subcategoryName && !pSub.includes(subcategoryName.toLowerCase())) continue;
      if (subcategoryId && !pSub.includes(subcategoryId.toLowerCase()) && pSubId !== subcategoryId.toLowerCase()) continue;
    }

    // Search score
    let score = normalizedQuery ? scoreProduct(product, normalizedQuery, queryClean) : 0;
    if (normalizedQuery) {
      const pSub = (product.subcategoryName || product.subcategories || '').toLowerCase().trim();
      const pCat = (product.categoryName || product.categories || '').toLowerCase().trim();
      if (score < 0) {
        if (pSub && searchSubCategories.has(pSub)) score = 4;
        else if (pCat && searchCategories.has(pCat)) score = 3;
        else continue;
      }
    }

    scored.push({ product, score });
  }

  // ── Sort ─────────────────────────────────────────────────────────────────────

  scored.sort((a, b) => {
    // Always put higher search scores first
    if (normalizedQuery && a.score !== b.score) return b.score - a.score;

    switch (sort) {
      case 'price_asc':
        return ((a.product.sellPrice || a.product.price || 0) - (b.product.sellPrice || b.product.price || 0));
      case 'price_desc':
        return ((b.product.sellPrice || b.product.price || 0) - (a.product.sellPrice || a.product.price || 0));
      case 'name':
        return (a.product.name || '').localeCompare(b.product.name || '');
      default:
        return 0;
    }
  });

  const total = scored.length;
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
  const startIdx = (page - 1) * limit;
  const pageProducts = scored.slice(startIdx, startIdx + limit).map((s) => s.product);

  return {
    products: pageProducts,
    total,
    page,
    totalPages,
    exactMatchFound: normalizedQuery ? exactMatchFound : undefined,
    source: 'indexeddb',
  };
}

/**
 * Get all unique categories with subcategory counts from the offline product index.
 */
export async function getOfflineCatalogSummary(): Promise<{
  categories: Array<{
    name: string;
    image: string;
    count: number;
    subcategories: Array<{ name: string; image: string; count: number }>;
  }>;
}> {
  const allProducts = await getProductIndex();

  const catMap = new Map<string, {
    image: string;
    count: number;
    subcats: Map<string, { image: string; count: number }>;
  }>();

  for (const p of allProducts) {
    const catName = (p.categoryName || p.categories || 'Uncategorized').trim();
    const subName = (p.subcategoryName || p.subcategories || '').trim();
    const img = p.image || p.imageUrl || '';

    if (!catMap.has(catName)) {
      catMap.set(catName, { image: img, count: 0, subcats: new Map() });
    }
    const cat = catMap.get(catName)!;
    cat.count++;
    if (!cat.image && img) cat.image = img;

    if (subName) {
      if (!cat.subcats.has(subName)) {
        cat.subcats.set(subName, { image: img, count: 0 });
      }
      const sub = cat.subcats.get(subName)!;
      sub.count++;
      if (!sub.image && img) sub.image = img;
    }
  }

  const categories = Array.from(catMap.entries()).map(([name, val]) => ({
    name,
    image: val.image,
    count: val.count,
    subcategories: Array.from(val.subcats.entries()).map(([subName, subVal]) => ({
      name: subName,
      image: subVal.image,
      count: subVal.count,
    })),
  }));

  return { categories };
}
