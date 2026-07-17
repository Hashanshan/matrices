'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import LoginForm from '@/components/login-form';
import Header from '@/components/header';
import { MOCK_PRODUCTS } from '@/lib/mock-data';
import { Product } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '@/lib/currency';
import { CheckCircle2, Edit3, Type, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import QuickAddModal from '@/components/quick-add-modal';
import ProductCard from '@/components/product-card';

import { useRouter } from "next/navigation";

export default function CategoryDetailPage() {
  const params = useParams();
  const { isLoggedIn } = useAuth();
  const rawCategoryName = params.category_name as string;
  const categoryName = decodeURIComponent(rawCategoryName);
  const router = useRouter();

  // Accordion state - default true for all
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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
                Please log in to view category products
              </p>
            </motion.div>
            <LoginForm />
          </div>
        </motion.div>
      </main>
    );
  }

  // Filter products loosely for demo or show all if empty to simulate the design
  let categoryProducts = MOCK_PRODUCTS.filter(
    (p) => p.category.toLowerCase() === categoryName.toLowerCase()
  );

  // Fallback to show the design layout even if no products exactly match the category name
  if (categoryProducts.length === 0) {
    categoryProducts = [...MOCK_PRODUCTS].slice(0, 8);
  }

  // Group by subcategory
  const groupedProducts = categoryProducts.reduce((acc, product) => {
    const sub = product.subcategory || 'General';
    if (!acc[sub]) {
      acc[sub] = [];
    }
    acc[sub].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  // If there are no groups, create fake ones for the visual layout matching the screenshot
  if (Object.keys(groupedProducts).length < 2) {
    groupedProducts['Writing Instruments'] = [...categoryProducts].slice(0, 4);
    groupedProducts['Notebooks & Paper'] = [...categoryProducts].slice(4, 8);
  }

  const toggleSection = (subcat: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [subcat]: !prev[subcat]
    }));
  };

  return (
    <>
      <Header showSearch={true} />
      <main className="min-h-screen bg-transparent pb-16 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12 relative z-10">

          {Object.entries(groupedProducts).map(([subcat, products]) => {
            const isCollapsed = collapsedSections[subcat];

            return (
              <div key={subcat} className="space-y-6">
                {/* Distinctive Subcategory Banner matching the design */}
                <div
                  className="bg-white/40 backdrop-blur-xl rounded-[1.5rem] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] border border-white/60 flex items-center justify-between p-6 overflow-hidden relative cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => toggleSection(subcat)}
                >
                  <div className="flex items-center gap-4">
                    <motion.div
                      animate={{ rotate: isCollapsed ? -90 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="bg-gray-100 p-2 rounded-full text-gray-500"
                    >
                      <ChevronDown size={20} />
                    </motion.div>
                    <h2 className="text-2xl font-black text-[#0f172a] relative z-10 tracking-wide uppercase">
                      {subcat}
                    </h2>
                  </div>
                  <div className="text-sm font-semibold text-gray-400 bg-gray-50 px-4 py-2 rounded-full">
                    {products.length} {products.length === 1 ? 'Product' : 'Products'}
                  </div>
                </div>

                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      {/* Product Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 py-2">
                        {products.map((product, idx) => (
                          <ProductCard key={`${product.id}-${idx}`} product={product} index={idx} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

        </div>
      </main>

      {/* Quick Add Modal */}
      {selectedProduct && (
        <QuickAddModal
          isOpen={!!selectedProduct}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
}
