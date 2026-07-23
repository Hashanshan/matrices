'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Product, FilterState } from '@/lib/types';
import { useProducts, useFilters } from '@/lib/hooks/use-products';
import ProductCard from './product-card';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, Check, PanelLeftClose, PanelLeftOpen, Filter, SortDesc, LayoutGrid, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/currency';
import CustomSelect from './custom-select';

interface ProductGalleryProps {
  searchQuery: string;
  initialCategory?: string;
  onFilterChange?: (filters: FilterState) => void;
}

export default function ProductGallery({ searchQuery, initialCategory, onFilterChange }: ProductGalleryProps) {
  const { categories: apiCategories, priceRange: apiPriceRange } = useFilters();

  const [filters, setFilters] = useState<FilterState>({
    searchQuery,
    categories: initialCategory ? [initialCategory] : [],
    subcategories: [],
    priceRange: [0, 40000],
    sortBy: 'newest',
    gridSize: 4,
  });

  // Sync price range once api data loads if it's default
  useEffect(() => {
    if (apiPriceRange.max > 0 && filters.priceRange[1] === 40000) {
      setFilters(prev => ({ ...prev, priceRange: [apiPriceRange.min, apiPriceRange.max] }));
    }
  }, [apiPriceRange]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

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
  } = useProducts({
    sort: backendSort,
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

  // Use API filters for categories instead of extracting from products
  const CATEGORIES = useMemo(() => {
    return ['All', ...apiCategories.map(c => c.name).sort()];
  }, [apiCategories]);

  const getSubcategoriesForCategory = useCallback((category: string) => {
    const cat = apiCategories.find(c => c.name === category);
    return cat ? cat.subcategories.map(s => s.name) : [];
  }, [apiCategories]);

  // Group products by category
  const groupedProducts = useMemo(() => {
    const groups: { [category: string]: Product[] } = {};
    const categoryNames = CATEGORIES.filter(c => c !== 'All');

    categoryNames.forEach((cat) => {
      const productsInCategory = filteredProducts.filter((p: any) => p.categories === cat);
      if (productsInCategory.length > 0) {
        groups[cat] = productsInCategory;
      }
    });

    return groups;
  }, [filteredProducts, CATEGORIES]);

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
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-12 pr-4 py-4 border border-white/60 rounded-2xl leading-5 bg-white/40 backdrop-blur-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f172a] sm:text-sm shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] transition-all placeholder:text-gray-500"
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
          <div className="w-full sm:w-56">
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

          <div className="w-full sm:w-40">
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
                                {getSubcategoriesForCategory(category).sort().map((subcategory) => (
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
                {(filters.categories.length > 0 || filters.subcategories.length > 0 || filters.priceRange[0] !== 0 || filters.priceRange[1] !== 40000) && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        categories: [],
                        subcategories: [],
                        priceRange: [0, 40000],
                      }))
                    }
                    className="w-full bg-gray-100 text-[#0f172a] font-bold py-3.5 rounded-full hover:bg-gray-200 transition-all text-sm mt-4 border-2 border-transparent hover:border-gray-300"
                  >
                    Clear All Filters
                  </motion.button>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Products Content */}
        <div className="flex-1 min-w-0">
          {filteredProducts.length > 0 ? (
            <div className="space-y-12">
              {Object.entries(groupedProducts).map(([category, categoryProducts], categoryIndex) => {
                const isCollapsed = collapsedSections[category];

                return (
                  <motion.section
                    key={category}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: categoryIndex * 0.1 }}
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
                        {categoryProducts.length} {categoryProducts.length === 1 ? 'Product' : 'Products'}
                      </span>
                    </div>

                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="pb-8">
                            <motion.div layout className={`grid gap-6 sm:gap-8 ${gridClass}`} style={{ gridAutoRows: 'max-content' }}>
                              {categoryProducts.map((product, index) => (
                                <ProductCard key={product.id} product={product} index={index} />
                              ))}
                            </motion.div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.section>
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
          )}
        </div>
      </div>
    </div>
  );
}
