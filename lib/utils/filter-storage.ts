import { FilterState } from '../types';

const STORAGE_KEY = 'magnum_catalogue_filters';

export const DEFAULT_FILTERS: FilterState = {
  searchQuery: '',
  categories: [],
  subcategories: [],
  priceRange: [0, 40000],
  sortBy: 'newest',
  timeFilter: 'all',
  gridSize: 4,
};

/**
 * Save current gallery filters to sessionStorage
 */
export function saveGalleryFilters(filters: FilterState): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch (err) {
    console.error('Failed to save filters to sessionStorage:', err);
  }
}

/**
 * Load saved gallery filters from sessionStorage
 */
export function loadGalleryFilters(): FilterState {
  if (typeof window === 'undefined') return DEFAULT_FILTERS;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_FILTERS,
        ...parsed,
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        subcategories: Array.isArray(parsed.subcategories) ? parsed.subcategories : [],
        priceRange: Array.isArray(parsed.priceRange) && parsed.priceRange.length === 2 ? parsed.priceRange : DEFAULT_FILTERS.priceRange,
        timeFilter: parsed.timeFilter || 'all',
      };
    }
  } catch (err) {
    console.error('Failed to load filters from sessionStorage:', err);
  }
  return DEFAULT_FILTERS;
}

/**
 * Clear stored filters from sessionStorage
 */
export function clearGalleryFilters(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear filters from sessionStorage:', err);
  }
}

/**
 * Build URL search parameters string from FilterState
 */
export function buildFilterQueryParams(filters: Partial<FilterState>, productId?: string): string {
  const params = new URLSearchParams();

  if (productId) {
    params.set('productId', productId);
  }
  if (filters.searchQuery) {
    params.set('search', filters.searchQuery);
  }
  if (filters.categories && filters.categories.length > 0) {
    params.set('category', filters.categories.join(','));
  }
  if (filters.subcategories && filters.subcategories.length > 0) {
    params.set('subcategory', filters.subcategories.join(','));
  }
  if (filters.sortBy && filters.sortBy !== 'newest') {
    params.set('sortBy', filters.sortBy);
  }
  if (filters.timeFilter && filters.timeFilter !== 'all') {
    params.set('timeFilter', filters.timeFilter);
  }
  if (filters.priceRange) {
    if (filters.priceRange[0] > 0) params.set('minPrice', String(filters.priceRange[0]));
    if (filters.priceRange[1] < 40000) params.set('maxPrice', String(filters.priceRange[1]));
  }

  const str = params.toString();
  return str ? `?${str}` : '';
}

/**
 * Parse FilterState from URLSearchParams object
 */
export function parseFiltersFromSearchParams(searchParams: URLSearchParams): Partial<FilterState> {
  const result: Partial<FilterState> = {};

  const search = searchParams.get('search') || searchParams.get('searchQuery');
  if (search) result.searchQuery = search;

  const category = searchParams.get('category');
  if (category) {
    result.categories = category.split(',').map(c => c.trim()).filter(Boolean);
  }

  const subcategory = searchParams.get('subcategory');
  if (subcategory) {
    result.subcategories = subcategory.split(',').map(s => s.trim()).filter(Boolean);
  }

  const sortBy = searchParams.get('sortBy') || searchParams.get('sort');
  if (sortBy) {
    result.sortBy = sortBy as any;
  }

  const timeFilter = searchParams.get('timeFilter') || searchParams.get('timeRange') || searchParams.get('updatedWithin');
  if (timeFilter) {
    result.timeFilter = timeFilter as any;
  }

  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');
  if (minPrice || maxPrice) {
    result.priceRange = [
      minPrice ? parseInt(minPrice) || 0 : 0,
      maxPrice ? parseInt(maxPrice) || 40000 : 40000,
    ];
  }

  return result;
}
