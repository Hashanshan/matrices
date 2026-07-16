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
        whileHover={{ y: -8 }}
        className="group h-full min-w-0"
      >
        <div className="relative overflow-hidden border border-white/40 hover:border-white/80 transition-all duration-300 h-full shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] flex flex-col bg-white/40 backdrop-blur-xl text-gray-900 rounded-2xl before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/40 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500">
          {/* Image Container */}
          <div className="relative w-full h-56 sm:h-72 overflow-hidden bg-white/20 p-4 border-b border-white/30 z-10">
            <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent z-10 pointer-events-none"></div>
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />

            {/* Badge */}
            {product.inStock && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="absolute top-4 right-4 bg-gradient-to-r from-accent to-accent/80 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg"
              >
                In Stock
              </motion.div>
            )}

            {/* Overlay Actions */}
            <motion.div
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-end justify-between p-4 opacity-0 transition-opacity duration-300"
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleQuickAdd}
                className="bg-white text-foreground px-6 py-3 rounded-full font-semibold flex items-center gap-2 shadow-lg hover:bg-accent hover:text-white transition-colors"
              >
                <ShoppingCart size={18} />
                Quick Add
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleFavorite}
                className={`p-3 rounded-full shadow-lg transition-all ${
                  isFavorite
                    ? 'bg-red-500 text-white'
                    : 'bg-white/90 text-foreground hover:bg-red-500 hover:text-white'
                }`}
              >
                <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
              </motion.button>
            </motion.div>
          </div>

          {/* Content */}
          <div className="p-5 flex flex-col h-48">
            {/* Title */}
            <Link href={`/product/${product.id}`} className="group/link block">
              <h3 className="font-bold text-primary text-base sm:text-lg leading-tight line-clamp-2 mb-2 group-hover/link:text-accent transition-colors">
                {product.name}
              </h3>
            </Link>

            {/* Rating */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={`${
                      i < Math.floor(product.rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-muted-foreground">{product.rating}</span>
              <span className="text-xs text-muted-foreground">({product.reviews})</span>
            </div>

            {/* Category & Subcategory */}
            <div className="flex items-center gap-2 mb-auto">
              <p className="text-xs font-medium text-accent/70 uppercase tracking-widest">
                {product.category}
              </p>
              {product.subcategory && (
                <>
                  <span className="text-accent/40">•</span>
                  <p className="text-xs font-medium text-accent/60 uppercase tracking-widest">
                    {product.subcategory}
                  </p>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-4">
              <div>
                <p className="text-lg font-black text-accent">{formatPrice(product.price)}</p>
              </div>
              <Link
                href={`/product/${product.id}`}
                className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-accent"
              >
                <Eye size={20} />
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
