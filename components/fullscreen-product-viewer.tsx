'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShoppingCart, X, Minus, Plus, Heart, Share2, Search, ArrowLeft } from 'lucide-react';
import { useCart } from '@/lib/contexts/cart-context';
import { Product } from '@/lib/types';
import { formatPrice } from '@/lib/currency';
import QuickAddModal from './quick-add-modal';
import Link from 'next/link';
import { Menu, Home, Grid, BookOpen } from 'lucide-react';

interface FullscreenProductViewerProps {
  products: Product[];
  initialProductId?: string;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
  isLoadingMore: boolean;
  onSearch: (query: string) => void;
}

export default function FullscreenProductViewer({
  products,
  initialProductId,
  totalCount,
  hasMore,
  loadMore,
  isLoadingMore,
  onSearch
}: FullscreenProductViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
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

  // Find index of deep-linked product on initial load or change
  useEffect(() => {
    if (initialProductId && products.length > 0) {
      const idx = products.findIndex(p => p.productId === initialProductId || p.id === initialProductId);
      if (idx >= 0) {
        setCurrentIndex(idx);
      }
    }
  }, [initialProductId, products]);

  // Reset index to 0 when search returns new products
  useEffect(() => {
    setCurrentIndex(0);
  }, [products.length]);

  // Load more when reaching the last few slides
  useEffect(() => {
    if (currentIndex >= products.length - 3 && hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [currentIndex, products.length, hasMore, isLoadingMore, loadMore]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const currentProduct = products[currentIndex] || products[0];

  const handleSwipe = (newDirection: 'left' | 'right') => {
    setDirection(newDirection);
    if (newDirection === 'right') {
      setCurrentIndex((prev) => (prev === 0 ? products.length - 1 : prev - 1));
    } else {
      setCurrentIndex((prev) => (prev === products.length - 1 ? 0 : prev + 1));
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
    if (navigator.share && currentProduct) {
      navigator.share({
        title: currentProduct.name.toUpperCase(),
        text: `Check out ${currentProduct.name.toUpperCase()} - ${formatPrice(currentProduct.price)}`,
        url: window.location.href,
      });
    } else if (currentProduct) {
      alert('Share this product: ' + currentProduct.name.toUpperCase());
    }
  };

  const triggerSearch = () => {
    onSearch(viewerSearchQuery);
  };

  // If no products found, render a clean blank search/no results state
  if (products.length === 0) {
    return (
      <div className="w-full h-screen bg-black/95 flex flex-col items-center justify-center relative p-8">
        <div className="absolute top-6 sm:top-8 right-6 sm:right-8 flex gap-3 z-20">
          <div className="flex items-center gap-0">
            <input
              ref={searchInputRef}
              type="text"
              value={viewerSearchQuery}
              onChange={(e) => setViewerSearchQuery(e.target.value)}
              placeholder="SEARCH PRODUCTS..."
              className="w-48 sm:w-64 px-4 py-2.5 text-sm bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 uppercase font-semibold"
              onKeyDown={(e) => {
                if (e.key === 'Enter') triggerSearch();
              }}
            />
            <button
              onClick={triggerSearch}
              className="p-3 bg-white text-[#0f172a] rounded-full ml-2 hover:bg-gray-200 transition-all font-bold text-xs uppercase"
            >
              SEARCH
            </button>
            <button
              onClick={() => {
                setViewerSearchQuery('');
                onSearch('');
              }}
              className="p-3.5 bg-white/20 rounded-full ml-2 text-white hover:bg-white/40 transition-all"
            >
              <X size={18} />
            </button>
          </div>
          <Link href="/catalogue">
            <button className="p-3.5 bg-white/20 hover:bg-white/40 text-white rounded-full transition-all">
              <Home size={20} />
            </button>
          </Link>
        </div>
        <div className="text-center text-white">
          <p className="text-4xl mb-4">🔍</p>
          <h2 className="text-2xl font-black uppercase tracking-wider mb-2">NO PRODUCTS FOUND</h2>
          <p className="text-gray-400 text-sm max-w-sm">TRY SEARCHING FOR OTHER ITEMS OR CLEAR THE SEARCH FILTER</p>
        </div>
      </div>
    );
  }

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
              <div className="absolute bottom-4 right-4 bg-white/80 text-[#0f172a] px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm opacity-0 group-hover:opacity-100 transition-opacity uppercase">
                CLICK TO ZOOM
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
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

        {/* Product Counter - Dynamic API totalCount */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-6 left-6 sm:top-8 sm:left-8 bg-white/30 backdrop-blur-2xl text-[#0f172a] px-5 py-2.5 rounded-full shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/60"
        >
          <p className="text-sm font-bold tracking-wider">{String(currentIndex + 1).padStart(2, '0')} / {String(totalCount).padStart(2, '0')}</p>
        </motion.div>

        {/* Action Buttons - Top Right */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-6 sm:top-8 right-6 sm:right-8 flex gap-3 z-20"
        >
          {/* Expandable Search */}
          <motion.div className="flex items-center gap-0">
            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 220, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="overflow-hidden"
                >
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={viewerSearchQuery}
                    onChange={(e) => setViewerSearchQuery(e.target.value)}
                    placeholder="SEARCH PRODUCTS..."
                    className="w-full px-4 py-2.5 text-sm bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full text-[#0f172a] placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/30 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] uppercase font-semibold"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') triggerSearch();
                      if (e.key === 'Escape') {
                        setSearchOpen(false);
                        setViewerSearchQuery('');
                        onSearch('');
                      }
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              onClick={() => {
                if (searchOpen) {
                  triggerSearch();
                } else {
                  setSearchOpen(true);
                }
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={`p-3.5 rounded-full backdrop-blur-2xl text-[#0f172a] transition-all shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/60 ${searchOpen ? 'bg-white/60' : 'bg-white/30 hover:bg-white/60'}`}
            >
              <Search size={20} />
            </motion.button>
            {searchOpen && (
              <motion.button
                onClick={() => {
                  setSearchOpen(false);
                  setViewerSearchQuery('');
                  onSearch('');
                }}
                className="p-3.5 bg-white/30 backdrop-blur-2xl rounded-full text-[#0f172a] ml-2 border border-white/60"
              >
                <X size={18} />
              </motion.button>
            )}
          </motion.div>

          <motion.button
            onClick={() => setIsLiked(!isLiked)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-3.5 rounded-full bg-white/30 backdrop-blur-2xl hover:bg-white/60 text-[#0f172a] transition-all shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/60"
          >
            <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} className={isLiked ? 'text-red-500' : ''} />
          </motion.button>
          
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
                    { href: '/catalogue', label: 'HOME', icon: Home },
                    { href: '/gallery', label: 'GALLERY', icon: BookOpen },
                    { href: '/view', label: 'PRODUCTS', icon: Grid },
                    { href: '/cart', label: `CART (${cart.itemCount})`, icon: ShoppingCart },
                  ].map((item) => (
                    <Link href={item.href} key={item.label} onClick={() => setMenuOpen(false)}>
                      <motion.div
                        whileHover={{ x: 4, backgroundColor: 'rgba(0,0,0,0.05)' }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-800 font-bold text-sm transition-colors cursor-pointer uppercase"
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

        {/* Product Info Overlay - Capitalized */}
        {!imageZoomed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-32 sm:bottom-40 left-6 sm:left-8 bg-white/40 backdrop-blur-2xl text-[#0f172a] p-6 rounded-[2rem] max-w-sm border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]"
          >
            <h2 className="text-2xl sm:text-3xl font-black mb-2 leading-tight uppercase">{currentProduct.name}</h2>
            <p className="text-sm text-gray-500 font-bold line-clamp-2 mb-4 uppercase">
              {currentProduct.subcategories ? `${currentProduct.categories} > ${currentProduct.subcategories}` : currentProduct.categories}
            </p>

            {/* Price */}
            <div className="flex items-baseline justify-between pt-4 border-t border-gray-100">
              <div>
                <span className="text-3xl font-black text-[#0f172a]">{formatPrice(currentProduct.price)}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Add to Cart Button */}
        {!imageZoomed && (
          <motion.button
            whileHover={{ scale: 1.05, y: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModalOpen(true)}
            className="absolute bottom-32 sm:bottom-40 left-1/2 -translate-x-1/2 bg-[#0f172a] hover:bg-[#1e293b] text-white px-8 sm:px-12 py-4 sm:py-5 rounded-full font-black flex items-center gap-3 shadow-[0_15px_30px_-10px_rgba(15,23,42,0.4)] transition-all z-30 text-lg uppercase tracking-wider"
          >
            <ShoppingCart size={22} />
            <span>ADD TO CART</span>
          </motion.button>
        )}

        {/* Thumbnail Navigation */}
        {!imageZoomed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto px-4 max-w-xs sm:max-w-2xl justify-center z-20 hidden sm:flex pb-2"
          >
            {products.map((product, idx) => (
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
                  className="w-full h-full object-cover animate-fade-in"
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
          className="absolute bottom-8 left-6 text-white text-xs bg-white/20 px-4 py-2 rounded-full backdrop-blur-sm sm:hidden border border-white/30 uppercase font-bold"
        >
          ← SWIPE TO BROWSE →
        </motion.div>
      </div>

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
