'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Search, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useFilters } from '@/lib/hooks/use-products';

export default function CategoriesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All Categories');
  const [activeSubcategory, setActiveSubcategory] = useState<string>('All');

  // Fetch filters (categories, subcategories) from our new API
  const { categories, isLoading, isValidating } = useFilters();

  const CATEGORY_GROUPS = ['All Categories', ...categories.map(c => c.name)];

  const selectedCategoryObj = categories.find(c => c.name === activeCategory);
  
  // If a specific category is selected, we show its subcategories.
  // If 'All Categories' is selected, we gather all subcategories from all categories.
  const subcategoriesToDisplay = useMemo(() => {
    let subs: any[] = [];
    if (activeCategory === 'All Categories') {
      categories.forEach(c => {
        c.subcategories.forEach(s => {
          subs.push({ ...s, group: c.name });
        });
      });
    } else if (selectedCategoryObj) {
      subs = selectedCategoryObj.subcategories.map(s => ({ ...s, group: selectedCategoryObj.name }));
    }
    return subs;
  }, [activeCategory, categories, selectedCategoryObj]);

  const filteredSubcategories = subcategoriesToDisplay.filter((sub) => {
    const matchesSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          sub.group.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubTab = activeSubcategory === 'All' || sub.name === activeSubcategory;
    return matchesSearch && matchesSubTab;
  });

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

          {/* Category Pills (Top Level) */}
          <div className="flex overflow-x-auto gap-3 pb-4 mb-4 no-scrollbar">
            {CATEGORY_GROUPS.map((group) => (
              <button
                key={group}
                onClick={() => {
                  setActiveCategory(group);
                  setActiveSubcategory('All'); // Reset subcategory tab when category changes
                }}
                className={`whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-bold transition-all border ${
                  activeCategory === group
                    ? 'bg-white/70 text-[#0f172a] shadow-md border-white/80'
                    : 'bg-white/30 backdrop-blur-md text-gray-600 hover:text-[#0f172a] shadow-sm hover:shadow-md border-white/40'
                }`}
              >
                {group}
              </button>
            ))}
          </div>

          {/* Subcategory Tabs (Secondary Level) - Only show if a specific category with subcategories is selected */}
          {activeCategory !== 'All Categories' && selectedCategoryObj && selectedCategoryObj.subcategories.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex flex-wrap gap-2 mb-6 p-2 bg-white/20 backdrop-blur-md rounded-2xl border border-white/40"
            >
              <button
                onClick={() => setActiveSubcategory('All')}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeSubcategory === 'All'
                    ? 'bg-[#0f172a] text-white shadow-md'
                    : 'bg-white/40 text-gray-700 hover:bg-white/60'
                }`}
              >
                All
              </button>
              {selectedCategoryObj.subcategories.map(sub => (
                <button
                  key={sub.name}
                  onClick={() => setActiveSubcategory(sub.name)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeSubcategory === sub.name
                      ? 'bg-[#0f172a] text-white shadow-md'
                      : 'bg-white/40 text-gray-700 hover:bg-white/60'
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </motion.div>
          )}

          {/* Search Bar */}
          <div className="relative mb-8 mt-2">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-12 pr-4 py-4 border border-white/60 rounded-2xl leading-5 bg-white/40 backdrop-blur-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f172a] sm:text-sm shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] transition-all placeholder:text-gray-500"
              placeholder="Search categories and collections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Subcategories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredSubcategories.map((sub, index) => (
              <motion.div
                key={`${sub.group}-${sub.name}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="relative group"
              >
                <Link href={`/gallery?category=${encodeURIComponent(sub.group)}&subcategory=${encodeURIComponent(sub.name)}`}>
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
                          <div className="text-gray-400 font-semibold">No Image</div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-[2rem] relative mx-3 mt-2 mb-3 p-4 sm:p-5 bg-gradient-to-br from-white/60 to-white/30 backdrop-blur-3xl border border-white/60 shadow-[0_8px_64px_rgba(0,0,0,0.1)] flex flex-col flex-1 z-10">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-xl font-extrabold text-[#0f172a] uppercase tracking-wide group-hover:text-[#1e3a8a] transition-colors drop-shadow-sm line-clamp-1">
                          {sub.name}
                        </h3>
                        <span className="text-[0.65rem] font-bold tracking-wider uppercase bg-[#eef1f6] text-gray-600 px-2 py-1 rounded-full border border-black/5 shadow-inner whitespace-nowrap">
                          {sub.group}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-medium mb-3">Explore items in {sub.name}</p>
                      <div className="flex items-center justify-between mt-auto">
                        <div>
                          <span className="text-[#0f172a] font-bold text-sm block">{sub.count} Products</span>
                          <span className="text-xs text-gray-500 font-medium">Available</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm font-bold text-[#0f172a] group-hover:text-[#1e3a8a] transition-colors bg-white/50 px-3 py-1.5 rounded-full">
                          View <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {filteredSubcategories.length === 0 && (
            <div className="text-center py-20">
              <p className="text-xl text-gray-500 font-medium">No collections found matching your criteria.</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
