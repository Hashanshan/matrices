'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import LoginForm from '@/components/login-form';
import Header from '@/components/header';
import { MOCK_PRODUCTS } from '@/lib/mock-data';
import { Product } from '@/lib/types';
import { motion } from 'framer-motion';
import { formatPrice } from '@/lib/currency';
import { CheckCircle2, Edit3, Type } from 'lucide-react';
import Image from 'next/image';

// QR Code SVG Placeholder Component
const QRCodePlaceholder = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-80">
    <rect width="40" height="40" fill="white"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M0 0H16V16H0V0ZM4 4V12H12V4H4ZM24 0H40V16H24V0ZM28 4V12H36V4H28ZM0 24H16V40H0V24ZM4 28V36H12V28H4ZM20 0H22V6H20V0ZM20 8H22V12H20V8ZM18 14H24V16H18V14ZM26 18H32V20H26V18ZM34 18H40V20H34V18ZM24 22H30V24H24V22ZM32 22H36V24H32V22ZM20 26H28V28H20V26ZM30 26H40V28H30V26ZM22 30H26V32H22V30ZM28 30H32V32H28V30ZM34 30H40V32H34V30ZM20 34H24V40H20V34ZM26 34H36V36H26V34ZM38 34H40V36H38V34ZM26 38H30V40H26V38ZM32 38H40V40H32V38Z" fill="#333333"/>
  </svg>
);

export default function CategoryDetailPage() {
  const params = useParams();
  const { isLoggedIn } = useAuth();
  const rawCategoryName = params.category_name as string;
  const categoryName = decodeURIComponent(rawCategoryName);

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

  return (
    <>
      <Header showSearch={true} />
      <main className="min-h-screen bg-gradient-to-br from-[#e8ecf2] via-[#f0f2f5] to-[#f8fafc] pb-16 relative">
        {/* Decorative background blobs for glass effect */}
        <div className="absolute top-40 left-20 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 pointer-events-none"></div>
        <div className="absolute top-80 right-20 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12 relative z-10">
          
          {Object.entries(groupedProducts).map(([subcat, products]) => (
            <div key={subcat} className="space-y-6">
              
              {/* Distinctive Subcategory Banner matching the design (chevron shape) */}
              <div className="relative h-14 bg-[#1e3a6e] flex items-center shadow-md overflow-hidden pl-8">
                <h2 className="text-2xl font-bold text-white relative z-10 tracking-wide">
                  {subcat}
                </h2>
                {/* Chevron shape cut out on the right using a clip-path or absolute element */}
                <div className="absolute top-0 right-0 h-full w-12 bg-[#f3f4f6]" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%, 100% 50%, 0 0)' }}></div>
                <div className="absolute top-0 right-1 h-full w-12 bg-[#1e3a6e]" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%, 100% 50%, 0 0)' }}></div>
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6 bg-white/30 backdrop-blur-md rounded-b-xl shadow-inner border border-white/40">
                {products.map((product, idx) => (
                  <motion.div
                    key={`${product.id}-${idx}`}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                    className="flex flex-col group cursor-pointer bg-white/50 backdrop-blur-xl rounded-2xl p-5 shadow-[0_4px_16px_0_rgba(31,38,135,0.05)] border border-white/60 hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/50 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500"
                  >
                    {/* Image Area */}
                    <div className="aspect-[4/3] bg-white/40 backdrop-blur-sm shadow-inner rounded-xl flex items-center justify-center p-4 mb-5 border border-white/50 overflow-hidden relative z-10">
                       <img 
                          src={product.image} 
                          alt={product.name}
                          className="max-h-full max-w-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
                       />
                    </div>
                    
                    {/* Product Details */}
                    <div className="flex-1 flex flex-col relative z-10">
                      <h3 className="text-lg font-bold text-gray-900 leading-tight group-hover:text-[#1e3a6e] transition-colors">{product.name}</h3>
                      <p className="text-xs font-semibold text-[#1e3a6e]/70 uppercase tracking-wider mb-2">
                        {product.id.startsWith('MAT') ? product.id : `MAT-${1000 + parseInt(product.id)}`}
                      </p>
                      
                      <p className="text-xs text-gray-700 font-medium line-clamp-3 mb-4 flex-1">
                        {product.description}
                      </p>

                      {/* Feature Icon Row */}
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-full bg-white/70 shadow-sm border border-white flex items-center justify-center text-[#1e3a6e]">
                          {idx % 2 === 0 ? <Edit3 size={14} /> : <CheckCircle2 size={14} />}
                        </div>
                        <span className="text-xs font-bold text-gray-800">
                          {idx % 2 === 0 ? 'Smooth Ink' : 'Ergonomic Grip'}
                        </span>
                      </div>

                      {/* Bottom Row: Price and QR Code */}
                      <div className="flex items-center justify-between mt-auto border-t border-white/60 pt-4">
                        <span className="text-xl font-extrabold text-[#1e3a6e] drop-shadow-sm">{formatPrice(product.price)}</span>
                        <div className="bg-white/80 p-1.5 rounded-lg shadow-sm border border-white">
                          <QRCodePlaceholder />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

            </div>
          ))}

        </div>
      </main>
    </>
  );
}
