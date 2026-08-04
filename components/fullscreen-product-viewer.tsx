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
import BackButton from './back-button';
import { useBackHandler } from '@/lib/utils/back-navigation';

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
  activeCategory?: string;
  activeSubcategory?: string;
  activeSortBy?: string;
  onSortChange?: (sort: string) => void;
  onClearFilters?: () => void;
}

export default function FullscreenProductViewer({
  products,
  initialProductId,
  totalCount,
  hasMore,
  loadMore,
  isLoadingMore,
  onSearch,
  exactMatchFound,
  activeCategory,
  activeSubcategory,
  activeSortBy,
  onSortChange,
  onClearFilters
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

  // Handle in-page viewer back events (closing search, modal, or menu)
  useBackHandler(() => {
    if (searchOpen) {
      setSearchOpen(false);
      setViewerSearchQuery('');
      onSearch('');
      return true;
    }
    if (isModalOpen) {
      setIsModalOpen(false);
      return true;
    }
    if (menuOpen) {
      setMenuOpen(false);
      return true;
    }
    return false;
  }, searchOpen || isModalOpen || menuOpen);

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

    const getSortComparator = (sortStr?: string) => {
      const s = (sortStr || activeSortBy || '').toLowerCase();
      if (s === 'price_asc' || s === 'price-low' || s === 'low-to-high') {
        return (a: Product, b: Product) => (a.sellPrice || a.price || 0) - (b.sellPrice || b.price || 0);
      } else if (s === 'price_desc' || s === 'price-high' || s === 'high-to-low') {
        return (a: Product, b: Product) => (b.sellPrice || b.price || 0) - (a.sellPrice || a.price || 0);
      } else if (s === 'name_asc' || s === 'a-z') {
        return (a: Product, b: Product) => String(a.name || '').localeCompare(String(b.name || ''));
      } else if (s === 'name_desc' || s === 'z-a') {
        return (a: Product, b: Product) => String(b.name || '').localeCompare(String(b.name || ''));
      } else if (s === 'rating') {
        return (a: Product, b: Product) => (b.rating || 0) - (a.rating || 0);
      }
      return () => 0;
    };

    const sortFn = getSortComparator(activeSortBy);
    subMatches.sort(sortFn);
    catMatches.sort(sortFn);
    others.sort((a: Product, b: Product) => {
      const catA = String(a.categories || a.category || '').trim().toLowerCase();
      const catB = String(b.categories || b.category || '').trim().toLowerCase();
      if (catA !== catB) return catA.localeCompare(catB);

      const subA = String(a.subcategories || a.subcategory || '').trim().toLowerCase();
      const subB = String(b.subcategories || b.subcategory || '').trim().toLowerCase();
      if (subA !== subB) return subA.localeCompare(subB);

      const customSortResult = sortFn(a, b);
      if (customSortResult !== 0) return customSortResult;

      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    return [targetProd, ...subMatches, ...catMatches, ...others].filter(Boolean) as Product[];
  }, [products, initialProductId, viewerSearchQuery, activeSortBy]);

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
    } else {
      setDisplayImg(rawUrl);
    }

    // Then async-resolve in background (updates if a cached version exists)
    let cancelled = false;
    getCachedImageUrl(rawUrl)
      .then((resolved) => {
        if (!cancelled && resolved && resolved !== rawUrl) {
          setDisplayImg(resolved);
        }
      })
      .catch(() => { });

    return () => { cancelled = true; };
  }, [currentProduct?.image, currentProduct?.id]);

  // Pre-resolve images for adjacent products for instant swiping
  useEffect(() => {
    const indicesToWarm = [currentIndex - 1, currentIndex + 1, currentIndex + 2];
    indicesToWarm.forEach((idx) => {
      if (idx >= 0 && idx < validProducts.length) {
        const url = validProducts[idx]?.image;
        if (url) getCachedImageUrl(url).catch(() => { });
      }
    });
  }, [currentIndex, validProducts]);

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
  // useEffect(() => {
  //   if (exactMatchFound === false && validProducts.length > 0 && viewerSearchQuery) {
  //     MySwal.fire({
  //       title: 'No exact match found',
  //       text: 'Do you want to continue to view related products?',
  //       icon: 'info',
  //       showCancelButton: true,
  //       confirmButtonText: 'Continue',
  //       confirmButtonColor: '#0f172a',
  //       cancelButtonColor: '#64748b'
  //     }).then((result) => {
  //       if (!result.isConfirmed) {
  //         setViewerSearchQuery('');
  //         onSearch('');
  //         setCurrentIndex(0);
  //       }
  //     });
  //   }
  // }, [exactMatchFound, validProducts.length, viewerSearchQuery, onSearch]);

  const handleSwipe = useCallback((newDirection: 'left' | 'right') => {
    setImageZoomed(false);
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
    if (imageZoomed) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (imageZoomed) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleSwipe('left');
      } else {
        handleSwipe('right');
      }
    }
  };

  const slideVariants = {
    enter: (dir: 'left' | 'right') => ({
      x: dir === 'left' ? '5%' : '-5%',
      opacity: 0,
      scale: 0.99,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: 'left' | 'right') => ({
      zIndex: 0,
      x: dir === 'left' ? '-5%' : '5%',
      opacity: 0,
      scale: 0.99,
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
      >
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentProduct.id || (currentProduct as any)._id || currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              type: 'tween',
              ease: 'easeOut',
              duration: 0.12,
            }}
            className="absolute inset-0 flex items-center justify-center p-4 sm:p-8"
            onClick={() => setImageZoomed(!imageZoomed)}
          >
            <motion.div
              className="relative w-full h-full"
              animate={imageZoomed ? { scale: 1.15 } : { scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <SmartImage
                src={displayImg || currentProduct?.image || (currentProduct as any)?.imageUrl || ''}
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

        {/* Top Left: Responsive Stylish Back Button & Counter */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-6 left-6 sm:top-8 sm:left-8 flex items-center gap-3 z-99"
        >
          <BackButton />
          <div className="bg-white/30 backdrop-blur-2xl text-[#0f172a] px-5 py-2.5 rounded-full shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/60">
            <p className="text-sm font-bold tracking-wider">{String(currentIndex + 1).padStart(2, '0')} / {String(totalCount).padStart(2, '0')}</p>
          </div>
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

                {/* {onClearFilters && Boolean(activeCategory || activeSubcategory || (activeSortBy && activeSortBy !== 'newest' && activeSortBy !== 'view') || (viewerSearchQuery && viewerSearchQuery.trim() !== '')) && (
                  <motion.button
                    onClick={() => {
                      onClearFilters();
                      setViewerSearchQuery('');
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-red-50 text-red-600 font-bold text-xs border border-red-200 shadow-sm cursor-pointer"
                  >
                    <X size={14} />
                    Clear Filters
                  </motion.button>
                )} */}

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
            {/* product id */}
            <p className="text-sm text-gray-700 font-bold line-clamp-2 mb-2 sm:mb-4 uppercase">
              {currentProduct.productId}
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
        {/* {imageZoomed && ( */}
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
          imageZoomed={imageZoomed}
        />
        {/* )} */}

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
  imageZoomed: boolean;
}

function ThumbnailStrip({
  products,
  currentIndex,
  hasMore,
  isLoadingMore,
  onSelect,
  onLoadMore,
  imageZoomed
}: ThumbnailStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Render a sliding window of max 11 thumbnails around the active index for optimal performance
  const WINDOW_RADIUS = 5;
  const startIdx = Math.max(0, currentIndex - WINDOW_RADIUS);
  const endIdx = Math.min(products.length, currentIndex + WINDOW_RADIUS + 1);
  const visibleProducts = products.slice(startIdx, endIdx);

  useEffect(() => {
    if (!containerRef.current) return;
    const relIndex = currentIndex - startIdx;
    const activeEl = containerRef.current.children[relIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentIndex, startIdx]);

  return (
    <div className={`${imageZoomed ? 'hidden' : ''}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto px-4 max-w-xs sm:max-w-2xl justify-center z-20 hidden sm:flex pb-2 no-scrollbar"
        ref={containerRef}
      >
        {visibleProducts.map((product, relIdx) => {
          const idx = startIdx + relIdx;
          return (
            <motion.button
              key={`${product.id}-${idx}`}
              onClick={() => onSelect(idx)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={`flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all backdrop-blur-sm ${idx === currentIndex
                ? 'border-white shadow-xl ring-2 ring-white/50 scale-110'
                : 'border-white/40 hover:border-white/80'
                }`}
            >
              <SmartImage
                src={product.image || (product as any).imageUrl || ''}
                alt={product.name || 'Thumbnail'}
                className="w-full h-full object-cover"
              />
            </motion.button>
          );
        })}

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
    </div>
  );
}

