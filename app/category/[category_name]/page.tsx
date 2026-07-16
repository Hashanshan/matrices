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
      <main className="min-h-screen bg-[#f3f4f6] pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
          
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 bg-white p-6 shadow-sm">
                {products.map((product, idx) => (
                  <motion.div
                    key={`${product.id}-${idx}`}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                    className="flex flex-col group cursor-pointer"
                  >
                    {/* Image Area */}
                    <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center p-4 mb-4 border border-gray-100 overflow-hidden relative">
                       <img 
                          src={product.image} 
                          alt={product.name}
                          className="max-h-full max-w-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
                       />
                    </div>
                    
                    {/* Product Details */}
                    <div className="flex-1 flex flex-col">
                      <h3 className="text-lg font-bold text-gray-900 leading-tight">{product.name}</h3>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        {product.id.startsWith('MAT') ? product.id : `MAT-${1000 + parseInt(product.id)}`}
                      </p>
                      
                      <p className="text-xs text-gray-600 line-clamp-3 mb-3 flex-1">
                        {product.description}
                      </p>

                      {/* Feature Icon Row (Simulating the small icon with text) */}
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 rounded-full bg-[#1e3a6e]/10 flex items-center justify-center text-[#1e3a6e]">
                          {idx % 2 === 0 ? <Edit3 size={12} /> : <CheckCircle2 size={12} />}
                        </div>
                        <span className="text-xs font-medium text-gray-700">
                          {idx % 2 === 0 ? 'Smooth Ink' : 'Ergonomic Grip'}
                        </span>
                      </div>

                      {/* Bottom Row: Price and QR Code */}
                      <div className="flex items-center justify-between mt-auto border-t border-gray-100 pt-3">
                        <span className="text-lg font-extrabold text-gray-900">{formatPrice(product.price)}</span>
                        <QRCodePlaceholder />
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
