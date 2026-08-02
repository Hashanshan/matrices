'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Search, ChevronRight, ArrowLeft, Heart, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFilters } from '@/lib/hooks/use-products';
import { useWishlist } from '@/lib/contexts/wishlist-context';

export default function CategoriesPage({ fallbackData }: { fallbackData?: any } = {}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch filters (categories, subcategories) from API with fallbackData
  const { categories, isLoading, isValidating } = useFilters({ fallbackData });

  // Access wishlist state and toggles
  const {
    wishlist,
    isCategoryWishlisted,
    isSubcategoryWishlisted,
    toggleCategoryWishlist,
    toggleSubcategoryWishlist,
  } = useWishlist();

  const selectedCategoryObj = useMemo(() => {
    if (!selectedCategory) return null;
    return categories.find(c => c.name.toUpperCase() === selectedCategory.toUpperCase());
  }, [selectedCategory, categories]);

  // Filtering & Wishlist Priority Sorting for top-level categories
  // Wishlisted categories show FIRST (ordered by wishlist order index), then non-wishlisted (A-Z)
  const filteredCategories = useMemo(() => {
    const wishlistedMap = new Map<string, number>();
    (wishlist.categories || []).forEach((c, idx) => {
      wishlistedMap.set(c.name.toUpperCase(), c.order ?? idx);
    });

    const matching = categories.filter(c =>
      c.name.toUpperCase().includes(searchQuery.toUpperCase())
    );

    return matching.sort((a, b) => {
      const aWish = wishlistedMap.has(a.name.toUpperCase());
      const bWish = wishlistedMap.has(b.name.toUpperCase());

      if (aWish && bWish) {
        return (wishlistedMap.get(a.name.toUpperCase()) ?? 0) - (wishlistedMap.get(b.name.toUpperCase()) ?? 0);
      }
      if (aWish) return -1;
      if (bWish) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [categories, searchQuery, wishlist.categories]);

  // Filtering & Wishlist Priority Sorting for subcategories of selected category
  const filteredSubcategories = useMemo(() => {
    if (!selectedCategoryObj) return [];

    const parentCatName = selectedCategoryObj.name.toUpperCase();
    const wishlistedMap = new Map<string, number>();
    (wishlist.subcategories || [])
      .filter(s => s.category.toUpperCase() === parentCatName)
      .forEach((s, idx) => {
        wishlistedMap.set(s.name.toUpperCase(), s.order ?? idx);
      });

    const matching = selectedCategoryObj.subcategories.filter(s =>
      s.name.toUpperCase().includes(searchQuery.toUpperCase())
    );

    return matching.sort((a, b) => {
      const aWish = wishlistedMap.has(a.name.toUpperCase());
      const bWish = wishlistedMap.has(b.name.toUpperCase());

      if (aWish && bWish) {
        return (wishlistedMap.get(a.name.toUpperCase()) ?? 0) - (wishlistedMap.get(b.name.toUpperCase()) ?? 0);
      }
      if (aWish) return -1;
      if (bWish) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [selectedCategoryObj, searchQuery, wishlist.subcategories]);

  if (isLoading && categories.length === 0) {
    return (
      <>
        <Header showSearch={false} />
        <main className="min-h-screen bg-transparent py-8 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-[url(/bg.png)] bg-cover bg-center bg-no-repeat bg-fixed py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isValidating && categories.length > 0 && (
            <div className="fixed top-4 right-4 z-50">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0f172a]/30"></div>
            </div>
          )}

          {/* Page Title & Back Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              {selectedCategory && (
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSearchQuery('');
                  }}
                  className="p-3 bg-white/30 backdrop-blur-md rounded-full border border-white/60 hover:bg-white/60 text-[#0f172a] shadow-sm hover:shadow-md transition-all"
                  aria-label="Back to Categories"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-[#0f172a] uppercase tracking-wide">
                  {selectedCategory ? `${selectedCategory}` : 'CATEGORIES'}
                </h1>
                <p className="text-sm text-gray-500 font-bold tracking-wide mt-1 uppercase">
                  {selectedCategory
                    ? `EXPLORE SUB CATEGORIES IN ${selectedCategory}`
                    : 'EXPLORE MAIN PRODUCT CATEGORIES'}
                </p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-8">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 z-1" />
            </div>
            <input
              type="text"
              className="rounded-[1rem] block w-full pl-12 pr-4 py-4 border border-white/60 rounded-2xl leading-5 bg-white/40 backdrop-blur-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f172a] sm:text-sm shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] transition-all placeholder:text-gray-500 uppercase font-semibold"
              placeholder={selectedCategory ? "SEARCH SUB CATEGORIES..." : "SEARCH CATEGORIES..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <AnimatePresence mode="wait">
            {!selectedCategory ? (
              // Top-Level Categories View
              <motion.div
                key="categories"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 backdrop-blur-[2px]"
              >
                {filteredCategories.map((cat, index) => {
                  const isWishlisted = isCategoryWishlisted(cat.name);
                  return (
                    <motion.div
                      key={cat.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                      whileHover={{ y: -5 }}
                      className="relative group"
                    >
                      <div
                        onClick={() => {
                          if (cat.subcategories && cat.subcategories.length > 0) {
                            setSelectedCategory(cat.name.toUpperCase());
                            setSearchQuery('');
                          } else {
                            router.push(`/gallery?category=${encodeURIComponent(cat.name)}`);
                          }
                        }}
                        className="relative rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col bg-white/20 backdrop-blur-2xl overflow-hidden border border-white/60 h-full cursor-pointer"
                      >
                        <div className="p-3 sm:p-4 pb-0 flex flex-col z-0">
                          <div className="aspect-[3/4] rounded-[1.5rem] overflow-hidden bg-[#eef1f6] flex items-center justify-center p-6 shadow-inner border border-black/5 relative">
                            {cat.image ? (
                              <img
                                src={cat.image}
                                alt={cat.name}
                                className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-700 ease-out mix-blend-multiply drop-shadow-xl"
                              />
                            ) : (
                              <div className="text-gray-400 font-semibold uppercase">NO IMAGE</div>
                            )}

                            {/* Wishlist Toggle Button on Category Card */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCategoryWishlist(cat.name);
                              }}
                              className="absolute top-3 right-3 w-10 h-10 bg-white/80 backdrop-blur-xl border border-white/60 rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:text-red-500 hover:bg-white transition-all z-20"
                              title={isWishlisted ? "Remove Category from Wishlist" : "Add Category to Wishlist"}
                            >
                              <Heart
                                size={18}
                                fill={isWishlisted ? "#ef4444" : "none"}
                                className={isWishlisted ? "text-red-500" : "text-gray-600"}
                              />
                            </button>
                          </div>
                        </div>
                        <div className="rounded-[2rem] relative mx-3 mt-2 mb-3 p-4 sm:p-5 bg-gradient-to-br from-white/60 to-white/30 backdrop-blur-3xl border border-white/60 shadow-[0_8px_64px_rgba(0,0,0,0.1)] flex flex-col flex-1 z-10">
                          <h3 className="text-xl font-extrabold text-[#0f172a] uppercase tracking-wide group-hover:text-[#1e3a8a] transition-colors drop-shadow-sm line-clamp-1 mb-2">
                            {cat.name}
                          </h3>
                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-black/5 gap-2">
                            <div>
                              <span className="text-[#0f172a] font-bold text-sm block uppercase">{cat.totalCount} PRODUCTS</span>
                              <span className="text-xs text-gray-500 font-medium uppercase">TOTAL AVAILABLE</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); router.push(`/view?category=${encodeURIComponent(cat.name)}`); }}
                                className="p-2.5 bg-[#0f172a] text-white rounded-full shadow-md hover:bg-[#1e293b] transition-all active:scale-90"
                                title={`Shop ${cat.name} products`}
                              >
                                <ShoppingCart size={15} />
                              </button>
                              <div className="flex items-center gap-1 text-sm font-bold text-[#0f172a] group-hover:text-[#1e3a8a] transition-colors bg-white/50 px-4 py-2 rounded-full">
                                EXPLORE <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              // Subcategories View (Under selected category)
              <motion.div
                key="subcategories"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 backdrop-blur-[2px]"
              >
                {filteredSubcategories.map((sub, index) => {
                  const isWishlisted = selectedCategory ? isSubcategoryWishlisted(selectedCategory, sub.name) : false;
                  return (
                    <motion.div
                      key={sub.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                      whileHover={{ y: -5 }}
                      className="relative group"
                    >
                      <div className="relative rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col bg-white/20 backdrop-blur-2xl overflow-hidden border border-white/60 h-full cursor-pointer">
                        <div className="p-3 sm:p-4 pb-0 flex flex-col z-0">
                          <Link href={`/gallery?category=${encodeURIComponent(selectedCategory || '')}&subcategory=${encodeURIComponent(sub.name)}`}>
                            <div className="aspect-[3/4] rounded-[1.5rem] overflow-hidden bg-[#eef1f6] flex items-center justify-center p-6 shadow-inner border border-black/5 relative">
                              {sub.image ? (
                                <img
                                  src={sub.image}
                                  alt={sub.name}
                                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-700 ease-out mix-blend-multiply drop-shadow-xl"
                                />
                              ) : (
                                <div className="text-gray-400 font-semibold uppercase">NO IMAGE</div>
                              )}

                              {/* Wishlist Toggle Button on Subcategory Card */}
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (selectedCategory) {
                                    toggleSubcategoryWishlist(selectedCategory, sub.name);
                                  }
                                }}
                                className="absolute top-3 right-3 w-10 h-10 bg-white/80 backdrop-blur-xl border border-white/60 rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:text-red-500 hover:bg-white transition-all z-20"
                                title={isWishlisted ? "Remove Subcategory from Wishlist" : "Add Subcategory to Wishlist"}
                              >
                                <Heart
                                  size={18}
                                  fill={isWishlisted ? "#ef4444" : "none"}
                                  className={isWishlisted ? "text-red-500" : "text-gray-600"}
                                />
                              </button>
                            </div>
                          </Link>
                        </div>
                        <Link href={`/gallery?category=${encodeURIComponent(selectedCategory || '')}&subcategory=${encodeURIComponent(sub.name)}`} className="flex-1 flex flex-col">
                          <div className="rounded-[2rem] relative mx-3 mt-2 mb-3 p-4 sm:p-5 bg-gradient-to-br from-white/60 to-white/30 backdrop-blur-3xl border border-white/60 shadow-[0_8px_64px_rgba(0,0,0,0.1)] flex flex-col flex-1 z-10">
                            <h3 className="text-xl font-extrabold text-[#0f172a] uppercase tracking-wide group-hover:text-[#1e3a8a] transition-colors drop-shadow-sm line-clamp-1 mb-2">
                              {sub.name}
                            </h3>
                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-black/5 gap-2">
                              <div>
                                <span className="text-[#0f172a] font-bold text-sm block uppercase">{sub.count} PRODUCTS</span>
                                <span className="text-xs text-gray-500 font-medium uppercase">AVAILABLE</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); router.push(`/view?category=${encodeURIComponent(selectedCategory || '')}&subcategory=${encodeURIComponent(sub.name)}`); }}
                                  className="p-2.5 bg-[#0f172a] text-white rounded-full shadow-md hover:bg-[#1e293b] transition-all active:scale-90"
                                  title={`Shop ${sub.name} products`}
                                >
                                  <ShoppingCart size={15} />
                                </button>
                                <div className="flex items-center gap-1 text-sm font-bold text-[#0f172a] group-hover:text-[#1e3a8a] transition-colors bg-white/50 px-4 py-2 rounded-full">
                                  VIEW GALLERY <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {((!selectedCategory && filteredCategories.length === 0) ||
            (selectedCategory && filteredSubcategories.length === 0)) && (
              <div className="text-center py-20 bg-white/10 backdrop-blur-md rounded-3xl border border-white/40 mt-8">
                <p className="text-xl text-gray-500 font-bold uppercase">NO RESULTS FOUND MATCHING YOUR CRITERIA</p>
              </div>
            )}
        </div>
      </main>
    </>
  );
}
