/**
 * Client-Side Offline Search Engine
 * Performs fast search, filtering, and priority sorting on locally stored IndexedDB catalog data.
 */

import { offlineDB } from './indexed-db';

export interface ProductItem {
  id: string;
  productId?: string;
  name: string;
  code?: string;
  description?: string;
  price?: number;
  categoryId?: string;
  subcategoryId?: string;
  categoryName?: string;
  subcategoryName?: string;
  imageUrl?: string;
  images?: string[];
  [key: string]: unknown;
}

export interface OfflineSearchResult {
  products: ProductItem[];
  total: number;
  source: 'indexeddb';
}

export async function searchOfflineProducts(query = '', categoryId?: string, subcategoryId?: string): Promise<OfflineSearchResult> {
  const allProducts = await offlineDB.getAll<ProductItem>('products');

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = allProducts.filter((product) => {
    // Category Filter
    if (categoryId && product.categoryId !== categoryId && product.categoryName !== categoryId) {
      return false;
    }
    // Subcategory Filter
    if (subcategoryId && product.subcategoryId !== subcategoryId && product.subcategoryName !== subcategoryId) {
      return false;
    }
    // Text Search
    if (!normalizedQuery) return true;

    const nameMatch = product.name?.toLowerCase().includes(normalizedQuery);
    const codeMatch = product.code?.toLowerCase().includes(normalizedQuery);
    const descMatch = product.description?.toLowerCase().includes(normalizedQuery);
    const catMatch = product.categoryName?.toLowerCase().includes(normalizedQuery);
    const subMatch = product.subcategoryName?.toLowerCase().includes(normalizedQuery);

    return Boolean(nameMatch || codeMatch || descMatch || catMatch || subMatch);
  });

  return {
    products: filtered,
    total: filtered.length,
    source: 'indexeddb',
  };
}
