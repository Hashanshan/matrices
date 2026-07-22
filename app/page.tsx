'use client';

import { useState } from 'react';
import Header from '@/components/header';
import { useAuth } from '@/lib/contexts/auth-context';
import LoginForm from '@/components/login-form';
import { Search, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

// Mock category data to match the design provided
const CATEGORY_GROUPS = ['All Categories (Active)', 'Fashion Accessories', 'Office Essentials', 'School Supplies', 'New Collection'];

const CATEGORIES_DATA = [
  {
    id: 'belts',
    name: 'Belts',
    description: 'Quality accessories for attire.',
    productCount: 110,
    image: '/46134.png',
    group: 'Fashion Accessories'
  },
  {
    id: 'wallets',
    name: 'Wallets',
    description: 'Compact organization for daily use.',
    productCount: 125,
    image: '/46135.png',
    group: 'Fashion Accessories'
  },
  {
    id: 'office-supplies',
    name: 'Office Supplies',
    description: 'Equipping professional environments.',
    productCount: 220,
    image: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&h=400&fit=crop',
    group: 'Office Essentials'
  },
  {
    id: 'school-supplies',
    name: 'School Supplies',
    description: 'Gear for learning and growth.',
    productCount: 250,
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=400&fit=crop',
    group: 'School Supplies'
  },
  {
    id: 'files-folders',
    name: 'Files & Folders',
    description: 'Efficient document management solutions.',
    productCount: 190,
    image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=400&fit=crop',
    group: 'Office Essentials'
  },
  {
    id: 'gift-items',
    name: 'Gift Items',
    description: 'Unique and thoughtful presents.',
    productCount: 105,
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=400&fit=crop',
    group: 'New Collection'
  }
];

export default function CategoriesPage() {
  const { isLoggedIn } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState('All Categories (Active)');

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center min-h-screen px-4"
        >
          <div className="w-full max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center mb-12"
            >
              <h1 className="text-5xl font-bold text-foreground mb-4">Welcome to Matrices</h1>
              <p className="text-xl text-muted-foreground">
                Please log in to view categories
              </p>
            </motion.div>
            <LoginForm />
          </div>
        </motion.div>
      </main>
    );
  }

  const filteredCategories = CATEGORIES_DATA.filter((cat) => {
    const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = activeGroup === 'All Categories (Active)' || cat.group === activeGroup;
    return matchesSearch && matchesGroup;
  });

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
                {/* Stacked glass layers behind the card */}
                {/* <div className="absolute -bottom-4 inset-x-6 h-10 bg-white/30 backdrop-blur-md rounded-b-[2rem] border-b border-white/40 -z-20 shadow-md" /> */}
                {/* <div className="absolute -bottom-2 inset-x-3 h-10 bg-white/40 backdrop-blur-xl rounded-b-[2rem] border-b border-white/50 -z-10 shadow-lg" /> */}

                <Link href={`/category/${encodeURIComponent(category.name)}`}>
                  <div className="relative rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col bg-white/20 backdrop-blur-2xl overflow-hidden border border-white/60 h-full cursor-pointer">

                    <div className="p-3 sm:p-4 pb-0 flex flex-col z-0">
                      {/* Image Container (solid off-white) */}
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
