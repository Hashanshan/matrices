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
  timeFilter?: string;
  onGlobalLoadMore?: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(20);
  const [extraCategoryProducts, setExtraCategoryProducts] = useState<any[]>([]);
  const [isLoadingCategoryMore, setIsLoadingCategoryMore] = useState(false);
  const { dataMode } = useDataMode();

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

  // Actual list of products currently visible
  const visibleProducts = useMemo(() => {
    return combinedProducts.slice(0, visibleCount);
  }, [combinedProducts, visibleCount]);

  const currentShowingCount = visibleProducts.length;
  const targetTotalCount = Math.max(accurateCount, combinedProducts.length);

  // If showing count is less than top count -> hasMore is true
  const hasMore = currentShowingCount < targetTotalCount;

  // Handle manual "Load More" button click (and auto-scroll)
  const handleLoadMore = async () => {
    if (isLoadingCategoryMore) return;

    // 1. If we already have more products loaded in memory, just expand visibleCount
    if (visibleCount < combinedProducts.length) {
      setVisibleCount(prev => Math.min(prev + 20, combinedProducts.length));
      return;
    }

    // 2. If we need to fetch more products for this specific category (both online and offline)
    if (combinedProducts.length < targetTotalCount) {
      setIsLoadingCategoryMore(true);
      try {
        const isOffline = dataMode === 'offline' || (typeof navigator !== 'undefined' && !navigator.onLine);
        if (isOffline) {
          // Fetch from IndexedDB with timeFilter
          const offlineRes = await getOfflineProducts({
            category: category,
            timeFilter: timeFilter,
            limit: 100,
          });
          if (offlineRes && offlineRes.data && offlineRes.data.length > 0) {
            setExtraCategoryProducts(prev => [...prev, ...offlineRes.data]);
            setVisibleCount(prev => prev + 20);
          } else {
            // Also try fallback direct query from offlineDB products store with timeFilter
            const allRaw = await offlineDB.getAll<any>('products').catch(() => []);
            let timeCutoff = 0;
            if (timeFilter && timeFilter !== 'all' && timeFilter !== 'null') {
              const now = Date.now();
              if (timeFilter === '1week' || timeFilter === '1w' || timeFilter === '7d') timeCutoff = now - 7 * 24 * 60 * 60 * 1000;
              else if (timeFilter === '2week' || timeFilter === '2w' || timeFilter === '14d') timeCutoff = now - 14 * 24 * 60 * 60 * 1000;
              else if (timeFilter === '3week' || timeFilter === '3w' || timeFilter === '21d') timeCutoff = now - 21 * 24 * 60 * 60 * 1000;
            }

            const catMatches = allRaw.filter((p: any) => {
              if (p.isDeleted) return false;
              if (timeCutoff > 0) {
                const pTime = p.updatedAt ? new Date(p.updatedAt).getTime() : (p.createdAt ? new Date(p.createdAt).getTime() : 0);
                if (pTime < timeCutoff) return false;
              }
              const pCat = String(p.category || p.categoryName || p.categories || '').trim().toUpperCase();
              return pCat === category.toUpperCase();
            });
            if (catMatches.length > 0) {
              setExtraCategoryProducts(prev => [...prev, ...catMatches]);
              setVisibleCount(prev => prev + 20);
            }
          }
        } else {
          // Fetch from Online API endpoint with timeFilter
          const token = getAuthToken();
          const timeParam = timeFilter && timeFilter !== 'all' && timeFilter !== 'null' ? `&timeFilter=${encodeURIComponent(timeFilter)}` : '';
          const targetUrl = resolveApiUrl(`/api/products?category=${encodeURIComponent(category)}${timeParam}&limit=50&page=${Math.floor(combinedProducts.length / 50) + 1}`);
          const res = await fetch(targetUrl, {
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
          });
          if (res.ok) {
            const data = await res.json();
            const items = data.data || data.products || [];
            if (items.length > 0) {
              setExtraCategoryProducts(prev => [...prev, ...items]);
              setVisibleCount(prev => prev + 20);
            }
          }
        }

        // Also trigger parent global hook to advance cursor
        if (onGlobalLoadMore) {
          onGlobalLoadMore();
        }
      } catch (err) {
        console.error(`Failed to load more products for category ${category}:`, err);
      } finally {
        setIsLoadingCategoryMore(false);
      }
    }
  };

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

              {/* Load More Button (Both Online & Offline - Hidden when showing count equals top count) */}
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

  const handleClearFilters = () => {
    clearGalleryFilters();
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
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Close sidebar or reset expanded categories on back press
  useBackHandler(() => {
    if (sidebarOpen) {
      setSidebarOpen(false);
      return true;
    }
    if (expandedCategories.length > 0) {
      setExpandedCategories([]);
      return true;
    }
    return false;
  }, sidebarOpen || expandedCategories.length > 0);

  // Map frontend sortBy to backend sort param
  const backendSort = filters.sortBy === 'price-low' ? 'price-low'
    : filters.sortBy === 'price-high' ? 'price-high'
      : undefined; // default = newest

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
    limit: 20,
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
      { threshold: 0.1 }
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
      if (cName) wishlistedMap.set(cName.toUpperCase(), (c as any)?.order ?? idx);
    });

    const catNames = apiCategories.map(c => c.name);
    catNames.sort((a, b) => {
      const aWish = wishlistedMap.has(a.toUpperCase());
      const bWish = wishlistedMap.has(b.toUpperCase());
      if (aWish && bWish) {
        return (wishlistedMap.get(a.toUpperCase()) ?? 0) - (wishlistedMap.get(b.toUpperCase()) ?? 0);
      }
      if (aWish) return -1;
      if (bWish) return 1;
      return a.localeCompare(b);
    });

    return ['All', ...catNames];
  }, [apiCategories, wishlist.categories]);

  const getSubcategoriesForCategory = useCallback((category: string) => {
    const cat = apiCategories.find(c => c.name === category);
    if (!cat) return [];

    const wishlistedSubMap = new Map<string, number>();
    (wishlist.subcategories || [])
      .filter(s => {
        const sCat = typeof s === 'object' ? (s as any)?.category || (s as any)?.categoryName : '';
        return sCat && String(sCat).toUpperCase() === category.toUpperCase();
      })
      .forEach((s, idx) => {
        const sName = typeof s === 'string' ? s : (s as any)?.name || (s as any)?.subcategoryName || '';
        if (sName) wishlistedSubMap.set(String(sName).toUpperCase(), (s as any)?.order ?? idx);
      });

    const subNames = cat.subcategories.map(s => s.name);
    return subNames.sort((a, b) => {
      const aWish = wishlistedSubMap.has(a.toUpperCase());
      const bWish = wishlistedSubMap.has(b.toUpperCase());
      if (aWish && bWish) {
        return (wishlistedSubMap.get(a.toUpperCase()) ?? 0) - (wishlistedSubMap.get(b.toUpperCase()) ?? 0);
      }
      if (aWish) return -1;
      if (bWish) return 1;
      return a.localeCompare(b);
    });
  }, [apiCategories, wishlist.subcategories]);

  // Group products by category, prioritizing wishlisted products FIRST within each category (O(N) linear time)
  const groupedProducts = useMemo(() => {
    const groups: { [category: string]: Product[] } = {};

    // 1. Single O(N) pass to group products by category
    for (let i = 0; i < filteredProducts.length; i++) {
      const p = filteredProducts[i];
      const cat = p.categories || 'Uncategorized';
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
      if (cName) wishlistedCatOrderMap.set(cName.toUpperCase(), (c as any)?.order ?? idx);
    });

    const entries = Object.entries(groupedProducts);

    return entries.sort(([catA], [catB]) => {
      const aWish = wishlistedCatOrderMap.has(catA.toUpperCase());
      const bWish = wishlistedCatOrderMap.has(catB.toUpperCase());

      if (aWish && bWish) {
        return (wishlistedCatOrderMap.get(catA.toUpperCase()) ?? 0) - (wishlistedCatOrderMap.get(catB.toUpperCase()) ?? 0);
      }
      if (aWish) return -1;
      if (bWish) return 1;

      return catA.localeCompare(catB);
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

  const actualGridSize = sidebarOpen ? Math.min(filters.gridSize, 3) : Math.min(filters.gridSize, 4);
  const gridClass = actualGridSize === 2
    ? 'grid-cols-1 sm:grid-cols-2'
    : actualGridSize === 3
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

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
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white/30 backdrop-blur-2xl rounded-[2rem] p-4 px-6 border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] sticky top-[80px] z-30"
      >
        <div className="flex items-center justify-between w-full lg:w-auto">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:flex items-center gap-3 px-6 py-3.5 bg-[#0f172a] text-white rounded-full font-bold text-sm hover:bg-[#1e293b] shadow-lg shadow-blue-900/10 transition-all border border-transparent hover:border-blue-800"
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            {sidebarOpen ? 'Hide Filters' : 'Show Filters'}
          </motion.button>

          <Button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden bg-[#0f172a] text-white hover:bg-[#1e293b] rounded-full py-3 px-6 font-bold text-sm shadow-md flex items-center gap-2"
          >
            <Filter size={18} />
            Filters
          </Button>

          <div className="lg:hidden text-sm text-gray-500 font-black px-4 bg-gray-50 py-2 rounded-full uppercase">
            {totalCount} <span className="font-semibold">Items</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
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
              className="px-4 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-full font-bold text-sm transition-all border border-red-200 flex items-center gap-2"
            >
              <X size={16} />
              Clear Filters
            </motion.button>
          )}

          <div className="hidden lg:flex items-center justify-center px-6 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-full text-sm text-[#0f172a] font-black min-w-[120px] uppercase">
            {totalCount} <span className="font-semibold text-gray-500 ml-1">Products</span>
          </div>
        </div>
      </motion.div>

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
                const apiCategoryData = apiCategories.find(c => c.name.toUpperCase() === category.toUpperCase());
                const accurateCount = apiCategoryData ? apiCategoryData.totalCount : categoryProducts.length;

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
