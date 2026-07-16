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
      <main className="min-h-screen bg-[#f8f9fc] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Search Bar */}
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-12 pr-4 py-4 border-0 rounded-2xl leading-5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f172a] sm:text-sm shadow-[0_8px_30px_-12px_rgba(0,0,0,0.06)] transition-all placeholder:text-gray-400"
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
                className={`whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                  activeGroup === group
                    ? 'bg-[#0f172a] text-white shadow-md'
                    : 'bg-white text-gray-500 hover:text-[#0f172a] shadow-sm hover:shadow-md'
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
                  <div className="bg-white rounded-[2rem] p-4 sm:p-5 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] transition-all duration-300 group flex flex-col h-full cursor-pointer hover:-translate-y-1">
                    <div className="w-full h-48 sm:h-56 mb-6 rounded-[1.5rem] overflow-hidden bg-[#f8f9fc] flex items-center justify-center p-6">
                      <img 
                        src={category.image} 
                        alt={category.name} 
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-700 ease-out mix-blend-multiply"
                      />
                    </div>
                    <div className="flex-1 flex flex-col px-2 pb-2">
                      <h3 className="text-xl font-black text-[#0f172a] uppercase tracking-wide mb-3 group-hover:text-[#1e3a8a] transition-colors">{category.name}</h3>
                      <p className="text-[15px] text-gray-500 font-medium flex-1 mb-6 leading-relaxed">{category.description}</p>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-[15px] font-semibold text-gray-400">{category.productCount} Products</span>
                        <div className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 group-hover:bg-[#0f172a] group-hover:text-white group-hover:border-[#0f172a] transition-all">
                          <ArrowRight size={18} />
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
