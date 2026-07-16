'use client';

import { useState } from 'react';
import { Product } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Check, ShoppingCart, ZoomIn } from 'lucide-react';
import { useCart } from '@/lib/contexts/cart-context';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/currency';
import Image from 'next/image';

interface QuickAddModalProps {
  isOpen: boolean;
  product: Product;
  onClose: () => void;
}

export default function QuickAddModal({ isOpen, product, onClose }: QuickAddModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(product.variants?.colors[0]?.name || '');
  const [selectedSize, setSelectedSize] = useState(product.variants?.sizes[0]?.name || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const { addToCart } = useCart();

  const handleAddToCart = async () => {
    setIsSubmitting(true);
    
    const cartItem = {
      id: `${product.id}-${Date.now()}`,
      ...product,
      quantity,
      selectedColor,
      selectedSize,
      notes,
    };

    addToCart(cartItem);
    setShowSuccess(true);

    setTimeout(() => {
      setShowSuccess(false);
      setQuantity(1);
      setSelectedColor(product.variants?.colors[0]?.name || '');
      setSelectedSize(product.variants?.sizes[0]?.name || '');
      setNotes('');
      setIsSubmitting(false);
      onClose();
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-auto md:w-full md:max-w-4xl z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-card w-full max-h-full rounded-2xl md:rounded-3xl border border-border overflow-hidden shadow-2xl flex flex-col md:flex-row pointer-events-auto">
              
              {/* Left Side: Large Image */}
              <div className="w-full md:w-1/2 bg-[#f8f9fc] relative p-8 flex items-center justify-center min-h-[300px] md:min-h-[500px] cursor-zoom-in group" onClick={() => setIsZoomed(true)}>
                {/* Close Button for Mobile (when stacked) */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  className="absolute top-4 right-4 p-2 bg-white/50 hover:bg-white rounded-full transition-colors md:hidden z-10"
                >
                  <X size={20} className="text-gray-800" />
                </motion.button>
                
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-contain p-8 mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                
                <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn size={14} /> Click to zoom
                </div>
              </div>

              {/* Right Side: Product Details & Add to Cart */}
              <div className="w-full md:w-1/2 p-6 md:p-8 overflow-y-auto max-h-[60vh] md:max-h-[80vh]">
                {/* Close Button for Desktop */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="absolute top-6 right-6 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors hidden md:block"
                >
                  <X size={20} className="text-gray-600" />
                </motion.button>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-8 pr-8"
                >
                  <div className="text-sm text-gray-400 font-bold mb-2 uppercase tracking-wider">{product.category}</div>
                  <h3 className="text-2xl md:text-3xl font-black text-[#0f172a] mb-3 leading-tight">{product.name}</h3>
                  <p className="text-3xl md:text-4xl font-black text-accent">{formatPrice(product.price)}</p>
                  
                  {product.description && (
                     <p className="text-gray-500 mt-4 text-sm leading-relaxed">{product.description}</p>
                  )}
                </motion.div>

                <div className="space-y-6">
                  {/* Color Selection */}
                  {product.variants?.colors && product.variants.colors.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                      <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">
                        Color Selection
                      </label>
                      <div className="flex gap-3 flex-wrap">
                        {product.variants.colors.map((color) => (
                          <button
                            key={color.id}
                            onClick={() => setSelectedColor(color.name)}
                            className={`px-4 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                              selectedColor === color.name
                                ? 'border-[#0f172a] bg-[#0f172a] text-white'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {selectedColor === color.name && (
                              <Check size={16} className="inline mr-2" />
                            )}
                            {color.name}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Size Selection */}
                  {product.variants?.sizes && product.variants.sizes.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                      <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">
                        Size Selection
                      </label>
                      <div className="flex gap-3 flex-wrap">
                        {product.variants.sizes.map((size) => (
                          <button
                            key={size.id}
                            onClick={() => setSelectedSize(size.name)}
                            className={`px-4 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${
                              selectedSize === size.name
                                ? 'border-[#0f172a] bg-[#0f172a] text-white'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {selectedSize === size.name && (
                              <Check size={16} className="inline mr-2" />
                            )}
                            {size.name}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Quantity */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">
                      Quantity
                    </label>
                    <div className="flex items-center gap-4 bg-gray-50 border border-gray-100 rounded-xl p-2 w-fit">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="p-2.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-500 hover:text-[#0f172a]"
                      >
                        <Minus size={18} />
                      </button>
                      <span className="text-lg font-bold text-[#0f172a] w-8 text-center">{quantity}</span>
                      <button
                        onClick={() => setQuantity(quantity + 1)}
                        className="p-2.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-500 hover:text-[#0f172a]"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </motion.div>

                  {/* Special Notes */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                    <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">
                      Special Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any special requirements..."
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-[#0f172a] font-medium placeholder-gray-400 focus:outline-none focus:border-[#0f172a] focus:bg-white transition-colors resize-none h-24"
                    />
                  </motion.div>
                </div>

                {/* Success / Action Area */}
                <div className="mt-8 pt-6 border-t border-gray-100">
                  {showSuccess ? (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 justify-center text-green-700 font-bold"
                    >
                      <Check size={20} />
                      <span>Added to cart successfully!</span>
                    </motion.div>
                  ) : (
                    <div className="flex gap-4 flex-col sm:flex-row">
                      <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-6 py-4 rounded-xl border-2 border-gray-200 text-gray-600 font-bold hover:border-gray-300 hover:bg-gray-50 transition-all text-center"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddToCart}
                        disabled={isSubmitting}
                        className="flex-1 bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all hover:shadow-lg disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                        ) : (
                          <>
                            <ShoppingCart size={20} />
                            Add to Cart
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </motion.div>

          {/* Full Screen Image Zoom */}
          <AnimatePresence>
             {isZoomed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] bg-white/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
                  onClick={() => setIsZoomed(false)}
                >
                   <button 
                     onClick={() => setIsZoomed(false)}
                     className="absolute top-6 right-6 p-4 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-[70]"
                   >
                     <X size={24} className="text-gray-800" />
                   </button>
                   <div className="relative w-full h-full max-w-6xl max-h-full">
                     <Image
                       src={product.image}
                       alt={product.name}
                       fill
                       className="object-contain"
                       sizes="100vw"
                     />
                   </div>
                </motion.div>
             )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
