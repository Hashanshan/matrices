'use client';

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Search, ChevronRight, ArrowLeft, Heart, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useFilters } from '@/lib/hooks/use-products';
import { useWishlist } from '@/lib/contexts/wishlist-context';
import { useSync } from '@/lib/contexts/sync-context';
import SmartImage from '@/components/smart-image';
import BackButton from '@/components/back-button';
import { useBackHandler, triggerBack } from '@/lib/utils/back-navigation';
import { prewarmImageCache } from '@/lib/offline/image-cache';

export default function CategoriesPage({ fallbackData }: { fallbackData?: any } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { executeSync, isSyncing } = useSync();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Auto-start sync if arriving with startSync param (e.g. after different user login confirmation)
  useEffect(() => {
    if (searchParams.get('startSync') === 'true' && !isSyncing) {
      router.replace('/catalogue');
      const timer = setTimeout(() => {
        executeSync('full');
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [searchParams, isSyncing, executeSync, router]);

  // Fetch filters (categories, subcategories) from API with fallbackData
  const { categories, isLoading, isValidating, mutate: mutateFilters } = useFilters({ fallbackData });

  useEffect(() => {
    prewarmImageCache().catch(() => {});
    if (categories && categories.length > 0) {
      const urls: string[] = [];
      categories.forEach((c) => {
        if (c.image) urls.push(c.image);
        if (c.subcategories) {
          c.subcategories.forEach((s) => {
            if (s.image) urls.push(s.image);
          });
        }
      });
      if (urls.length > 0 && typeof window !== 'undefined') {
        urls.forEach((url) => {
          if (url) {
            const img = new window.Image();
            img.src = url;
          }
        });
      }
    }
  }, [categories]);

  // Intercept back button when subcategories are selected to step back to category list first
  useBackHandler(() => {
    if (selectedCategory !== null) {
      setSelectedCategory(null);
      setSearchQuery('');
      return true;
    }
    return false;
  }, selectedCategory !== null);

  // Access wishlist state and toggles
  const {
    wishlist,
    isCategoryWishlisted,
    isSubcategoryWishlisted,
    toggleCategoryWishlist,
    toggleSubcategoryWishlist,
    mutate: mutateWishlist,
  } = useWishlist();

  // Automatically trigger background revalidation of both wishlist and filters on mount
  useEffect(() => {
    mutateWishlist().catch(() => {});
    mutateFilters().catch(() => {});
  }, [mutateWishlist, mutateFilters]);

  const selectedCategoryObj = useMemo(() => {
    if (!selectedCategory) return null;
    return categories.find(c => c.name.toUpperCase() === selectedCategory.toUpperCase());
  }, [selectedCategory, categories]);

  // Filtering & Wishlist Priority Sorting for top-level categories
  // Wishlisted categories show FIRST (ordered by wishlist order index), then non-wishlisted (A-Z)
  const filteredCategories = useMemo(() => {
    const wishlistedMap = new Map<string, number>();
    (wishlist.categories || []).forEach((c, idx) => {
      const cName = typeof c === 'string' ? c : (c as any)?.name || (c as any)?.categoryName || '';
      if (cName) wishlistedMap.set(cName.toUpperCase(), (c as any)?.order ?? idx);
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
      .filter(s => {
        const sCat = typeof s === 'object' ? (s as any)?.category || (s as any)?.categoryName : '';
        return sCat && String(sCat).toUpperCase() === parentCatName;
      })
      .forEach((s, idx) => {
        const sName = typeof s === 'string' ? s : (s as any)?.name || (s as any)?.subcategoryName || '';
        if (sName) wishlistedMap.set(String(sName).toUpperCase(), (s as any)?.order ?? idx);
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
              {/* <BackButton
                label={selectedCategory ? "Categories" : "Back"}
                onClick={selectedCategory ? () => {
                  setSelectedCategory(null);
                  setSearchQuery('');
                } : undefined}
              /> */}
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
                              <SmartImage
                                src={cat.image}
                                alt={cat.name}
                                fill
                                priority={index < 6 || isWishlisted}
                                className="object-contain p-4 group-hover:scale-105 transition-transform duration-700 ease-out mix-blend-multiply drop-shadow-xl"
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
                            <div className="flex items-center gap-1 text-sm font-bold text-[#0f172a] group-hover:text-[#1e3a8a] transition-colors bg-white/50 px-4 py-2 rounded-full">
                              EXPLORE <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
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
                      <div
                        onClick={() => router.push(`/gallery?category=${encodeURIComponent(selectedCategory || '')}&subcategory=${encodeURIComponent(sub.name)}`)}
                        className="relative rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col bg-white/20 backdrop-blur-2xl overflow-hidden border border-white/60 h-full cursor-pointer"
                      >
                        <div className="p-3 sm:p-4 pb-0 flex flex-col z-0">
                          <div className="aspect-[3/4] rounded-[1.5rem] overflow-hidden bg-[#eef1f6] flex items-center justify-center p-6 shadow-inner border border-black/5 relative">
                            {sub.image ? (
                              <SmartImage
                                src={sub.image}
                                alt={sub.name}
                                fill
                                priority={index < 6 || isWishlisted}
                                className="object-contain p-4 group-hover:scale-105 transition-transform duration-700 ease-out mix-blend-multiply drop-shadow-xl"
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
                        </div>
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
                              <div className="flex items-center gap-1 text-sm font-bold text-[#0f172a] group-hover:text-[#1e3a8a] transition-colors bg-white/50 px-4 py-2 rounded-full">
                                VIEW PRODUCTS <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                              </div>
                            </div>
                          </div>
                        </div>
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
