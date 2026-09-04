'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Product } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Check, ShoppingCart, ZoomIn } from 'lucide-react';
import { useCart } from '@/lib/contexts/cart-context';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/currency';
import SmartImage from './smart-image';
import { getCachedImageUrl } from '@/lib/offline/image-cache';

interface QuickAddModalProps {
  isOpen: boolean;
  product: Product;
  onClose: () => void;
}

export default function QuickAddModal({ isOpen, product, onClose }: QuickAddModalProps) {
  const [quantity, setQuantity] = useState<number | string>(1);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [displayImg, setDisplayImg] = useState<string>(product?.image || product?.imageUrl || '');
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const QUANTITY_PRESETS = [1, 2, 6, 12, 24, 50];

  const PACK_SUGGESTIONS = [
    'Box Pack',
    // 'Poly Pack',
    // '1 Dozen Pack',
    // 'Half Dozen Pack',
    'Mixed Colors',
    // 'Urgent Delivery',
    // 'Sample',
  ];

  const handleToggleSuggestion = (sug: string) => {
    if (!notes.trim()) {
      setNotes(sug);
      return;
    }
    const parts = notes.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.includes(sug)) {
      const filtered = parts.filter((p) => p !== sug);
      setNotes(filtered.join(', '));
    } else {
      setNotes([...parts, sug].join(', '));
    }
  };

  const handleQuantityChange = (val: string) => {
    if (val === '') {
      setQuantity('');
      return;
    }
    const clean = val.replace(/[^0-9]/g, '');
    if (clean === '') {
      setQuantity('');
      return;
    }
    const parsed = parseInt(clean, 10);
    setQuantity(isNaN(parsed) ? '' : parsed);
  };

  const handleQuantityBlur = () => {
    if (quantity === '' || Number(quantity) < 1 || isNaN(Number(quantity))) {
      setQuantity(1);
    }
  };

  const incrementQuantity = () => {
    const current = typeof quantity === 'number' ? quantity : (parseInt(String(quantity), 10) || 1);
    setQuantity(current + 1);
  };

  const decrementQuantity = () => {
    const current = typeof quantity === 'number' ? quantity : (parseInt(String(quantity), 10) || 1);
    setQuantity(Math.max(1, current - 1));
  };

  const { addToCart, getAddToCartButtonLabel, getCartItem, isProductInCart } = useCart();

  const prodKey = product?.productId || product?.id || '';
  const existingCartItem = getCartItem(prodKey);
  const isAlreadyInCart = Boolean(existingCartItem);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Pre-fill quantity, notes, color, size if already in cart & auto-focus/select quantity input
  useEffect(() => {
    if (isOpen && product) {
      const item = getCartItem(product.productId || product.id);
      if (item) {
        setQuantity(item.quantity || 1);
        setNotes(item.notes || '');
        setSelectedColor(item.selectedColor || (product.variants?.colors?.[0]?.name || ''));
        setSelectedSize(item.selectedSize || (product.variants?.sizes?.[0]?.name || ''));
      } else {
        setQuantity(1);
        setNotes('');
        setSelectedColor(product.variants?.colors?.[0]?.name || '');
        setSelectedSize(product.variants?.sizes?.[0]?.name || '');
      }

      // Auto-focus and highlight quantity input immediately for fast typing
      setTimeout(() => {
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
      }, 120);
    }
  }, [isOpen, product, getCartItem]);

  // Listen for global close event when PIN shop modal opens
  useEffect(() => {
    const handleCloseAll = () => {
      onClose();
    };
    window.addEventListener('matrices-close-all-modals', handleCloseAll);
    return () => window.removeEventListener('matrices-close-all-modals', handleCloseAll);
  }, [onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const origBody = document.body.style.overflow;
      const origHtml = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origBody;
        document.documentElement.style.overflow = origHtml;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const raw = product?.image || product?.imageUrl || '';
    if (raw) {
      getCachedImageUrl(raw).then((res) => {
        if (res) setDisplayImg(res);
      });
    } else {
      setDisplayImg('');
    }
  }, [product?.image, product?.imageUrl]);

  const handleAddToCart = async () => {
    setIsSubmitting(true);
    const finalQty = Math.max(1, typeof quantity === 'number' ? quantity : (parseInt(String(quantity), 10) || 1));

    const cartItem = {
      id: `${product.productId || product.id}`,
      ...product,
      quantity: finalQty,
      selectedColor,
      selectedSize,
      notes,
    };

    // Returns false if no shop selected -> triggers PIN shop modal & closes this modal!
    const success = addToCart(cartItem);
    setIsSubmitting(false);

    if (success) {
      onClose();
    } else {
      // Shop selection required -> close modal so PIN modal is alone
      onClose();
    }
  };

  if (!mounted || !product) return null;

  const addToCartBtnText = isAlreadyInCart ? 'UPDATE IN CART' : getAddToCartButtonLabel('ADD TO CART');

  return createPortal(
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
            <div className="bg-card w-full max-h-full rounded-2xl md:rounded-3xl border border-border shadow-2xl flex flex-col md:flex-row pointer-events-auto overflow-y-auto md:overflow-hidden relative">
              {/* Close Button for Mobile */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-md hover:bg-white rounded-full transition-colors md:hidden z-10 shadow-sm"
              >
                <X size={20} className="text-gray-800" />
              </motion.button>

              {/* Left Side: Image */}
              <div className="w-full md:w-1/2 bg-[#f8f9fc] relative p-8 flex items-center justify-center h-[40vh] min-h-[300px] md:h-auto md:min-h-[500px] cursor-zoom-in group shrink-0" onClick={() => setIsZoomed(true)}>
                <SmartImage
                  src={product?.image || product?.imageUrl || ''}
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
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddToCart();
                }}
                className="w-full md:w-1/2 p-6 md:p-8 md:overflow-y-auto md:max-h-[80vh] flex flex-col"
              >
                {/* Close Button for Desktop */}
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-6 right-6 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors hidden md:block cursor-pointer"
                >
                  <X size={20} className="text-gray-600" />
                </button>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-8 pr-8"
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm text-gray-400 font-bold uppercase tracking-wider">{product.category || product.categories}</span>
                    {isAlreadyInCart && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider border border-emerald-300 shadow-xs">
                        <Check size={14} className="stroke-[3]" /> Already in Cart ({existingCartItem?.quantity})
                      </span>
                    )}
                  </div>
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
                            type="button"
                            key={color.id}
                            onClick={() => setSelectedColor(color.name)}
                            className={`px-4 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${selectedColor === color.name
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
                            type="button"
                            key={size.id}
                            onClick={() => setSelectedSize(size.name)}
                            className={`px-4 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${selectedSize === size.name
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

                  {/* Quantity (Fully clearable, typable, numeric keyboard, auto-select & presets) */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Quantity
                      </label>
                      <span className="text-[11px] text-gray-400 font-bold">
                        Click/type or tap preset below
                      </span>
                    </div>

                    {/* Quick Quantity Presets */}
                    {/* <div className="flex flex-wrap gap-1.5 pb-1">
                      {QUANTITY_PRESETS.map((preset) => {
                        const isSelected = Number(quantity) === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setQuantity(preset);
                              quantityInputRef.current?.focus();
                              quantityInputRef.current?.select();
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer border ${isSelected
                                ? 'bg-[#0f172a] text-white border-[#0f172a] shadow-xs'
                                : 'bg-gray-100/80 hover:bg-gray-200 text-gray-700 border-gray-200'
                              }`}
                          >
                            {preset === 12 ? '12 (1 Doz)' : preset === 24 ? '24 (2 Doz)' : preset}
                          </button>
                        );
                      })}
                    </div> */}

                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-2 w-fit">
                      <button
                        type="button"
                        onClick={decrementQuantity}
                        className="p-2.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-500 hover:text-[#0f172a] cursor-pointer"
                      >
                        <Minus size={18} />
                      </button>
                      <input
                        ref={quantityInputRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="go"
                        value={quantity}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleQuantityChange(e.target.value)}
                        onBlur={handleQuantityBlur}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.keyCode === 13) {
                            e.preventDefault();
                            handleAddToCart();
                          }
                        }}
                        placeholder="1"
                        className="w-16 text-center font-black text-lg text-[#0f172a] bg-transparent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={incrementQuantity}
                        className="p-2.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-500 hover:text-[#0f172a] cursor-pointer"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </motion.div>

                  {/* Special Notes & Quick Packaging Suggestions */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Special Notes & Pack
                      </label>
                      {notes && (
                        <button
                          type="button"
                          onClick={() => setNotes('')}
                          className="text-[11px] font-bold text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Quick Suggestion Chips */}
                    <div className="flex flex-wrap gap-1.5 pb-1">
                      {PACK_SUGGESTIONS.map((sug) => {
                        const isSelected = notes.includes(sug);
                        return (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => handleToggleSuggestion(sug)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${isSelected
                              ? 'bg-[#0f172a] text-white border-[#0f172a] shadow-xs'
                              : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                              }`}
                          >
                            {isSelected ? `✓ ${sug}` : `+ ${sug}`}
                          </button>
                        );
                      })}
                    </div>

                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      enterKeyHint="go"
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey) {
                          e.preventDefault();
                          handleAddToCart();
                        }
                      }}
                      placeholder="Type custom note or select packaging above..."
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-[#0f172a] font-medium placeholder-gray-400 focus:outline-none focus:border-[#0f172a] focus:bg-white transition-colors resize-none h-20 text-xs"
                    />
                  </motion.div>
                </div>

                {/* Success / Action Area */}
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <div className="flex gap-4 flex-col sm:flex-row">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isSubmitting}
                      className="px-6 py-4 rounded-xl border-2 border-gray-200 text-gray-600 font-bold hover:border-gray-300 hover:bg-gray-50 transition-all text-center cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all hover:shadow-lg disabled:opacity-50 overflow-hidden cursor-pointer"
                    >
                      {isSubmitting ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                      ) : (
                        <>
                          <ShoppingCart size={18} className="shrink-0" />
                          <span className="truncate whitespace-nowrap inline-block max-w-full text-xs sm:text-sm uppercase font-black">
                            {addToCartBtnText}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </form>
            </div>
          </motion.div>

          {/* Full Screen Image Zoom */}
          <AnimatePresence>
            {isZoomed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-white/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 cursor-zoom-out h-screen max-h-screen overflow-hidden"
                onClick={() => setIsZoomed(false)}
              >
                <button
                  onClick={() => setIsZoomed(false)}
                  className="absolute top-6 right-6 p-4 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-[70]"
                >
                  <X size={24} className="text-gray-800" />
                </button>
                <div className="relative w-full h-full max-w-6xl max-h-[100vh] flex items-center justify-center overflow-hidden">
                  <SmartImage
                    src={product.image || product.imageUrl || ''}
                    alt={product.name}
                    className="w-full h-full max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] max-w-full flex items-center justify-center [&>img]:max-h-[calc(100vh-2rem)] sm:[&>img]:max-h-[calc(100vh-4rem)] [&>img]:w-auto [&>img]:h-auto [&>img]:max-w-full [&>img]:object-contain"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
