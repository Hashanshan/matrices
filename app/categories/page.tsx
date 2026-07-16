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
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop',
    group: 'Fashion Accessories'
  },
  {
    id: 'wallets',
    name: 'Wallets',
    description: 'Compact organization for daily use.',
    productCount: 125,
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&h=400&fit=crop',
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
      <main className="min-h-screen bg-gradient-to-br from-[#e2e8f0] via-[#f1f5f9] to-[#cbd5e1] py-8 relative">
        {/* Decorative background blobs for glass effect */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-20 animate-blob pointer-events-none"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-20 animate-blob animation-delay-2000 pointer-events-none"></div>
        <div className="absolute -bottom-8 left-40 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-20 animate-blob animation-delay-4000 pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Search Bar */}
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
              <Search className="h-5 w-5 text-gray-500" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-3 border border-white/40 rounded-xl leading-5 bg-white/40 backdrop-blur-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-white/60 focus:border-white sm:text-sm shadow-[0_4px_12px_0_rgba(31,38,135,0.05)] transition-all"
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
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeGroup === group
                    ? 'bg-white/70 backdrop-blur-md text-[#1e3a8a] shadow-[0_4px_12px_0_rgba(31,38,135,0.1)] border border-white'
                    : 'bg-white/20 backdrop-blur-sm text-gray-700 border border-white/30 hover:bg-white/40 hover:border-white/50'
                }`}
              >
                {group}
              </button>
            ))}
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Link href={`/category/${encodeURIComponent(category.name)}`}>
                  <div className="bg-white/40 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/60 hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] hover:border-white transition-all duration-300 group flex flex-col h-full cursor-pointer relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/40 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500">
                    <div className="w-full h-40 sm:h-48 mb-6 rounded-xl overflow-hidden bg-white/50 backdrop-blur-sm shadow-inner flex items-center justify-center p-4 border border-white/30 relative z-10">
                      <img 
                        src={category.image} 
                        alt={category.name} 
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500 mix-blend-multiply drop-shadow-md"
                      />
                    </div>
                    <div className="flex-1 flex flex-col relative z-10">
                      <h3 className="text-xl font-extrabold text-gray-900 mb-2 group-hover:text-[#1e3a8a] transition-colors drop-shadow-sm">{category.name}</h3>
                      <p className="text-sm text-gray-700 font-medium flex-1 mb-4">{category.description}</p>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-sm font-bold text-[#1e3a8a]">{category.productCount} Products</span>
                        <div className="text-gray-500 group-hover:text-[#1e3a8a] group-hover:translate-x-1 transition-all">
                          <ArrowRight size={20} />
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
