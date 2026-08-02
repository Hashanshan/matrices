'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShoppingCart, X, Minus, Plus, Heart, Search, ArrowLeft } from 'lucide-react';
import { useCart } from '@/lib/contexts/cart-context';
import { useWishlist } from '@/lib/contexts/wishlist-context';
import { useCallback } from 'react';
import { Product } from '@/lib/types';
import { formatPrice } from '@/lib/currency';
import QuickAddModal from './quick-add-modal';
import Link from 'next/link';
import RelatedProducts from './related-products';
import { Menu, Home, Grid, BookOpen } from 'lucide-react';
import SmartImage from './smart-image';
import { getCachedImageUrl, getCachedImageUrlSync } from '@/lib/offline/image-cache';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

interface FullscreenProductViewerProps {
  products: Product[];
  initialProductId?: string;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
  isLoadingMore: boolean;
  onSearch: (query: string) => void;
  exactMatchFound?: boolean;
}

export default function FullscreenProductViewer({
  products,
  initialProductId,
  totalCount,
  hasMore,
  loadMore,
  isLoadingMore,
  onSearch,
  exactMatchFound
}: FullscreenProductViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [imageZoomed, setImageZoomed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewerSearchQuery, setViewerSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef(0);
  const { addToCart } = useCart();
  const { isProductWishlisted, toggleProductWishlist } = useWishlist();
  const [menuOpen, setMenuOpen] = useState(false);
  const { cart } = useCart();

  const hasSetInitialIndex = useRef(false);
  const [displayImg, setDisplayImg] = useState<string>('');

  const validProducts = useMemo(() => {
    const raw = (products || []).filter((p): p is Product => Boolean(p && (p.image || p.name || p.id)));
    if (!raw.length) return [];

    const activeTarget = viewerSearchQuery.trim() || initialProductId?.trim() || '';
    if (!activeTarget) return raw;

    const targetStr = activeTarget.toLowerCase();
    const targetClean = activeTarget.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const targetIdx = raw.findIndex((p: any) => {
      const pProdId = String(p.productId || '').trim().toLowerCase();
      const pId = String(p.id || '').trim().toLowerCase();
      const pCode = String(p.code || p.productCode || '').trim().toLowerCase();
      const pName = String(p.name || '').trim().toLowerCase();

      // 1. Exact match on productId, id, code
      if (pProdId === targetStr || pId === targetStr || pCode === targetStr) return true;

      // 2. Alphanumeric match (ignoring hyphens/spaces e.g. "MTX10216" vs "MTX-10216")
      if (targetClean) {
        const cProdId = pProdId.replace(/[^a-zA-Z0-9]/g, '');
        const cCode = pCode.replace(/[^a-zA-Z0-9]/g, '');
        const cId = pId.replace(/[^a-zA-Z0-9]/g, '');
        const cName = pName.replace(/[^a-zA-Z0-9]/g, '');
        if (cProdId === targetClean || cCode === targetClean || cId === targetClean) return true;
        if (cName.includes(targetClean)) return true;
      }

      // 3. Includes match on name or code
      if (pName.includes(targetStr) || pCode.includes(targetStr) || pProdId.includes(targetStr)) return true;

      return false;
    });

    if (targetIdx < 0) return raw;

    const targetProd = raw[targetIdx];
    const targetCat = String(targetProd.categories || targetProd.category || '').trim().toLowerCase();
    const targetSub = String(targetProd.subcategories || targetProd.subcategory || '').trim().toLowerCase();

    const subMatches: Product[] = [];
    const catMatches: Product[] = [];
    const others: Product[] = [];

    for (let i = 0; i < raw.length; i++) {
      if (i === targetIdx) continue;
      const p = raw[i];
      const pCat = String(p.categories || p.category || '').trim().toLowerCase();
      const pSub = String(p.subcategories || p.subcategory || '').trim().toLowerCase();

      if (targetSub && pSub === targetSub) {
        subMatches.push(p);
      } else if (targetCat && pCat === targetCat) {
        catMatches.push(p);
      } else {
        others.push(p);
      }
    }

    return [targetProd, ...subMatches, ...catMatches, ...others];
  }, [products, initialProductId, viewerSearchQuery]);

  const currentProduct = validProducts[currentIndex] || validProducts[0] || null;

  // Ensure currentIndex stays 0 when activeTarget changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [viewerSearchQuery, initialProductId]);

  // Resolve offline image URL for current product — sync first for instant render
  useEffect(() => {
    const rawUrl = currentProduct?.image || '';
    if (!rawUrl) {
      setDisplayImg('');
      return;
    }

    // Try synchronous in-memory map first (zero latency)
    const synced = getCachedImageUrlSync(rawUrl);
    if (synced) {
      setDisplayImg(synced);
      return;
    }

    // Set raw URL immediately so image starts loading
    setDisplayImg(rawUrl);

    // Then async-resolve in background (updates if a cached version exists)
    let cancelled = false;
    getCachedImageUrl(rawUrl)
      .then((resolved) => {
        if (!cancelled && resolved !== rawUrl) {
          setDisplayImg(resolved);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [currentProduct?.image, currentProduct?.id]);

  // Load more when approaching the end — pre-fetch 5 slides before the boundary
  useEffect(() => {
    if (validProducts.length > 0 && currentIndex >= validProducts.length - 5 && hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [currentIndex, validProducts.length, hasMore, isLoadingMore, loadMore]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Handle SweetAlert for no exact match
  useEffect(() => {
    if (exactMatchFound === false && validProducts.length > 0 && viewerSearchQuery) {
      MySwal.fire({
        title: 'No exact match found',
        text: 'Do you want to continue to view related products?',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Continue',
        confirmButtonColor: '#0f172a',
        cancelButtonColor: '#64748b'
      }).then((result) => {
        if (!result.isConfirmed) {
          setViewerSearchQuery('');
          onSearch('');
          setCurrentIndex(0);
        }
      });
    }
  }, [exactMatchFound, validProducts.length, viewerSearchQuery, onSearch]);

  const handleSwipe = useCallback((newDirection: 'left' | 'right') => {
    setDirection(newDirection);
    if (newDirection === 'right') {
      // Go back — allow wrapping to end only when no more data to load
      setCurrentIndex((prev) => {
        if (prev === 0) return hasMore ? 0 : validProducts.length - 1;
        return prev - 1;
      });
    } else {
      // Go forward — clamp at last item when more data is loading, wrap only when fully loaded
      setCurrentIndex((prev) => {
        if (prev >= validProducts.length - 1) {
          return hasMore ? validProducts.length - 1 : 0;
        }
        return prev + 1;
      });
    }
    // Reset modal and states on product change
    setIsModalOpen(false);
    setQuantity(1);
    setSelectedColor(null);
    setSelectedSize(null);
    setNotes('');
  }, [validProducts.length, hasMore]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        handleSwipe('right');
      } else if (e.key === 'ArrowRight') {
        handleSwipe('left');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipe]);

  // Only reset if index has gone stale beyond bounds (e.g. after a search that shrinks results)
  useEffect(() => {
    if (currentIndex >= validProducts.length && validProducts.length > 0) {
      setCurrentIndex(validProducts.length - 1);
    }
  }, [validProducts.length, currentIndex]);

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
      scale: 0.98,
      filter: 'brightness(0.95)',
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
      scale: 0.98,
      filter: 'brightness(0.95)',
    }),
  };

  const triggerSearch = () => {
    onSearch(viewerSearchQuery);
    setCurrentIndex(0);
  };

  // If no valid products found, render clean blank search/no results state
  if (!currentProduct || validProducts.length === 0) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center relative p-8 !backdrop-blur-[2px] overflow-y-auto no-scrollbar pb-24">
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
        <div className="text-center text-white mt-24 mb-8">
          <p className="text-4xl mb-4">🔍</p>
          <h2 className="text-2xl font-black uppercase tracking-wider mb-2">NO PRODUCTS FOUND</h2>
          <p className="text-gray-400 text-sm max-w-sm mx-auto">TRY SEARCHING FOR OTHER ITEMS OR CLEAR THE SEARCH FILTER</p>
        </div>

        <div className="w-full max-w-7xl">
          <RelatedProducts />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen !backdrop-blur-[2px] overflow-hidden relative max-w-full">
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
              ease: 'easeOut',
              duration: 0.08,
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
              <SmartImage
                src={displayImg || currentProduct?.image || currentProduct?.imageUrl || ''}
                alt={currentProduct?.name || 'Product Image'}
                className="w-full h-full object-contain rounded-3xl shadow-2xl"
                priority
              />
              <div className="absolute bottom-4 right-4 bg-white/80 text-[#0f172a] px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity uppercase">
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
          className="absolute left-3 sm:left-8 top-1/2 -translate-y-1/2 bg-white/40 hover:bg-white/70 backdrop-blur-2xl text-[#0f172a] p-2.5 sm:p-4 rounded-full transition-all z-20 flex items-center justify-center shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] border border-white/60 cursor-pointer"
        >
          <ChevronLeft size={24} className="sm:w-7 sm:h-7" />
        </motion.button>

        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            handleSwipe('left');
          }}
          whileHover={{ scale: 1.1, x: -4 }}
          whileTap={{ scale: 0.95 }}
          className="absolute right-3 sm:right-8 top-1/2 -translate-y-1/2 bg-white/40 hover:bg-white/70 backdrop-blur-2xl text-[#0f172a] p-2.5 sm:p-4 rounded-full transition-all z-20 flex items-center justify-center shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] border border-white/60 cursor-pointer"
        >
          <ChevronRight size={24} className="sm:w-7 sm:h-7" />
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
                  animate={{ width: 240, opacity: 1 }}
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
                  setMenuOpen(false);
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

          <AnimatePresence>
            {!searchOpen && (
              <motion.div
                initial={{ opacity: 1, scale: 1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3"
              >
                <motion.button
                  onClick={() => {
                    if (currentProduct) {
                      const prodId = currentProduct.productId || currentProduct.id;
                      if (prodId) toggleProductWishlist(prodId);
                    }
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-3.5 rounded-full bg-white/30 backdrop-blur-2xl hover:bg-white/60 text-[#0f172a] transition-all shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/60"
                  title={currentProduct && isProductWishlisted(currentProduct.productId || currentProduct.id) ? "Remove from Wishlist" : "Add to Wishlist"}
                >
                  <Heart
                    size={20}
                    fill={currentProduct && isProductWishlisted(currentProduct.productId || currentProduct.id) ? '#ef4444' : 'none'}
                    className={currentProduct && isProductWishlisted(currentProduct.productId || currentProduct.id) ? 'text-red-500' : ''}
                  />
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
                        className="absolute rounded-[1rem] top-16 right-0  backdrop-blur-2xl border border-white/60 rounded-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] p-4 w-48 flex flex-col gap-2 overflow-hidden"
                      >
                        {[
                          { href: '/catalogue', label: 'HOME', icon: Home },
                          { href: '/gallery', label: 'GALLERY', icon: BookOpen },
                          { href: '/view', label: 'PRODUCTS', icon: Grid },
                          { href: '/cart', label: `CART (${cart.itemCount})`, icon: ShoppingCart },
                        ].map((item) => (
                          <Link href={item.href} key={item.label} onClick={() => setMenuOpen(false)}>
                            <motion.div
                              whileHover={{ x: 4, backgroundColor: 'rgba(117, 116, 116, 0.945)', borderRadius: '1rem' }}
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
            )}
          </AnimatePresence>
        </motion.div>

        {/* Product Info Overlay - Capitalized */}
        {!imageZoomed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-32 sm:bottom-40 left-6 sm:left-8 bg-white/40 backdrop-blur-2xl text-[#0f172a] p-6 rounded-[2rem] max-w-sm border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] z-1 sm:w-[90%] md:w-[70%] lg:w-[50%] xl:w-[30%]"
          >
            <h2 className="text-sm sm:text-2xl sm:text-3xl font-black mb-1 sm:mb-2 leading-tight uppercase">{currentProduct.name}</h2>
            <p className="text-sm text-gray-500 font-bold line-clamp-2 mb-2 sm:mb-4 uppercase">
              {currentProduct.subcategories ? `${currentProduct.categories} > ${currentProduct.subcategories}` : currentProduct.categories}
            </p>

            {/* Price */}
            <div className="flex items-baseline justify-between pt-2 sm:pt-4 border-t border-gray-100">
              <div>
                <span className="text-md sm:text-3xl font-black text-[#0f172a]">{formatPrice(currentProduct.price)}</span>
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
            className="absolute bottom-26 md:bottom-26 lg:bottom-30 left-1/2 -translate-x-1/2 bg-[#0f172a] hover:bg-[#1e293b] text-white px-8 sm:px-12 py-4 sm:py-5 rounded-full font-black flex items-center gap-3 shadow-[0_15px_30px_-10px_rgba(15,23,42,0.4)] transition-all z-30 text-sm md:text-md lg:text-lg uppercase tracking-wider"
          >
            <ShoppingCart size={22} />
            <span>ADD TO CART</span>
          </motion.button>
        )}

        {/* Thumbnail Navigation */}
        {!imageZoomed && (
          <ThumbnailStrip
            products={validProducts}
            currentIndex={currentIndex}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onSelect={(idx) => {
              setDirection(idx > currentIndex ? 'left' : 'right');
              setCurrentIndex(idx);
            }}
            onLoadMore={loadMore}
          />
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

interface ThumbnailStripProps {
  products: Product[];
  currentIndex: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onSelect: (index: number) => void;
  onLoadMore: () => void;
}

function ThumbnailStrip({
  products,
  currentIndex,
  hasMore,
  isLoadingMore,
  onSelect,
  onLoadMore,
}: ThumbnailStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const activeEl = containerRef.current.children[currentIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentIndex]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto px-4 max-w-xs sm:max-w-2xl justify-center z-20 hidden sm:flex pb-2 no-scrollbar"
      ref={containerRef}
    >
      {products.map((product, idx) => (
        <motion.button
          key={`${product.id}-${idx}`}
          onClick={() => onSelect(idx)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className={`flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all backdrop-blur-sm ${
            idx === currentIndex
              ? 'border-white shadow-xl ring-2 ring-white/50 scale-110'
              : 'border-white/40 hover:border-white/80'
          }`}
        >
          <SmartImage
            src={product.image || product.imageUrl || ''}
            alt={product.name || 'Thumbnail'}
            className="w-full h-full object-cover animate-fade-in"
          />
        </motion.button>
      ))}

      {hasMore && (
        <div
          ref={(node) => {
            if (!node) return;
            const observer = new IntersectionObserver(
              (entries) => {
                if (entries[0].isIntersecting && !isLoadingMore) {
                  onLoadMore();
                }
              },
              { threshold: 0.1 }
            );
            observer.observe(node);
            return () => observer.disconnect();
          }}
          className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border-2 border-white/20"
        >
          {isLoadingMore ? (
            <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          ) : (
            <span className="text-white text-xs font-bold">+</span>
          )}
        </div>
      )}
    </motion.div>
  );
}

