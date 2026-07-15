'use client';

import { useState, useMemo } from 'react';
import { Product, FilterState } from '@/lib/types';
import { MOCK_PRODUCTS, CATEGORIES } from '@/lib/mock-data';
import ProductCard from './product-card';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/currency';
import { getSubcategoriesForCategory } from '@/lib/categories-config';

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
    gridSize: 3,
  });

  const [showFilters, setShowFilters] = useState(false);
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

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div>
          <h2 className="text-4xl md:text-5xl font-black text-foreground mb-2">
            Explore Matrices Tech Collection
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl">
            {searchQuery
              ? `Search results for "${searchQuery}" (${filteredProducts.length} found)`
              : `Browse our carefully curated collection of ${MOCK_PRODUCTS.length} premium tech items`}
          </p>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card rounded-2xl p-4 border border-border">
          {/* Sort */}
          <div className="flex-1 sm:flex-none">
            <select
              value={filters.sortBy}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  sortBy: e.target.value as any,
                }))
              }
              className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            >
              <option value="newest">Sort by: Newest</option>
              <option value="price-low">Sort by: Price (Low to High)</option>
              <option value="price-high">Sort by: Price (High to Low)</option>
              <option value="rating">Sort by: Highest Rated</option>
            </select>
          </div>

          {/* Grid Size */}
          <div className="flex-1 sm:flex-none">
            <select
              value={filters.gridSize}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  gridSize: parseInt(e.target.value),
                }))
              }
              className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            >
              <option value="2">Grid: 2 Columns</option>
              <option value="3">Grid: 3 Columns</option>
              <option value="4">Grid: 4 Columns</option>
              <option value="5">Grid: 5 Columns</option>
              <option value="6">Grid: 6 Columns</option>
            </select>
          </div>

          {/* Filter Toggle */}
          <Button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden bg-accent text-white hover:bg-accent/90 rounded-xl py-3 font-semibold"
          >
            <ChevronDown size={20} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            Filters
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Sidebar Filters */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className={`${showFilters ? 'block' : 'hidden'} md:block md:col-span-1`}
        >
          <div className="sticky top-24 space-y-6 bg-card rounded-2xl p-6 border border-border">
            {/* Categories with Nested Subcategories */}
            <div>
              <h3 className="font-bold text-foreground mb-4 text-lg">Categories</h3>
              <div className="space-y-2">
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
                        {/* Expand/Collapse Button - Only for categories with subcategories */}
                        {hasSubcategories && (
                          <motion.button
                            onClick={() =>
                              setExpandedCategories((prev) =>
                                prev.includes(category)
                                  ? prev.filter((c) => c !== category)
                                  : [...prev, category]
                              )
                            }
                            className="flex-shrink-0 p-1 hover:bg-accent/20 rounded transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <motion.div
                              animate={{ rotate: isExpanded ? 90 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown size={16} className="text-foreground" />
                            </motion.div>
                          </motion.button>
                        )}

                        {/* Spacer for categories without subcategories */}
                        {!hasSubcategories && <div className="w-7" />}

                        {/* Category Checkbox */}
                        <label className="flex items-center gap-2 cursor-pointer flex-1 group">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleCategoryToggle(category)}
                            className="w-5 h-5 rounded-lg border-2 border-border cursor-pointer accent-accent hover:border-accent transition-colors"
                          />
                          <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
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
                            className="ml-6 mt-2 space-y-2 pl-3 border-l-2 border-accent/30"
                          >
                            {getSubcategoriesForCategory(category).sort().map((subcategory) => (
                              <motion.div
                                key={subcategory}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                whileHover={{ x: 4 }}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/10 transition-colors group cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={filters.subcategories.includes(subcategory)}
                                  onChange={() => handleSubcategoryToggle(subcategory)}
                                  className="w-4 h-4 rounded border-2 border-accent/40 cursor-pointer accent-accent hover:border-accent transition-colors"
                                />
                                <span className="text-xs font-medium text-foreground/80 group-hover:text-accent transition-colors flex-1">
                                  {subcategory}
                                </span>
                                {filters.subcategories.includes(subcategory) && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="text-accent"
                                  >
                                    <Check size={14} />
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
            <div className="border-t border-border/50 pt-6">
              <h3 className="font-bold text-foreground mb-4 text-lg">Price Range</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Min Price
                    </label>
                    <span className="text-sm font-bold text-accent">{formatPrice(filters.priceRange[0])}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40000"
                    value={filters.priceRange[0]}
                    onChange={(e) => handlePriceChange('min', parseInt(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Max Price
                    </label>
                    <span className="text-sm font-bold text-accent">{formatPrice(filters.priceRange[1])}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40000"
                    value={filters.priceRange[1]}
                    onChange={(e) => handlePriceChange('max', parseInt(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
                  />
                </div>
              </div>
            </div>

            {/* Price Range */}
            <div className="border-t border-border/50 pt-6">
              <h3 className="font-bold text-foreground mb-4 text-lg">Price Range</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Min Price
                    </label>
                    <span className="text-sm font-bold text-accent">{formatPrice(filters.priceRange[0])}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40000"
                    value={filters.priceRange[0]}
                    onChange={(e) => handlePriceChange('min', parseInt(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Max Price
                    </label>
                    <span className="text-sm font-bold text-accent">{formatPrice(filters.priceRange[1])}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40000"
                    value={filters.priceRange[1]}
                    onChange={(e) => handlePriceChange('max', parseInt(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
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
                className="w-full bg-secondary text-foreground font-bold py-3 rounded-xl hover:bg-accent hover:text-white transition-all"
              >
                Clear All Filters
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Products Grid */}
        <div className="md:col-span-4">
          {filteredProducts.length > 0 ? (
            <motion.div
              layout
              className={`grid gap-6 ${
                filters.gridSize === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : filters.gridSize === 3
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    : filters.gridSize === 4
                      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                      : filters.gridSize === 5
                        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-6'
              }`}
              style={{
                gridAutoRows: 'max-content',
              }}
            >
              {filteredProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-2xl font-bold text-foreground mb-2">No products found</p>
              <p className="text-lg text-muted-foreground max-w-md">
                Try adjusting your search terms or filters to find what you're looking for
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
