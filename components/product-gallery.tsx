'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Product, FilterState } from '@/lib/types';
import { useProducts, useFilters, getOfflineProducts } from '@/lib/hooks/use-products';
import ProductCard from './product-card';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, Check, PanelLeftClose, PanelLeftOpen, Filter, SortDesc, LayoutGrid, Loader2, Search, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/currency';
import CustomSelect from './custom-select';
import RelatedProducts from './related-products';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { useWishlist } from '@/lib/contexts/wishlist-context';
import { useSearchParams } from 'next/navigation';
import { saveGalleryFilters, loadGalleryFilters, clearGalleryFilters, DEFAULT_FILTERS } from '@/lib/utils/filter-storage';
import { useBackHandler } from '@/lib/utils/back-navigation';
import { offlineDB } from '@/lib/offline/indexed-db';
import { resolveApiUrl, getAuthToken } from '@/lib/utils';
import { useDataMode } from '@/lib/contexts/data-mode-context';

const MySwal = withReactContent(Swal);

function CategorySection({
  category,
  categoryProducts,
  categoryIndex,
  isCollapsed,
  toggleSection,
  accurateCount,
  gridClass,
  columnsCount = 4,
  timeFilter,
  onGlobalLoadMore,
}: {
  category: string;
  categoryProducts: any[];
  categoryIndex: number;
  isCollapsed: boolean;
  toggleSection: (cat: string) => void;
  accurateCount: number;
  gridClass: string;
  columnsCount?: number;
  timeFilter?: string;
  onGlobalLoadMore?: () => void;
}) {
  // Initial size is 2 full rows (4 cols -> 8, 3 cols -> 6, 2 cols -> 4)
  // Step size is 1 full row (4 cols -> 4, 3 cols -> 3, 2 cols -> 2)
  // Resulting counts for 4 columns: 8, 12, 16, 20, 24, 28, 32...
  // Resulting counts for 3 columns: 6, 9, 12, 15, 18, 21, 24...
  // Resulting counts for 2 columns: 4, 6, 8, 10, 12, 14, 16...
  const initialSize = columnsCount * 2;
  const stepSize = columnsCount;
  const [visibleCount, setVisibleCount] = useState(initialSize);
  const [extraCategoryProducts, setExtraCategoryProducts] = useState<any[]>([]);
  const [isLoadingCategoryMore, setIsLoadingCategoryMore] = useState(false);
  const { dataMode } = useDataMode();

  // When column count changes, adjust visibleCount to the nearest full row multiple
  useEffect(() => {
    setVisibleCount(prev => {
      const rows = Math.max(2, Math.ceil(prev / columnsCount));
      return rows * columnsCount;
    });
  }, [columnsCount]);

  // Combine parent products with any specifically loaded category products (deduplicated by product id/code)
  const combinedProducts = useMemo(() => {
    const map = new Map<string, any>();
    (categoryProducts || []).forEach(p => {
      const key = String(p.productId || p.id || '').trim().toLowerCase();
      if (key) map.set(key, p);
    });
    (extraCategoryProducts || []).forEach(p => {
      const key = String(p.productId || p.id || '').trim().toLowerCase();
      if (key && !map.has(key)) map.set(key, p);
    });
    return Array.from(map.values());
  }, [categoryProducts, extraCategoryProducts]);

  const targetTotalCount = Math.max(accurateCount, combinedProducts.length);

  // Actual list of products currently visible
  const visibleProducts = useMemo(() => {
    return combinedProducts.slice(0, visibleCount);
  }, [combinedProducts, visibleCount]);

  const currentShowingCount = Math.min(visibleProducts.length, targetTotalCount);

  // If showing count is less than top count -> hasMore is true
  const hasMore = currentShowingCount < targetTotalCount;

  const fetchCategoryProducts = useCallback(async (neededTarget?: number) => {
    if (isLoadingCategoryMore) return;
    setIsLoadingCategoryMore(true);
    try {
      const isOffline = dataMode === 'offline' || (typeof navigator !== 'undefined' && !navigator.onLine);
      if (isOffline) {
        const fetchLimit = Math.max(neededTarget || 50, 100);
        const offlineRes = await getOfflineProducts({
          category,
          timeFilter,
          limit: fetchLimit,
        });
        if (offlineRes.data && offlineRes.data.length > 0) {
          setExtraCategoryProducts(prev => {
            const existingIds = new Set(prev.map(p => String(p.productId || p.id)));
            const newUnique = offlineRes.data.filter((p: any) => !existingIds.has(String(p.productId || p.id)));
            return [...prev, ...newUnique];
          });
        }
      } else {
        // Fetch from Online API endpoint with limit matching needed batch
        const token = getAuthToken();
        const timeParam = timeFilter && timeFilter !== 'all' && timeFilter !== 'null' ? `&timeFilter=${encodeURIComponent(timeFilter)}` : '';
        const fetchLimit = Math.max(neededTarget || 50, 50);
        const targetUrl = resolveApiUrl(`/api/products?category=${encodeURIComponent(category)}${timeParam}&limit=${fetchLimit}&page=1`);
        const res = await fetch(targetUrl, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
        });
        if (res.ok) {
          const data = await res.json();
          const items = data.data || data.products || [];
          if (items.length > 0) {
            setExtraCategoryProducts(prev => {
              const existingIds = new Set(prev.map(p => String(p.productId || p.id)));
              const newUnique = items.filter((p: any) => !existingIds.has(String(p.productId || p.id)));
              return [...prev, ...newUnique];
            });
          }
        }
      }
    } catch (err) {
      console.error(`Failed to load products for category ${category}:`, err);
    } finally {
      setIsLoadingCategoryMore(false);
    }
  }, [category, dataMode, timeFilter, isLoadingCategoryMore]);

  // Auto-fetch if we have fewer products in memory than visibleCount
  useEffect(() => {
    if (combinedProducts.length < visibleCount && combinedProducts.length < targetTotalCount && !isLoadingCategoryMore) {
      fetchCategoryProducts(visibleCount);
    }
  }, [category, visibleCount, combinedProducts.length, targetTotalCount, isLoadingCategoryMore, fetchCategoryProducts]);

  // Handle manual "Load More" button click (and auto-scroll)
  const handleLoadMore = useCallback(async () => {
    if (isLoadingCategoryMore) return;
    const nextTarget = visibleCount + stepSize;
    setVisibleCount(nextTarget);

    if (combinedProducts.length < nextTarget && combinedProducts.length < targetTotalCount) {
      await fetchCategoryProducts(nextTarget);
    }

    // Also trigger parent global hook to advance cursor if available
    if (onGlobalLoadMore) {
      onGlobalLoadMore();
    }
  }, [isLoadingCategoryMore, visibleCount, stepSize, combinedProducts.length, targetTotalCount, fetchCategoryProducts, onGlobalLoadMore]);

  // Automatic infinite scroll when scrolling within this category section
  const categorySentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!categorySentinelRef.current || isCollapsed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingCategoryMore) {
          handleLoadMore();
        }
      },
      { rootMargin: '350px 0px', threshold: 0.05 }
    );
    observer.observe(categorySentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingCategoryMore, isCollapsed, handleLoadMore]);

  return (
    <motion.section
      key={category}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="bg-white/40 backdrop-blur-xl rounded-[1.5rem] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] border border-white/60 flex items-center justify-between p-6 mb-8 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => toggleSection(category)}
      >
        <div className="flex items-center gap-4">
          <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.2 }} className="bg-gray-100 p-2 rounded-full text-gray-500">
            <ChevronDown size={20} />
          </motion.div>
          <h2 className="text-2xl font-black text-[#0f172a] tracking-wide uppercase">{category}</h2>
        </div>
        <span className="text-sm font-bold text-gray-500 bg-gray-50 px-4 py-2 rounded-full">
          {targetTotalCount} {targetTotalCount === 1 ? 'Product' : 'Products'}
        </span>
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden backdrop-blur-[2px] p-2"
          >
            <div className="pb-8">
              <motion.div layout className={`grid gap-6 sm:gap-8 ${gridClass}`} style={{ gridAutoRows: 'max-content' }}>
                {visibleProducts.map((product, index) => (
                  <ProductCard key={product.id || `${product.productId}-${index}`} product={product} index={index} />
                ))}
              </motion.div>

              {/* Automatic scroll trigger sentinel */}
              {hasMore && <div ref={categorySentinelRef} className="h-6 w-full pointer-events-none" />}

              {/* Load More Button Fallback (Always visible as fallback when more products exist) */}
              {hasMore && (
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleLoadMore}
                    disabled={isLoadingCategoryMore}
                    className="w-full sm:w-auto px-8 py-4 bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 border border-slate-700"
                  >
                    {isLoadingCategoryMore ? (
                      <>
                        <Loader2 size={18} className="animate-spin text-white" />
                        <span>Loading {category} Products...</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown size={18} />
                        <span>Load More {category} ({currentShowingCount} of {targetTotalCount})</span>
                      </>
                    )}
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

interface ProductGalleryProps {
  searchQuery: string;
  initialCategory?: string;
  initialSubcategory?: string;
  onFilterChange?: (filters: FilterState) => void;
}

export default function ProductGallery({ searchQuery, initialCategory, initialSubcategory, onFilterChange }: ProductGalleryProps) {
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FilterState>(() => {
    const saved = loadGalleryFilters();
    const urlCategory = searchParams.get('category') || initialCategory;
    const urlSubcategory = searchParams.get('subcategory') || initialSubcategory;
    const urlSort = searchParams.get('sortBy') || searchParams.get('sort');
    const urlSearch = searchParams.get('search') || searchQuery;
    const urlMinPrice = searchParams.get('minPrice');
    const urlMaxPrice = searchParams.get('maxPrice');
    const urlTime = searchParams.get('timeFilter') || searchParams.get('timeRange') || searchParams.get('updatedWithin');

    return {
      searchQuery: urlSearch || saved.searchQuery || '',
      categories: urlCategory ? [urlCategory] : [],
      subcategories: urlSubcategory ? [urlSubcategory] : [],
      priceRange: urlMinPrice || urlMaxPrice
        ? [urlMinPrice ? parseInt(urlMinPrice) || 0 : 0, urlMaxPrice ? parseInt(urlMaxPrice) || 40000 : 40000]
        : (saved.priceRange || [0, 40000]),
      sortBy: (urlSort as any) || saved.sortBy || 'newest',
      timeFilter: (urlTime as any) || saved.timeFilter || 'all',
      gridSize: saved.gridSize || 4,
    };
  });

  const { categories: apiCategories, priceRange: apiPriceRange, mutate: mutateFilters } = useFilters({
    timeFilter: filters.timeFilter,
  });

  // Persist filters to sessionStorage whenever state changes
  useEffect(() => {
    saveGalleryFilters(filters);
    if (onFilterChange) onFilterChange(filters);
  }, [filters, onFilterChange]);

  // Sync price range once api data loads if it's default
  useEffect(() => {
    if (apiPriceRange.max > 0) {
      setFilters(prev => {
        if (prev.priceRange[1] === 40000 && (prev.priceRange[0] !== apiPriceRange.min || prev.priceRange[1] !== apiPriceRange.max)) {
          return { ...prev, priceRange: [apiPriceRange.min, apiPriceRange.max] };
        }
        return prev;
      });
    }
  }, [apiPriceRange.min, apiPriceRange.max]);

  const minP = apiPriceRange.min || 0;
  const maxP = apiPriceRange.max > 0 ? apiPriceRange.max : 40000;

  const hasActiveFilters = Boolean(
    filters.categories.length > 0 ||
    filters.subcategories.length > 0 ||
    (filters.searchQuery && filters.searchQuery.trim() !== '') ||
    (filters.sortBy && filters.sortBy !== 'newest') ||
    (filters.timeFilter && filters.timeFilter !== 'all') ||
    filters.priceRange[0] > minP ||
    (filters.priceRange[1] < maxP && maxP > 0 && filters.priceRange[1] !== maxP)
  );

  // Smooth scroll to top whenever filter selection changes
  const isInitialFilterMount = useRef(true);
  useEffect(() => {
    if (isInitialFilterMount.current) {
      isInitialFilterMount.current = false;
      return;
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [
    filters.categories,
    filters.subcategories,
    filters.sortBy,
    filters.timeFilter,
    filters.searchQuery,
    filters.priceRange,
  ]);

  const handleClearFilters = () => {
    clearGalleryFilters();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    const defaultMinP = apiPriceRange.min || 0;
    const defaultMaxP = apiPriceRange.max > 0 ? apiPriceRange.max : 40000;
    setFilters({
      ...DEFAULT_FILTERS,
      searchQuery: '',
      categories: [],
      subcategories: [],
      sortBy: 'newest',
      timeFilter: 'all',
      priceRange: [defaultMinP, defaultMaxP],
    });
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileOptionsOpen, setMobileOptionsOpen] = useState(false);
  const [isMobileBarHidden, setIsMobileBarHidden] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Close sidebar or reset expanded categories on back press
  useBackHandler(() => {
    if (sidebarOpen) {
      setSidebarOpen(false);
      return true;
    }
    if (mobileOptionsOpen) {
      setMobileOptionsOpen(false);
      return true;
    }
    if (expandedCategories.length > 0) {
      setExpandedCategories([]);
      return true;
    }
    return false;
  }, sidebarOpen || mobileOptionsOpen || expandedCategories.length > 0);

  // Map frontend sortBy to backend sort param
  const backendSort = filters.sortBy === 'price-low' ? 'price-low'
    : filters.sortBy === 'price-high' ? 'price-high'
      : undefined; // default = newest

  const actualGridSize = sidebarOpen && filters.gridSize === 4 ? 3 : (filters.gridSize || 4);

  const gridClass =
    actualGridSize === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : actualGridSize === 3
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  // Use SWR paginated hook — cached, instant on revisit, now fully backend-filtered
  const {
    products,
    isLoading,
    isLoadingMore,
    isValidating,
    hasMore,
    loadMore,
    error,
    totalCount,
    exactMatchFound,
  } = useProducts({
    sort: backendSort,
    timeFilter: filters.timeFilter,
    limit: Math.max(actualGridSize * 5, 20),
    category: filters.categories.length > 0 ? filters.categories : undefined,
    subcategory: filters.subcategories.length > 0 ? filters.subcategories : undefined,
    search: filters.searchQuery || searchQuery || undefined,
  });

  // Infinite scroll: observe a sentinel element at the bottom
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: '450px 0px', threshold: 0.05 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  const toggleSection = (cat: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  // Handle SweetAlert for no exact match
  // useEffect(() => {
  //   if (exactMatchFound === false && products.length > 0 && filters.searchQuery) {
  //     MySwal.fire({
  //       title: 'No exact match found',
  //       text: 'Do you want to continue to view related products?',
  //       icon: 'info',
  //       showCancelButton: true,
  //       confirmButtonText: 'Continue',
  //       confirmButtonColor: '#0f172a',
  //       cancelButtonColor: '#64748b'
  //     }).then((result) => {
  //       if (!result.isConfirmed) {
  //          setFilters(prev => ({ ...prev, searchQuery: '' }));
  //       }
  //     });
  //   }
  // }, [exactMatchFound, products.length, filters.searchQuery]);

  const { wishlist, isProductWishlisted, mutate: mutateWishlist } = useWishlist();

  // Automatically trigger background revalidation of both wishlist and filters on mount
  useEffect(() => {
    mutateWishlist().catch(() => {});
    mutateFilters().catch(() => {});
  }, [mutateWishlist, mutateFilters]);

  // Client-side filtering only handles price range now (others are backend-filtered)
  const filteredProducts = useMemo(() => {
    return products.filter((product: any) => {
      // Price range
      if (product.price < filters.priceRange[0] || product.price > filters.priceRange[1]) {
        return false;
      }
      return true;
    });
  }, [filters.priceRange, products]);

  // Use API filters for categories, prioritizing Wishlisted categories first (followed by A-Z)
  const CATEGORIES = useMemo(() => {
    const wishlistedMap = new Map<string, number>();
    (wishlist.categories || []).forEach((c, idx) => {
      const cName = typeof c === 'string' ? c : (c as any)?.name || (c as any)?.categoryName || '';
      if (cName) wishlistedMap.set(cName.trim().replace(/\s+/g, ' ').toUpperCase(), (c as any)?.order ?? idx);
    });

    // Deduplicate apiCategories by normalized uppercase name
    const uniqueCatNames = Array.from(new Set(
      apiCategories
        .map(c => (c.name || '').trim().replace(/\s+/g, ' ').toUpperCase())
        .filter(Boolean)
    ));

    uniqueCatNames.sort((a, b) => {
      const aWish = wishlistedMap.has(a);
      const bWish = wishlistedMap.has(b);
      if (aWish && bWish) {
        return (wishlistedMap.get(a) ?? 0) - (wishlistedMap.get(b) ?? 0);
      }
      if (aWish) return -1;
      if (bWish) return 1;
      return a.localeCompare(b);
    });

    return ['All', ...uniqueCatNames];
  }, [apiCategories, wishlist.categories]);

  const getSubcategoriesForCategory = useCallback((category: string) => {
    const normCategory = category.trim().replace(/\s+/g, ' ').toUpperCase();
    const matchingCats = apiCategories.filter(c => (c.name || '').trim().replace(/\s+/g, ' ').toUpperCase() === normCategory);
    if (matchingCats.length === 0) return [];

    const wishlistedSubMap = new Map<string, number>();
    (wishlist.subcategories || [])
      .filter(s => {
        const sCat = typeof s === 'object' ? (s as any)?.category || (s as any)?.categoryName : '';
        return sCat && String(sCat).trim().replace(/\s+/g, ' ').toUpperCase() === normCategory;
      })
      .forEach((s, idx) => {
        const sName = typeof s === 'string' ? s : (s as any)?.name || (s as any)?.subcategoryName || '';
        if (sName) wishlistedSubMap.set(String(sName).trim().replace(/\s+/g, ' ').toUpperCase(), (s as any)?.order ?? idx);
      });

    // Deduplicate subcategories across all matching category records
    const subMap = new Map<string, any>();
    matchingCats.forEach(cat => {
      (cat.subcategories || []).forEach(s => {
        const sName = (s.name || '').trim().replace(/\s+/g, ' ').toUpperCase();
        if (!sName) return;
        if (!subMap.has(sName)) {
          subMap.set(sName, { ...s, name: sName });
        } else {
          const existing = subMap.get(sName)!;
          existing.count = (existing.count || 0) + (s.count || 0);
          if (!existing.image && s.image) existing.image = s.image;
        }
      });
    });

    const subNames = Array.from(subMap.keys());
    return subNames.sort((a, b) => {
      const aWish = wishlistedSubMap.has(a);
      const bWish = wishlistedSubMap.has(b);
      if (aWish && bWish) {
        return (wishlistedSubMap.get(a) ?? 0) - (wishlistedSubMap.get(b) ?? 0);
      }
      if (aWish) return -1;
      if (bWish) return 1;
      return a.localeCompare(b);
    });
  }, [apiCategories, wishlist.subcategories]);

  // Group products by category, prioritizing wishlisted products FIRST within each category (O(N) linear time)
  const groupedProducts = useMemo(() => {
    const groups: { [category: string]: Product[] } = {};

    // 1. Single O(N) pass to group products by normalized category
    for (let i = 0; i < filteredProducts.length; i++) {
      const p = filteredProducts[i];
      const rawCat = (p.categories || (p as any).categoryName || (p as any).category || ((p as any).category && typeof (p as any).category === 'object' ? (p as any).category.name : '') || '').toString();
      const cat = rawCat.trim().replace(/\s+/g, ' ').toUpperCase() || 'UNCATEGORIZED';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    }

    // 2. Wishlist priority sorting per category bucket
    if (wishlist.products && wishlist.products.length > 0) {
      const wishlistedProdOrderMap = new Map<string, number>();
      wishlist.products.forEach((p, idx) => {
        wishlistedProdOrderMap.set(String(p.productId).trim(), p.order ?? idx);
      });

      Object.keys(groups).forEach(cat => {
        const prods = groups[cat];
        const wishArr: Product[] = [];
        const nonWishArr: Product[] = [];

        for (let i = 0; i < prods.length; i++) {
          const p = prods[i];
          const pId = String(p.productId || p.id || '').trim();
          if (wishlistedProdOrderMap.has(pId)) {
            wishArr.push(p);
          } else {
            nonWishArr.push(p);
          }
        }

        if (wishArr.length > 0) {
          wishArr.sort((a, b) => {
            const aId = String(a.productId || a.id || '').trim();
            const bId = String(b.productId || b.id || '').trim();
            return (wishlistedProdOrderMap.get(aId) ?? 0) - (wishlistedProdOrderMap.get(bId) ?? 0);
          });
        }

        groups[cat] = [...wishArr, ...nonWishArr];
      });
    }

    return groups;
  }, [filteredProducts, wishlist.products]);

  // Sort category entries so Wishlisted categories appear FIRST on /gallery page
  const sortedGroupedEntries = useMemo(() => {
    const wishlistedCatOrderMap = new Map<string, number>();
    (wishlist.categories || []).forEach((c, idx) => {
      const cName = typeof c === 'string' ? c : (c as any)?.name || (c as any)?.categoryName || '';
      if (cName) wishlistedCatOrderMap.set(cName.trim().replace(/\s+/g, ' ').toUpperCase(), (c as any)?.order ?? idx);
    });

    const entries = Object.entries(groupedProducts);

    return entries.sort(([catA], [catB]) => {
      const normA = catA.trim().replace(/\s+/g, ' ').toUpperCase();
      const normB = catB.trim().replace(/\s+/g, ' ').toUpperCase();
      const aWish = wishlistedCatOrderMap.has(normA);
      const bWish = wishlistedCatOrderMap.has(normB);

      if (aWish && bWish) {
        return (wishlistedCatOrderMap.get(normA) ?? 0) - (wishlistedCatOrderMap.get(normB) ?? 0);
      }
      if (aWish) return -1;
      if (bWish) return 1;

      return normA.localeCompare(normB);
    });
  }, [groupedProducts, wishlist.categories]);

  const handleCategoryToggle = (category: string) => {
    setFilters((prev) => {
      let newCategories;
      if (category === 'All') {
        newCategories = [];
      } else {
        newCategories = prev.categories.includes(category)
          ? prev.categories.filter((c) => c !== category)
          : [...prev.categories, category];
      }
      return {
        ...prev,
        categories: newCategories,
        subcategories: [],
      };
    });
  };

  const handleSubcategoryToggle = (subcategory: string) => {
    setFilters((prev) => ({
      ...prev,
      subcategories: prev.subcategories.includes(subcategory)
        ? prev.subcategories.filter((s) => s !== subcategory)
        : [...prev.subcategories, subcategory],
    }));
  };

  const handlePriceChange = (type: 'min' | 'max', value: number) => {
    setFilters((prev) => ({
      ...prev,
      priceRange:
        type === 'min' ? [value, prev.priceRange[1]] : [prev.priceRange[0], value],
    }));
  };

  // Show full spinner only on initial load with no cached data
  if (isLoading && products.length === 0) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="text-red-500 font-bold">{error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Subtle revalidation indicator */}
      {isValidating && products.length > 0 && (
        <div className="fixed top-4 right-4 z-50">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0f172a]/30"></div>
        </div>
      )}

      {/* Search Bar - Gallery Top */}
      <div className="relative mb-6">
        <div className="z-1 absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full rounded-[1rem] pl-12 pr-4 py-4 border border-white/60 rounded-2xl leading-5 bg-white/40 backdrop-blur-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f172a] sm:text-sm shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] transition-all placeholder:text-gray-500"
          placeholder="Search products in gallery..."
          value={filters.searchQuery}
          onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
        />
      </div>

      {/* Premium Controls Bar */}
      {isMobileBarHidden ? (
        <div className="lg:hidden sticky top-[72px] z-30 flex justify-end mb-4">
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsMobileBarHidden(false)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0f172a]/90 backdrop-blur-md text-white text-xs font-bold rounded-full shadow-lg border border-white/20"
          >
            <Filter size={14} />
            <span>Show Filters & Sort</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px]">{totalCount}</span>
          </motion.button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 lg:gap-4 bg-white/40 backdrop-blur-2xl rounded-2xl lg:rounded-[2rem] p-2.5 px-3.5 sm:p-3 sm:px-4 lg:p-4 lg:px-6 border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] sticky top-[72px] lg:top-[80px] z-30 transition-all duration-300 mb-4 lg:mb-6"
        >
          {/* Top Row on Mobile / Left Section on Desktop */}
          <div className="flex items-center justify-between w-full lg:w-auto gap-2">
            {/* Desktop Filter Toggle Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex items-center gap-3 px-6 py-3.5 bg-[#0f172a] text-white rounded-full font-bold text-sm hover:bg-[#1e293b] shadow-lg shadow-blue-900/10 transition-all border border-transparent hover:border-blue-800"
            >
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
              {sidebarOpen ? 'Hide Filters' : 'Show Filters'}
            </motion.button>

            {/* Mobile Category Filters Button */}
            <Button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden bg-[#0f172a] text-white hover:bg-[#1e293b] rounded-full py-2 px-3.5 font-bold text-xs shadow-md flex items-center gap-1.5 h-auto"
            >
              <Filter size={14} />
              <span>Filters</span>
              {filters.categories.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              )}
            </Button>

            {/* Mobile Quick Options (Sort, Time, Columns) Toggle */}
            <button
              type="button"
              onClick={() => setMobileOptionsOpen(!mobileOptionsOpen)}
              className={`lg:hidden flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-bold transition-all border ${
                mobileOptionsOpen || (filters.sortBy !== 'newest' || (filters.timeFilter && filters.timeFilter !== 'all'))
                  ? 'bg-[#0f172a] text-white border-[#0f172a] shadow-sm'
                  : 'bg-white/90 text-gray-800 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <SortDesc size={13} />
              <span>Sort & View</span>
              <ChevronDown
                size={13}
                className={`transition-transform duration-200 ${mobileOptionsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Mobile Item Count Badge */}
            <div className="lg:hidden text-xs text-gray-600 font-black px-3 py-1 bg-gray-100/90 rounded-full uppercase tracking-tight flex items-center gap-1">
              <span>{totalCount}</span> <span className="font-semibold text-gray-500">Items</span>
            </div>

            {/* Mobile Hide Bar Button */}
            <button
              type="button"
              onClick={() => setIsMobileBarHidden(true)}
              title="Hide sticky controls"
              className="lg:hidden p-1.5 text-gray-400 hover:text-gray-700 hover:bg-black/5 rounded-full transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Options Section: Collapsible on Mobile, always horizontal on Desktop (Laptop) */}
          <div
            className={`${
              mobileOptionsOpen ? 'flex' : 'hidden'
            } lg:flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto pt-2.5 lg:pt-0 border-t border-gray-200/60 lg:border-t-0`}
          >
            <div className="w-full sm:w-52">
              <CustomSelect
                value={filters.sortBy}
                onChange={(val) => setFilters((prev) => ({ ...prev, sortBy: val as any }))}
                icon={<SortDesc size={16} />}
                options={[
                  { label: 'Newest First', value: 'newest' },
                  { label: 'Price: Low to High', value: 'price-low' },
                  { label: 'Price: High to Low', value: 'price-high' },
                  { label: 'Highest Rated', value: 'rating' },
                ]}
              />
            </div>

            <div className="w-full sm:w-48">
              <CustomSelect
                value={filters.timeFilter || 'all'}
                onChange={(val) => setFilters((prev) => ({ ...prev, timeFilter: val as any }))}
                icon={<Clock size={16} />}
                options={[
                  { label: 'All Products', value: 'all' },
                  { label: '1 Week (Updated)', value: '1week' },
                  { label: '2 Weeks (Updated)', value: '2week' },
                  { label: '3 Weeks (Updated)', value: '3week' },
                ]}
              />
            </div>

            <div className="w-full sm:w-36">
              <CustomSelect
                value={filters.gridSize.toString()}
                onChange={(val) => setFilters((prev) => ({ ...prev, gridSize: parseInt(val) }))}
                icon={<LayoutGrid size={16} />}
                options={
                  sidebarOpen
                    ? [
                      { label: '2 Columns', value: '2' },
                      { label: '3 Columns', value: '3' },
                    ]
                    : [
                      { label: '2 Columns', value: '2' },
                      { label: '3 Columns', value: '3' },
                      { label: '4 Columns', value: '4' },
                    ]
                }
              />
            </div>

            {/* Clear Filters Button in Controls Bar */}
            {hasActiveFilters && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleClearFilters}
                className="px-4 py-2.5 lg:py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-full font-bold text-xs sm:text-sm transition-all border border-red-200 flex items-center justify-center gap-2"
              >
                <X size={15} />
                Clear Filters
              </motion.button>
            )}

            <div className="hidden lg:flex items-center justify-center px-6 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-full text-sm text-[#0f172a] font-black min-w-[120px] uppercase">
              {totalCount} <span className="font-semibold text-gray-500 ml-1">Products</span>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col md:flex-row gap-8 relative">
        {/* Retractable Sidebar Filters */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ opacity: 0, width: 0, x: -20 }}
              animate={{ opacity: 1, width: 'auto', x: 0 }}
              exit={{ opacity: 0, width: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full md:w-auto md:flex-shrink-0 origin-left md:sticky md:top-36 self-start max-h-[calc(100vh-10rem)] overflow-y-auto no-scrollbar"
            >
              <div className="w-full md:w-[280px] space-y-6 bg-white/40 backdrop-blur-2xl rounded-[2rem] p-6 border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <h3 className="font-black text-[#0f172a] text-xl">Filters</h3>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors md:hidden"
                  >
                    <X size={20} className="text-gray-600" />
                  </button>
                </div>

                {/* Categories */}
                <div>
                  <h4 className="font-bold text-[#0f172a] mb-4 text-xs uppercase tracking-widest">Categories</h4>
                  <div className="space-y-1.5">
                    {CATEGORIES.map((category) => {
                      const isExpanded = expandedCategories.includes(category);
                      const hasSubcategories = category !== 'All' && getSubcategoriesForCategory(category).length > 0;
                      const isSelected = category === 'All' ? filters.categories.length === 0 : filters.categories.includes(category);

                      return (
                        <div key={category}>
                          <motion.div className="flex items-center gap-2 group" whileHover={{ x: 2 }}>
                            <label className="flex items-center gap-3 cursor-pointer flex-1 group py-1">
                              <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-[#0f172a] border-[#0f172a]' : 'border-gray-300 group-hover:border-[#0f172a]'}`}>
                                {isSelected && <Check size={12} className="text-white" />}
                              </div>
                              <input type="checkbox" checked={isSelected} onChange={() => handleCategoryToggle(category)} className="hidden" />
                              <span className={`text-[15px] font-semibold transition-colors uppercase ${isSelected ? 'text-[#0f172a]' : 'text-gray-600 group-hover:text-[#0f172a]'}`}>
                                {category}
                              </span>
                            </label>
                            {hasSubcategories && (
                              <motion.button
                                onClick={() =>
                                  setExpandedCategories((prev) =>
                                    prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
                                  )
                                }
                                className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-full transition-colors"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                  <ChevronDown size={16} className="text-[#0f172a]" />
                                </motion.div>
                              </motion.button>
                            )}
                            {!hasSubcategories && <div className="w-6" />}
                          </motion.div>

                          <AnimatePresence>
                            {hasSubcategories && isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="ml-8 mt-1 space-y-1 pl-4 border-l-2 border-gray-100"
                              >
                                {getSubcategoriesForCategory(category).map((subcategory) => (
                                  <motion.div
                                    key={subcategory}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    whileHover={{ x: 4 }}
                                  >
                                    <label className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-gray-50 transition-colors group cursor-pointer">
                                      <div className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-colors ${filters.subcategories.includes(subcategory) ? 'bg-[#0f172a] border-[#0f172a]' : 'border-gray-300 group-hover:border-[#0f172a]'}`}>
                                        {filters.subcategories.includes(subcategory) && <Check size={10} className="text-white" />}
                                      </div>
                                      <input type="checkbox" checked={filters.subcategories.includes(subcategory)} onChange={() => handleSubcategoryToggle(subcategory)} className="hidden" />
                                      <span className={`text-[13px] font-semibold flex-1 transition-colors uppercase ${filters.subcategories.includes(subcategory) ? 'text-[#0f172a]' : 'text-gray-500 group-hover:text-[#0f172a]'}`}>
                                        {subcategory}
                                      </span>
                                    </label>
                                  </motion.div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Updated Time Filter */}
                <div className="border-t border-gray-100 pt-5">
                  <h4 className="font-bold text-[#0f172a] mb-4 text-xs uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={14} /> Updated Time
                  </h4>
                  <div className="space-y-1.5">
                    {[
                      { label: 'All Products', value: 'all' },
                      { label: 'Last 1 Week', value: '1week' },
                      { label: 'Last 2 Weeks', value: '2week' },
                      { label: 'Last 3 Weeks', value: '3week' },
                    ].map((option) => {
                      const isSelected = (filters.timeFilter || 'all') === option.value;
                      return (
                        <label key={option.value} className="flex items-center gap-3 cursor-pointer py-1 group">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected ? 'border-[#0f172a] bg-[#0f172a]' : 'border-gray-300 group-hover:border-[#0f172a]'}`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <input
                            type="radio"
                            name="timeFilter"
                            checked={isSelected}
                            onChange={() => setFilters((prev) => ({ ...prev, timeFilter: option.value as any }))}
                            className="hidden"
                          />
                          <span className={`text-[14px] font-semibold transition-colors uppercase ${isSelected ? 'text-[#0f172a]' : 'text-gray-600 group-hover:text-[#0f172a]'}`}>
                            {option.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Price Range */}
                <div className="border-t border-gray-100 pt-5">
                  <h4 className="font-bold text-[#0f172a] mb-4 text-xs uppercase tracking-widest">Price Range</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Min Price</label>
                        <span className="text-sm font-black text-[#0f172a]">{formatPrice(filters.priceRange[0])}</span>
                      </div>
                      <input type="range" min={apiPriceRange.min} max={apiPriceRange.max} value={filters.priceRange[0]} onChange={(e) => handlePriceChange('min', parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0f172a]" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Max Price</label>
                        <span className="text-sm font-black text-[#0f172a]">{formatPrice(filters.priceRange[1])}</span>
                      </div>
                      <input type="range" min={apiPriceRange.min} max={apiPriceRange.max} value={filters.priceRange[1]} onChange={(e) => handlePriceChange('max', parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0f172a]" />
                    </div>
                  </div>
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClearFilters}
                    className="w-full bg-red-50 text-red-600 font-bold py-3.5 rounded-full hover:bg-red-100 transition-all text-sm mt-4 border-2 border-red-200 flex items-center justify-center gap-2"
                  >
                    <X size={16} />
                    Clear All Filters
                  </motion.button>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Products Content */}
        <div className="flex-1 min-w-0 ">
          {filteredProducts.length > 0 ? (
            <div className="space-y-12">
              {sortedGroupedEntries.map(([category, categoryProducts], categoryIndex) => {
                const isCollapsed = collapsedSections[category];

                // Get the accurate total count from API data for this category
                const normCat = category.trim().replace(/\s+/g, ' ').toUpperCase();
                const matchingApiCats = apiCategories.filter(c => (c.name || '').trim().replace(/\s+/g, ' ').toUpperCase() === normCat);
                const accurateCount = matchingApiCats.length > 0
                  ? matchingApiCats.reduce((sum, c) => sum + (c.totalCount || 0), 0)
                  : categoryProducts.length;

                return (
                  <CategorySection
                    key={category}
                    category={category}
                    categoryProducts={categoryProducts}
                    categoryIndex={categoryIndex}
                    isCollapsed={isCollapsed}
                    toggleSection={toggleSection}
                    accurateCount={accurateCount}
                    gridClass={gridClass}
                    columnsCount={actualGridSize}
                    timeFilter={filters.timeFilter}
                    onGlobalLoadMore={loadMore}
                  />
                );
              })}

              {/* Infinite scroll sentinel + Load More */}
              <div ref={sentinelRef} className="flex justify-center py-8">
                {isLoadingMore && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 px-6 py-3 bg-white/40 backdrop-blur-xl rounded-full border border-white/60 shadow-sm">
                    <Loader2 size={18} className="animate-spin text-[#0f172a]" />
                    <span className="text-sm font-bold text-gray-600">Loading more products...</span>
                  </motion.div>
                )}
                {!hasMore && products.length > 0 && (
                  <span className="text-sm font-medium text-gray-400">You&apos;ve reached the end</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-12 w-full">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-32 text-center bg-white/30 backdrop-blur-2xl rounded-[3rem] border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]"
              >
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                  <span className="text-4xl">🔍</span>
                </div>
                <p className="text-3xl font-black text-[#0f172a] mb-3">No products found</p>
                <p className="text-lg font-medium text-gray-400 max-w-md">
                  Try adjusting your search terms or clearing some filters to find what you&apos;re looking for
                </p>
              </motion.div>
              <RelatedProducts />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
