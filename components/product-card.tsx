'use client';

import { useState } from 'react';
import { Product } from '@/lib/types';
import { motion } from 'framer-motion';
import { Star, ShoppingCart, Heart, Eye } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import QuickAddModal from './quick-add-modal';
import { formatPrice } from '@/lib/currency';

interface ProductCardProps {
  product: Product;
  index?: number;
}

export default function ProductCard({ product, index = 0 }: ProductCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsModalOpen(true);
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.05 }}
        viewport={{ once: true }}
        whileHover={{ y: -5 }}
        className="group h-full min-w-0 flex flex-col"
      >
        <div className="relative bg-white rounded-[2rem] p-4 sm:p-5 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.08)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.12)] transition-all duration-300 h-full flex flex-col border border-gray-50">
          
          {/* Image Container */}
          <div className="relative w-full h-56 sm:h-64 rounded-[1.5rem] overflow-hidden bg-[#f8f9fc] flex items-center justify-center p-4">
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-contain w-full h-full p-4 group-hover:scale-105 transition-transform duration-700 ease-out mix-blend-multiply"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />

            {/* Quick Actions overlaying image (subtle) */}
            <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
               <button
                onClick={handleFavorite}
                className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full shadow-sm flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-white transition-all"
              >
                <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
              </button>
               <button
                onClick={handleQuickAdd}
                className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full shadow-sm flex items-center justify-center text-gray-600 hover:text-[#0f172a] hover:bg-white transition-all"
              >
                <ShoppingCart size={18} />
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="pt-6 pb-2 px-2 flex flex-col flex-1">
            <Link href={`/product/${product.id}`} className="block">
              <h3 className="font-extrabold text-[#0f172a] text-lg sm:text-xl leading-tight line-clamp-1 group-hover:text-[#1e3a8a] transition-colors">
                {product.name}
              </h3>
            </Link>

            {/* SKU and Colors Row */}
            <div className="flex items-center justify-between mt-2 mb-6">
              <span className="text-gray-400 font-medium text-sm">
                 {product.id.startsWith('MAT') ? product.id : `MAT-${1000 + parseInt(product.id)}`}-N
              </span>
              
              {/* Fake color swatches to match design */}
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-[#1e293b] border-2 border-white outline outline-1 outline-gray-200 shadow-sm"></div>
                <div className="w-5 h-5 rounded-full bg-[#94a3b8] border-2 border-white shadow-sm"></div>
                <div className="w-5 h-5 rounded-full bg-[#333333] border-2 border-white shadow-sm"></div>
              </div>
            </div>

            {/* Footer / Action */}
            <div className="mt-auto flex items-center justify-between">
              <span className="text-xl font-black text-[#0f172a]">{formatPrice(product.price)}</span>
              <Link
                href={`/product/${product.id}`}
                className="bg-[#0f172a] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-[#1e293b] hover:shadow-md transition-all active:scale-95"
              >
                View Details
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={isModalOpen}
        product={product}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
