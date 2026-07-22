'use client';

import { useState } from 'react';
import { Product } from '@/lib/types';
import { motion } from 'framer-motion';
import { Star, ShoppingCart, Heart, Eye } from 'lucide-react';
import Image from 'next/image';
import QuickAddModal from './quick-add-modal';
import { formatPrice } from '@/lib/currency';
import { useRouter } from "next/navigation";

interface ProductCardProps {
  product: Product;
  index?: number;
}

export default function ProductCard({ product, index = 0 }: ProductCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const router = useRouter();

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
        className="group h-full min-w-0 flex flex-col relative"
      >
        {/* Layer 2 (Bottom stacked edge) */}
        {/* <div className="absolute -bottom-4 inset-x-6 h-10 bg-white/30 backdrop-blur-md rounded-b-[2rem] border-b border-white/40 -z-20 shadow-md" /> */}
        {/* Layer 1 (Middle stacked edge) */}
        {/* <div className="absolute -bottom-2 inset-x-3 h-10 bg-white/40 backdrop-blur-xl rounded-b-[2rem] border-b border-white/50 -z-10 shadow-lg" /> */}

        {/* Main Card */}
        <div className="relative rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-300 h-full flex flex-col bg-white/20 backdrop-blur-2xl overflow-hidden border border-white/60">

          <div className="p-3 sm:p-4 pb-0 flex flex-col z-0">
            {/* Image Container (solid off-white, not glass) */}
            <div
              onClick={() => router.push(`/view?productId=${product.id}`)}
              className="relative aspect-[4/5] rounded-[1.5rem] overflow-hidden bg-[#eef1f6] flex items-center justify-center p-6 shadow-inner cursor-pointer z-0 border border-black/5"
            >
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-contain w-full h-full p-4 group-hover:scale-105 transition-transform duration-700 ease-out mix-blend-multiply drop-shadow-xl"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />

              {/* Quick Actions overlaying image (subtle) */}
              <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                <button
                  onClick={handleFavorite}
                  className="w-10 h-10 bg-white/70 backdrop-blur-xl border border-white/50 rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:text-red-500 hover:bg-white transition-all"
                >
                  <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
                </button>
                <button
                  onClick={handleQuickAdd}
                  className="w-10 h-10 bg-white/70 backdrop-blur-xl border border-white/50 rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:text-[#0f172a] hover:bg-white transition-all"
                >
                  <ShoppingCart size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Glass Text Container (Overlaying bottom) */}
          <div className="rounded-[2rem] relative mx-3 mt-2 mb-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-white/60 to-white/30 backdrop-blur-3xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] flex flex-col flex-1 z-10 before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/40 before:to-transparent before:rounded-2xl before:-z-10">
            <div className="flex items-start justify-between gap-2 mb-1">
              <button onClick={handleQuickAdd} className="block text-left flex-1">
                <h3 className="font-extrabold text-[#0f172a] text-lg sm:text-xl leading-tight line-clamp-1 group-hover:text-[#1e3a8a] transition-colors drop-shadow-sm">
                  {product.name}
                </h3>
              </button>
              <span className="text-[0.65rem] font-bold tracking-wider uppercase bg-[#eef1f6] text-gray-600 px-2 py-1 rounded-full border border-black/5 shadow-inner">
                {product.category || 'HOROLOGY'}
              </span>
            </div>

            <p className="text-xs text-gray-500 font-medium mb-3">Product Name</p>

            {/* SKU Row */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-[#0f172a] font-bold text-sm block tracking-wide">
                  {product.id.startsWith('MAT') ? product.id : `MAT-${1000 + parseInt(product.id)}`}-N
                </span>
                <span className="text-xs text-gray-500 font-medium">Product Code</span>
              </div>

              <button
                onClick={() => router.push(`/view?productId=${product.id}`)}
                className="flex items-center gap-1 text-sm font-bold text-[#0f172a] hover:text-[#1e3a8a] transition-colors group/btn"
              >
                View Details <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
              </button>
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
