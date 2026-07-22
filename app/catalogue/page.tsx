'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/header';
import { useAuth } from '@/lib/contexts/auth-context';
import { Search, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Product } from '@/lib/types';

export default function CategoriesPage() {
  const { isLoggedIn, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState('All Categories (Active)');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchProducts = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/catelogue/products', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!res.ok) {
          throw new Error('Failed to fetch catalogue data');
        }

        const data = await res.json();
        setProducts(data.data || []);
      } catch (err: any) {
        console.error('Error fetching products:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [isLoggedIn]);

  // Dynamically generate category groups (backend 'categories') and items (backend 'subcategories')
  const { CATEGORY_GROUPS, CATEGORIES_DATA } = useMemo(() => {
    const groups = new Set<string>();
    groups.add('All Categories (Active)');
    
    const catsMap = new Map<string, { id: string, name: string, description: string, productCount: number, image: string, group: string }>();

    products.forEach(p => {
      const groupName = p.categories || 'Uncategorized';
      const itemName = p.subcategories || groupName;
      groups.add(groupName);

      if (!catsMap.has(itemName)) {
        catsMap.set(itemName, {
          id: itemName.toLowerCase().replace(/\s+/g, '-'),
          name: itemName,
          description: `Explore products in ${itemName}`,
          productCount: 1,
          image: p.image || '/placeholder.png', // Use first product's image
          group: groupName
        });
      } else {
        const existing = catsMap.get(itemName)!;
        existing.productCount += 1;
        // Optionally update image if placeholder
      }
    });

    return {
      CATEGORY_GROUPS: Array.from(groups),
      CATEGORIES_DATA: Array.from(catsMap.values())
    };
  }, [products]);

  const filteredCategories = CATEGORIES_DATA.filter((cat) => {
    const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = activeGroup === 'All Categories (Active)' || cat.group === activeGroup;
    return matchesSearch && matchesGroup;
  });

  if (loading) {
    return (
      <>
        <Header showSearch={false} />
        <main className="min-h-screen bg-transparent py-8 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header showSearch={false} />
        <main className="min-h-screen bg-transparent py-8 flex justify-center items-center">
          <div className="text-red-500 font-bold">{error}</div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-transparent py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Search Bar */}
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-12 pr-4 py-4 border border-white/60 rounded-2xl leading-5 bg-white/40 backdrop-blur-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f172a] sm:text-sm shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] transition-all placeholder:text-gray-500"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Group Pills */}
          <div className="flex overflow-x-auto gap-3 pb-4 mb-4 no-scrollbar">
            {CATEGORY_GROUPS.map((group) => (
              <button
                key={group}
                onClick={() => setActiveGroup(group)}
                className={`whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-bold transition-all border ${activeGroup === group
                  ? 'bg-white/70 text-[#0f172a] shadow-md border-white/80'
                  : 'bg-white/30 backdrop-blur-md text-gray-600 hover:text-[#0f172a] shadow-sm hover:shadow-md border-white/40'
                  }`}
              >
                {group}
              </button>
            ))}
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCategories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="relative group"
              >
                <Link href={`/gallery?category=${encodeURIComponent(category.name)}`}>
                  <div className="relative rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col bg-white/20 backdrop-blur-2xl overflow-hidden border border-white/60 h-full cursor-pointer">

                    <div className="p-3 sm:p-4 pb-0 flex flex-col z-0">
                      {/* Image Container */}
                      <div className="aspect-[3/4] rounded-[1.5rem] overflow-hidden bg-[#eef1f6] flex items-center justify-center p-6 shadow-inner border border-black/5">
                        <img
                          src={category.image}
                          alt={category.name}
                          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-700 ease-out mix-blend-multiply drop-shadow-xl"
                        />
                      </div>
                    </div>

                    {/* Glass Text Container */}
                    <div className="rounded-[2rem] relative mx-3 mt-2 mb-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-white/60 to-white/30 backdrop-blur-3xl border border-white/60 shadow-[0_8px_64px_rgba(0,0,0,0.1)] flex flex-col flex-1 z-10">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-xl font-extrabold text-[#0f172a] uppercase tracking-wide group-hover:text-[#1e3a8a] transition-colors drop-shadow-sm">{category.name}</h3>
                        <span className="text-[0.65rem] font-bold tracking-wider uppercase bg-[#eef1f6] text-gray-600 px-2 py-1 rounded-full border border-black/5 shadow-inner whitespace-nowrap">
                          {category.group}
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 font-medium mb-3">{category.description}</p>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[#0f172a] font-bold text-sm block">{category.productCount} Products</span>
                          <span className="text-xs text-gray-500 font-medium">Available Items</span>
                        </div>

                        <div className="flex items-center gap-1 text-sm font-bold text-[#0f172a] group-hover:text-[#1e3a8a] transition-colors">
                          View Details <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {filteredCategories.length === 0 && (
            <div className="text-center py-20">
              <p className="text-xl text-gray-500 font-medium">No categories found.</p>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
