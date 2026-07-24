'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Search, ChevronRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFilters } from '@/lib/hooks/use-products';

export default function CategoriesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch filters (categories, subcategories) from our new API
  const { categories, isLoading, isValidating } = useFilters();

  const selectedCategoryObj = useMemo(() => {
    if (!selectedCategory) return null;
    return categories.find(c => c.name.toUpperCase() === selectedCategory.toUpperCase());
  }, [selectedCategory, categories]);

  // Filtering for top-level categories, sorted A-Z
  const filteredCategories = useMemo(() => {
    return categories
      .filter(c => c.name.toUpperCase().includes(searchQuery.toUpperCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, searchQuery]);

  // Filtering for subcategories of the selected category, sorted A-Z
  const filteredSubcategories = useMemo(() => {
    if (!selectedCategoryObj) return [];
    return selectedCategoryObj.subcategories
      .filter(s => s.name.toUpperCase().includes(searchQuery.toUpperCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedCategoryObj, searchQuery]);

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
      <main className="min-h-screen bg-transparent py-8">
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
          <div className="relative mb-8 ">
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
              // Categories View
              <motion.div
                key="categories"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {filteredCategories.map((cat, index) => (
                  <motion.div
                    key={cat.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    whileHover={{ y: -5 }}
                    className="relative group"
                    onClick={() => {
                      if (cat.subcategories && cat.subcategories.length > 0) {
                        setSelectedCategory(cat.name.toUpperCase());
                        setSearchQuery('');
                      } else {
                        router.push(`/gallery?category=${encodeURIComponent(cat.name)}`);
                      }
                    }}
                  >
                    <div className="relative rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col bg-white/20 backdrop-blur-2xl overflow-hidden border border-white/60 h-full cursor-pointer">
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
                        </div>
                      </div>
                      <div className="rounded-[2rem] relative mx-3 mt-2 mb-3 p-4 sm:p-5 bg-gradient-to-br from-white/60 to-white/30 backdrop-blur-3xl border border-white/60 shadow-[0_8px_64px_rgba(0,0,0,0.1)] flex flex-col flex-1 z-10">
                        <h3 className="text-xl font-extrabold text-[#0f172a] uppercase tracking-wide group-hover:text-[#1e3a8a] transition-colors drop-shadow-sm line-clamp-1 mb-2">
                          {cat.name}
                        </h3>
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-black/5">
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
                ))}
              </motion.div>
            ) : (
              // Subcategories View (Under selected category)
              <motion.div
                key="subcategories"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {filteredSubcategories.map((sub, index) => (
                  <motion.div
                    key={sub.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    whileHover={{ y: -5 }}
                    className="relative group"
                  >
                    <Link href={`/gallery?category=${encodeURIComponent(selectedCategory)}&subcategory=${encodeURIComponent(sub.name)}`}>
                      <div className="relative rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col bg-white/20 backdrop-blur-2xl overflow-hidden border border-white/60 h-full cursor-pointer">
                        <div className="p-3 sm:p-4 pb-0 flex flex-col z-0">
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
                          </div>
                        </div>
                        <div className="rounded-[2rem] relative mx-3 mt-2 mb-3 p-4 sm:p-5 bg-gradient-to-br from-white/60 to-white/30 backdrop-blur-3xl border border-white/60 shadow-[0_8px_64px_rgba(0,0,0,0.1)] flex flex-col flex-1 z-10">
                          <h3 className="text-xl font-extrabold text-[#0f172a] uppercase tracking-wide group-hover:text-[#1e3a8a] transition-colors drop-shadow-sm line-clamp-1 mb-2">
                            {sub.name}
                          </h3>
                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-black/5">
                            <div>
                              <span className="text-[#0f172a] font-bold text-sm block uppercase">{sub.count} PRODUCTS</span>
                              <span className="text-xs text-gray-500 font-medium uppercase">AVAILABLE</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm font-bold text-[#0f172a] group-hover:text-[#1e3a8a] transition-colors bg-white/50 px-4 py-2 rounded-full">
                              VIEW GALLERY <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
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
