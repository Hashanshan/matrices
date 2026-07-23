'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShoppingCart, X, Minus, Plus, Heart, Share2, Star, Check, Search } from 'lucide-react';
import { useCart } from '@/lib/contexts/cart-context';
import { Button } from '@/components/ui/button';
import { Product } from '@/lib/types';
import { formatPrice } from '@/lib/currency';
import QuickAddModal from './quick-add-modal';
import Link from 'next/link';
import { Menu, Home, Grid, BookOpen } from 'lucide-react';

interface FullscreenProductViewerProps {
  products: Product[];
  initialProductId?: string;
}

export default function FullscreenProductViewer({ products, initialProductId }: FullscreenProductViewerProps) {
  // Compute the starting index from the URL's productId
  const startIndex = useMemo(() => {
    if (!initialProductId) return 0;
    const idx = products.findIndex(p => p.productId === initialProductId || p.id === initialProductId);
    return idx >= 0 ? idx : 0;
  }, [initialProductId, products]);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [imageZoomed, setImageZoomed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewerSearchQuery, setViewerSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef(0);
  const { addToCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const { cart } = useCart();

  // Filter products when search is active
  const displayProducts = useMemo(() => {
    if (!viewerSearchQuery.trim()) return products;
    const q = viewerSearchQuery.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.categories || '').toLowerCase().includes(q) ||
      (p.subcategories || '').toLowerCase().includes(q) ||
      (p.productCode || '').toLowerCase().includes(q)
    );
  }, [products, viewerSearchQuery]);

  // Reset index when search results change
  useEffect(() => {
    if (viewerSearchQuery.trim() && displayProducts.length > 0) {
      setCurrentIndex(0);
    }
  }, [displayProducts.length, viewerSearchQuery]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const currentProduct = displayProducts[currentIndex] || displayProducts[0];
  if (!currentProduct) return null;

  const handleSwipe = (newDirection: 'left' | 'right') => {
    setDirection(newDirection);
    if (newDirection === 'right') {
      setCurrentIndex((prev) => (prev === 0 ? displayProducts.length - 1 : prev - 1));
    } else {
      setCurrentIndex((prev) => (prev === displayProducts.length - 1 ? 0 : prev + 1));
    }
    // Reset modal and states on product change
    setIsModalOpen(false);
    setQuantity(1);
    setSelectedColor(null);
    setSelectedSize(null);
    setNotes('');
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleSwipe('left');
      } else {
        handleSwipe('right');
      }
    }
  };

  const handleAddToCart = () => {
    if (!selectedColor && currentProduct.variants?.colors && currentProduct.variants.colors.length > 0) {
      alert('Please select a color');
      return;
    }
    if (!selectedSize && currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0) {
      alert('Please select a size');
      return;
    }

    addToCart({
      ...currentProduct,
      quantity,
      selectedColor: selectedColor || undefined,
      selectedSize: selectedSize || undefined,
      notes: notes || undefined,
    });

    setAddedSuccess(true);

    // Reset modal after success
    setTimeout(() => {
      setIsModalOpen(false);
      setQuantity(1);
      setSelectedColor(null);
      setSelectedSize(null);
      setNotes('');
      setAddedSuccess(false);
    }, 1500);
  };

  const pageFlipVariants = {
    enter: (dir: 'left' | 'right') => ({
      rotateY: dir === 'left' ? -90 : 90,
      opacity: 0,
      scale: 0.95,
      filter: 'brightness(0.8)',
    }),
    center: {
      zIndex: 1,
      rotateY: 0,
      opacity: 1,
      scale: 1,
      filter: 'brightness(1)',
    },
    exit: (dir: 'left' | 'right') => ({
      zIndex: 0,
      rotateY: dir === 'left' ? 45 : -45,
      opacity: 0,
      scale: 0.95,
      filter: 'brightness(0.8)',
    }),
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: currentProduct.name,
        text: `Check out ${currentProduct.name} - ${formatPrice(currentProduct.price)}`,
        url: window.location.href,
      });
    } else {
      alert('Share this product: ' + currentProduct.name);
    }
  };

  return (
    <div className="w-full h-screen bg-transparent overflow-hidden relative max-w-full">
      {/* Full Image Container */}
      <div
        className="w-full h-full flex items-center justify-center relative cursor-move group"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ perspective: 1800, perspectiveOrigin: '50% 50%' }}
      >
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={pageFlipVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              type: 'tween',
              ease: [0.25, 0.46, 0.45, 0.94],
              duration: 0.6,
            }}
            className="absolute inset-0 flex items-center justify-center p-4 sm:p-8"
            style={{
              transformStyle: 'preserve-3d',
              transformOrigin: 'left center',
              backfaceVisibility: 'hidden',
            }}
            onClick={() => setImageZoomed(!imageZoomed)}
          >
            <motion.div
              className="relative w-full h-full"
              animate={imageZoomed ? { scale: 1.1 } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <img
                src={currentProduct.image}
                alt={currentProduct.name}
                className="w-full h-full object-contain rounded-3xl shadow-2xl"
              />
              {/* Zoom hint */}
              <div className="absolute bottom-4 right-4 bg-white/80 text-[#0f172a] px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                Click to zoom
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows - Enhanced */}
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            handleSwipe('right');
          }}
          whileHover={{ scale: 1.1, x: 4 }}
          whileTap={{ scale: 0.95 }}
          className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/60 backdrop-blur-2xl text-[#0f172a] p-3 sm:p-4 rounded-full transition-all z-20 hidden sm:flex items-center justify-center shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] border border-white/60"
        >
          <ChevronLeft size={28} />
        </motion.button>

        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            handleSwipe('left');
          }}
          whileHover={{ scale: 1.1, x: -4 }}
          whileTap={{ scale: 0.95 }}
          className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/60 backdrop-blur-2xl text-[#0f172a] p-3 sm:p-4 rounded-full transition-all z-20 hidden sm:flex items-center justify-center shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] border border-white/60"
        >
          <ChevronRight size={28} />
        </motion.button>

        {/* Product Counter - Enhanced */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-6 left-6 sm:top-8 sm:left-8 bg-white/30 backdrop-blur-2xl text-[#0f172a] px-5 py-2.5 rounded-full shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/60"
        >
          <p className="text-sm font-bold tracking-wider">{String(currentIndex + 1).padStart(2, '0')} / {String(displayProducts.length).padStart(2, '0')}</p>
        </motion.div>

        {/* Action Buttons - Top Right */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-6 sm:top-8 right-6 sm:right-8 flex gap-3 z-20 "
        >
          <motion.button
            onClick={() => setIsLiked(!isLiked)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-3.5 rounded-full bg-white/30 backdrop-blur-2xl hover:bg-white/60 text-[#0f172a] transition-all shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/60"
          >
            <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} className={isLiked ? 'text-red-500' : ''} />
          </motion.button>
          {/* Expandable Search */}
          <motion.div className="flex items-center gap-0">
            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 200, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="overflow-hidden"
                >
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={viewerSearchQuery}
                    onChange={(e) => setViewerSearchQuery(e.target.value)}
                    placeholder="Search products..."
                    className="w-full px-4 py-2.5 text-sm bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full text-[#0f172a] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/30 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSearchOpen(false);
                        setViewerSearchQuery('');
                      }
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              onClick={() => {
                if (searchOpen && viewerSearchQuery) {
                  setViewerSearchQuery('');
                }
                setSearchOpen(!searchOpen);
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={`p-3.5 rounded-full backdrop-blur-2xl text-[#0f172a] transition-all shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/60 ${searchOpen ? 'bg-white/60' : 'bg-white/30 hover:bg-white/60'}`}
            >
              {searchOpen ? <X size={20} /> : <Search size={20} />}
            </motion.button>
          </motion.div>
          <motion.button
            onClick={handleShare}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-3.5 rounded-full bg-white/30 backdrop-blur-2xl hover:bg-white/60 text-[#0f172a] transition-all shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/60"
          >
            <Share2 size={20} />
          </motion.button>
          <motion.div className="relative">
            <motion.button
              onClick={() => setMenuOpen(!menuOpen)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="p-3.5 rounded-full bg-white/30 backdrop-blur-2xl hover:bg-white/60 text-[#0f172a] transition-all shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/60"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </motion.button>

            {/* Expanded Menu */}
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -20, originX: 1, originY: 0 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -20 }}
                  className="absolute top-16 right-0 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] p-4 w-48 flex flex-col gap-2 overflow-hidden"
                >
                  {[
                    { href: '/catalogue', label: 'Home', icon: Home },
                    { href: '/gallery', label: 'Catalogue', icon: BookOpen },
                    { href: '/view', label: 'Products', icon: Grid },
                    { href: '/cart', label: `Cart (${cart.itemCount})`, icon: ShoppingCart },
                  ].map((item) => (
                    <Link href={item.href} key={item.label} onClick={() => setMenuOpen(false)}>
                      <motion.div
                        whileHover={{ x: 4, backgroundColor: 'rgba(0,0,0,0.05)' }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-800 font-semibold text-sm transition-colors cursor-pointer"
                      >
                        <item.icon size={18} />
                        {item.label}
                      </motion.div>
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* Product Info Overlay - Premium */}
        {!imageZoomed && (


          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-32 sm:bottom-40 left-6 sm:left-8 bg-white/40 backdrop-blur-2xl text-[#0f172a] p-6 rounded-[2rem] max-w-sm border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]"
          >
            <h2 className="text-2xl sm:text-3xl font-black mb-2 leading-tight">{currentProduct.name}</h2>
            <p className="text-sm text-gray-500 font-medium line-clamp-2 mb-4">
              {currentProduct.subcategories ? `${currentProduct.categories} > ${currentProduct.subcategories}` : currentProduct.categories}
            </p>

            {/* Rating */}
            {/* <div className="flex items-center gap-2 mb-5">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className={i < Math.floor(currentProduct.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-gray-400">({currentProduct.reviews} reviews)</span>
            </div> */}

            {/* Price & Stock */}
            <div className="flex items-baseline justify-between pt-4 border-t border-gray-100">
              <div>
                <span className="text-3xl font-black text-[#0f172a]">{formatPrice(currentProduct.price)}</span>
                {currentProduct.originalPrice && (
                  <span className="ml-2 text-sm font-semibold text-gray-400 line-through">{formatPrice(currentProduct.originalPrice)}</span>
                )}
              </div>
              {/* <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${currentProduct.inStock
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
                  }`}
              >
                {currentProduct.inStock ? 'In Stock' : 'Out of Stock'}
              </motion.div> */}
            </div>
          </motion.div>

        )}

        {/* Add to Cart Button - Enhanced */}
        {!imageZoomed && (
          <motion.button
            whileHover={{ scale: 1.05, y: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModalOpen(true)}
            disabled={!currentProduct.inStock}
            className="absolute bottom-32 sm:bottom-40 left-1/2 -translate-x-1/2 bg-[#0f172a] hover:bg-[#1e293b] text-white px-8 sm:px-12 py-4 sm:py-5 rounded-full font-bold flex items-center gap-3 shadow-[0_15px_30px_-10px_rgba(15,23,42,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed z-30 text-lg"
          >
            <ShoppingCart size={22} />
            <span>Add to Cart</span>
          </motion.button>
        )}

        {/* Thumbnail Navigation - Bottom */}
        {!imageZoomed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto px-4 max-w-xs sm:max-w-2xl justify-center z-20 hidden sm:flex pb-2"
          >
            {displayProducts.map((product, idx) => (
              <motion.button
                key={product.id}
                onClick={() => {
                  setDirection(idx > currentIndex ? 'left' : 'right');
                  setCurrentIndex(idx);
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className={`flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all backdrop-blur-sm ${idx === currentIndex
                  ? 'border-white shadow-xl ring-2 ring-white/50 scale-110'
                  : 'border-white/40 hover:border-white/80'
                  }`}
              >
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </motion.button>
            ))}
          </motion.div>
        )}

        {/* Swipe Hint - Mobile */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-6 text-white text-xs bg-white/20 px-4 py-2 rounded-full backdrop-blur-sm sm:hidden border border-white/30"
        >
          ← Swipe to browse →
        </motion.div>
      </div>


      {/* </AnimatePresence> */}

      {isModalOpen && (
        <QuickAddModal
          isOpen={isModalOpen}
          product={currentProduct}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
