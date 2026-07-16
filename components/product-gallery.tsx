'use client';

import { useState, useMemo } from 'react';
import { Product, FilterState } from '@/lib/types';
import { MOCK_PRODUCTS, CATEGORIES } from '@/lib/mock-data';
import ProductCard from './product-card';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, Check, PanelLeftClose, PanelLeftOpen, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/currency';
import { getSubcategoriesForCategory, getAllCategoryNames } from '@/lib/categories-config';

interface ProductGalleryProps {
  searchQuery: string;
  onFilterChange?: (filters: FilterState) => void;
}

export default function ProductGallery({ searchQuery, onFilterChange }: ProductGalleryProps) {
  const [filters, setFilters] = useState<FilterState>({
    searchQuery,
    categories: [],
    subcategories: [],
    priceRange: [0, 40000],
    sortBy: 'newest',
    gridSize: 4,
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let results = MOCK_PRODUCTS.filter((product) => {
      // Search
      if (
        searchQuery &&
        !product.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !product.description.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Category
      if (filters.categories.length > 0 && !filters.categories.includes(product.category)) {
        return false;
      }

      // Subcategory (if any are selected)
      if (filters.subcategories.length > 0 && !filters.subcategories.includes(product.subcategory || '')) {
        return false;
      }

      // Price range
      if (product.price < filters.priceRange[0] || product.price > filters.priceRange[1]) {
        return false;
      }

      return true;
    });

    // Sort
    switch (filters.sortBy) {
      case 'price-low':
        results.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        results.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        results.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
      default:
        results.sort((a, b) => parseInt(b.id) - parseInt(a.id));
    }

    return results;
  }, [searchQuery, filters]);

  // Group products by category
  const groupedProducts = useMemo(() => {
    const groups: { [category: string]: Product[] } = {};
    const categoryNames = getAllCategoryNames();
    
    categoryNames.forEach((cat) => {
      const productsInCategory = filteredProducts.filter((p) => p.category === cat);
      if (productsInCategory.length > 0) {
        groups[cat] = productsInCategory;
      }
    });

    return groups;
  }, [filteredProducts]);

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

      // Clear subcategories when categories change
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

  const gridClass = filters.gridSize === 2
    ? 'grid-cols-1 sm:grid-cols-2'
    : filters.gridSize === 3
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : filters.gridSize === 4
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        : filters.gridSize === 5
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'
          : 'grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6';

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white rounded-[2rem] p-4 px-6 border border-gray-50 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.06)]"
      >
        {/* Left: Sidebar Toggle + Sort */}
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-[#0f172a] text-white rounded-full font-semibold text-sm hover:bg-[#1e293b] shadow-sm transition-all"
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            {sidebarOpen ? 'Hide Filters' : 'Show Filters'}
          </motion.button>

          <select
            value={filters.sortBy}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                sortBy: e.target.value as any,
              }))
            }
            className="px-5 py-2.5 border border-gray-200 rounded-full bg-gray-50 text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition-all text-sm shadow-sm hover:bg-white"
          >
            <option value="newest">Sort by: Newest</option>
            <option value="price-low">Sort by: Price (Low to High)</option>
            <option value="price-high">Sort by: Price (High to Low)</option>
            <option value="rating">Sort by: Highest Rated</option>
          </select>
        </div>

        {/* Right: Grid Size + Mobile Filter Toggle */}
        <div className="flex items-center gap-3">
          <select
            value={filters.gridSize}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                gridSize: parseInt(e.target.value),
              }))
            }
            className="px-5 py-2.5 border border-gray-200 rounded-full bg-gray-50 text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition-all text-sm shadow-sm hover:bg-white"
          >
            <option value="2">Grid: 2 Columns</option>
            <option value="3">Grid: 3 Columns</option>
            <option value="4">Grid: 4 Columns</option>
            <option value="5">Grid: 5 Columns</option>
            <option value="6">Grid: 6 Columns</option>
          </select>

          <Button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden bg-[#0f172a] text-white hover:bg-[#1e293b] rounded-full py-2.5 px-6 font-semibold text-sm shadow-sm"
          >
            <Filter size={18} />
            Filters
          </Button>
        </div>

        <div className="text-sm text-gray-500 font-semibold">
          {searchQuery
            ? `${filteredProducts.length} results for "${searchQuery}"`
            : `${filteredProducts.length} products`}
        </div>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-6 relative">
        {/* Retractable Sidebar Filters */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ opacity: 0, height: 0, width: '100%' }}
              animate={{ opacity: 1, height: 'auto', width: 'auto' }}
              exit={{ opacity: 0, height: 0, width: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full md:w-auto md:flex-shrink-0 overflow-hidden origin-top"
            >
              <div className="w-full md:w-[280px] sticky top-24 space-y-6 bg-white rounded-[2rem] p-6 border border-gray-50 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.06)]">
                {/* Sidebar Header */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <h3 className="font-black text-[#0f172a] text-xl">Filters</h3>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-1 hover:bg-muted rounded transition-colors md:hidden"
                  >
                    <X size={18} />
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
                          <motion.div
                            className="flex items-center gap-2 group"
                            whileHover={{ x: 2 }}
                          >
                            {hasSubcategories && (
                              <motion.button
                                onClick={() =>
                                  setExpandedCategories((prev) =>
                                    prev.includes(category)
                                      ? prev.filter((c) => c !== category)
                                      : [...prev, category]
                                  )
                                }
                                className="flex-shrink-0 p-1 hover:bg-primary/10 rounded transition-colors"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <motion.div
                                  animate={{ rotate: isExpanded ? 90 : 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <ChevronDown size={16} className="text-[#0f172a]" />
                                </motion.div>
                              </motion.button>
                            )}

                            {!hasSubcategories && <div className="w-6" />}

                            <label className="flex items-center gap-2 cursor-pointer flex-1 group py-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleCategoryToggle(category)}
                                className="w-4 h-4 rounded border border-gray-300 cursor-pointer accent-[#0f172a] hover:border-[#0f172a] transition-colors"
                              />
                              <span className="text-[15px] font-semibold text-gray-600 group-hover:text-[#0f172a] transition-colors">
                                {category}
                              </span>
                            </label>
                          </motion.div>

                          {/* Nested Subcategories */}
                          <AnimatePresence>
                            {hasSubcategories && isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="ml-6 mt-1 space-y-1 pl-3 border-l-2 border-primary/30"
                              >
                                {getSubcategoriesForCategory(category).sort().map((subcategory) => (
                                  <motion.div
                                    key={subcategory}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    whileHover={{ x: 4 }}
                                    className="flex items-center gap-2 p-1.5 rounded hover:bg-primary/5 transition-colors group cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={filters.subcategories.includes(subcategory)}
                                      onChange={() => handleSubcategoryToggle(subcategory)}
                                      className="w-3.5 h-3.5 rounded border border-gray-300 cursor-pointer accent-[#0f172a] hover:border-[#0f172a] transition-colors"
                                    />
                                    <span className="text-[13px] font-semibold text-gray-500 group-hover:text-[#0f172a] transition-colors flex-1">
                                      {subcategory}
                                    </span>
                                    {filters.subcategories.includes(subcategory) && (
                                      <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="text-primary"
                                      >
                                        <Check size={12} />
                                      </motion.div>
                                    )}
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
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                          Min Price
                        </label>
                        <span className="text-sm font-black text-[#0f172a]">{formatPrice(filters.priceRange[0])}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="40000"
                        value={filters.priceRange[0]}
                        onChange={(e) => handlePriceChange('min', parseInt(e.target.value))}
                        className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                          Max Price
                        </label>
                        <span className="text-sm font-black text-[#0f172a]">{formatPrice(filters.priceRange[1])}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="40000"
                        value={filters.priceRange[1]}
                        onChange={(e) => handlePriceChange('max', parseInt(e.target.value))}
                        className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
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
                    className="w-full bg-[#0f172a] text-white font-bold py-3 rounded-full hover:bg-[#1e293b] hover:shadow-md transition-all text-sm mt-4"
                  >
                    Clear All Filters
                  </motion.button>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Products Content - Category Grouped */}
        <div className="flex-1 min-w-0">
          {filteredProducts.length > 0 ? (
            <div className="space-y-10">
              {Object.entries(groupedProducts).map(([category, products], categoryIndex) => (
                <motion.section
                  key={category}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: categoryIndex * 0.1 }}
                >
                  {/* Category Banner */}
                  <div className="bg-white rounded-[1.5rem] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.06)] border border-gray-50 flex items-center justify-between p-6 mb-6">
                    <h2 className="text-2xl font-black text-[#0f172a] tracking-wide uppercase">
                      {category}
                    </h2>
                    <span className="text-sm font-semibold text-gray-400">
                      {products.length} {products.length === 1 ? 'Product' : 'Products'}
                    </span>
                  </div>

                  {/* Products Grid */}
                  <div className="pb-8">
                    <motion.div
                      layout
                      className={`grid gap-6 ${gridClass}`}
                      style={{ gridAutoRows: 'max-content' }}
                    >
                      {products.map((product, index) => (
                        <ProductCard key={product.id} product={product} index={index} />
                      ))}
                    </motion.div>
                  </div>
                </motion.section>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-2xl font-bold text-foreground mb-2">No products found</p>
              <p className="text-lg text-muted-foreground max-w-md">
                Try adjusting your search terms or filters to find what you&apos;re looking for
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
