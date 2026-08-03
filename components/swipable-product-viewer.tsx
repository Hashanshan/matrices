'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShoppingCart, Heart, Minus, Plus } from 'lucide-react';
import { useCart } from '@/lib/contexts/cart-context';
import { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MOCK_PRODUCTS } from '@/lib/mock-data';

import SmartImage from './smart-image';

interface SwipableProductViewerProps {
  initialProductId?: string;
  onClose?: () => void;
}

export default function SwipableProductViewer({
  initialProductId,
  onClose,
}: SwipableProductViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (initialProductId) {
      return MOCK_PRODUCTS.findIndex((p) => p.id === initialProductId);
    }
    return 0;
  });

  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const touchStartX = useRef(0);
  const [imageZoom, setImageZoom] = useState(false);
  const { addToCart, getAddToCartButtonLabel } = useCart();

  useEffect(() => {
    const handleCloseAll = () => onClose?.();
    window.addEventListener('matrices-close-all-modals', handleCloseAll);
    return () => window.removeEventListener('matrices-close-all-modals', handleCloseAll);
  }, [onClose]);

  const currentProduct = MOCK_PRODUCTS[currentIndex];

  const handleSwipe = (newDirection: 'left' | 'right') => {
    setDirection(newDirection);
    if (newDirection === 'right') {
      setCurrentIndex((prev) => (prev === 0 ? MOCK_PRODUCTS.length - 1 : prev - 1));
    } else {
      setCurrentIndex((prev) => (prev === MOCK_PRODUCTS.length - 1 ? 0 : prev + 1));
    }
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

    const success = addToCart({
      ...currentProduct,
      quantity,
      selectedColor: selectedColor || undefined,
      selectedSize: selectedSize || undefined,
      notes: notes || undefined,
    });

    if (success) {
      setQuantity(1);
      setSelectedColor(null);
      setSelectedSize(null);
      setNotes('');
    } else {
      onClose?.();
    }
  };

  const slideVariants = {
    enter: (dir: 'left' | 'right') => ({
      x: dir === 'left' ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (dir: 'left' | 'right') => ({
      zIndex: 0,
      x: dir === 'left' ? -1000 : 1000,
      opacity: 0,
    }),
  };

  return (
    <div className="w-full min-h-screen bg-background">
      {/* Navigation Bar */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Product {currentIndex + 1} of {MOCK_PRODUCTS.length}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{currentProduct.name}</h1>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Swipable Product Image */}
          <div className="flex flex-col gap-4">
            <div
              className="relative bg-card rounded-lg overflow-hidden aspect-square cursor-move group"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={() => setImageZoom(!imageZoom)}
            >
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={currentIndex}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: 'spring', stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 },
                  }}
                  className="absolute inset-0"
                >
                  <SmartImage
                    src={currentProduct.image}
                    alt={currentProduct.name}
                    className={`w-full h-full object-cover transition-transform duration-300 ${
                      imageZoom ? 'scale-150' : 'scale-100'
                    }`}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Zoom Hint */}
              <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-2 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                Click to {imageZoom ? 'zoom out' : 'zoom in'}
              </div>

              {/* Navigation Arrows */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwipe('right');
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-foreground p-2 rounded-full transition-all z-10 hidden sm:flex items-center justify-center"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwipe('left');
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-foreground p-2 rounded-full transition-all z-10 hidden sm:flex items-center justify-center"
              >
                <ChevronRight size={24} />
              </button>

              {/* Swipe Hint */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-2 rounded-lg">
                Swipe or use arrows to browse
              </div>
            </div>

            {/* Thumbnail Navigation */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {MOCK_PRODUCTS.map((product, idx) => (
                <motion.button
                  key={product.id}
                  onClick={() => {
                    setDirection(idx > currentIndex ? 'left' : 'right');
                    setCurrentIndex(idx);
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === currentIndex
                      ? 'border-accent shadow-lg'
                      : 'border-border hover:border-muted'
                  }`}
                >
                  <SmartImage
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </motion.button>
              ))}
            </div>
          </div>

          {/* Right: Product Details */}
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-6"
          >
            {/* Price & Rating */}
            <div>
              <div className="flex items-center gap-4 mb-2">
                <span className="text-4xl font-bold text-foreground">
                  ${currentProduct.price}
                </span>
                {currentProduct.originalPrice && (
                  <span className="text-xl text-muted-foreground line-through">
                    ${currentProduct.originalPrice}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <span key={i}>
                      {i < Math.floor(currentProduct.rating) ? '★' : '☆'}
                    </span>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  ({currentProduct.reviews} reviews)
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="text-muted-foreground leading-relaxed">
              {currentProduct.description}
            </p>

            {/* In Stock */}
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  currentProduct.inStock ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className={currentProduct.inStock ? 'text-green-600' : 'text-red-600'}>
                {currentProduct.inStock ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>

            {/* Variants */}
            {currentProduct.variants?.colors && currentProduct.variants.colors.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-foreground mb-3">
                  Colors Available
                </label>
                <div className="flex flex-wrap gap-3">
                  {currentProduct.variants.colors.map((color) => (
                    <motion.button
                      key={color.id}
                      onClick={() => setSelectedColor(color.name)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`px-4 py-2 rounded-lg border-2 transition-all font-medium ${
                        selectedColor === color.name
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-foreground hover:border-accent'
                      }`}
                    >
                      {color.name}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-foreground mb-3">
                  Sizes Available
                </label>
                <div className="flex flex-wrap gap-3">
                  {currentProduct.variants.sizes.map((size) => (
                    <motion.button
                      key={size.id}
                      onClick={() => setSelectedSize(size.name)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`px-4 py-2 rounded-lg border-2 transition-all font-medium ${
                        selectedSize === size.name
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-foreground hover:border-accent'
                      }`}
                    >
                      {size.name}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Special Notes */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">
                Special Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any special requirements (colors needed, customization, etc.)"
                className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                rows={3}
              />
            </div>

            {/* Quantity Selector */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">
                Quantity
              </label>
              <div className="flex items-center gap-3 bg-card border border-border p-2 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 hover:bg-background rounded-lg transition-colors cursor-pointer"
                >
                  <Minus size={18} />
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-12 text-center text-lg font-bold text-foreground bg-transparent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-2 hover:bg-background rounded-lg transition-colors cursor-pointer"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddToCart}
                disabled={!currentProduct.inStock}
                className="flex-1 bg-accent text-accent-foreground px-6 py-4 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all overflow-hidden cursor-pointer"
              >
                <ShoppingCart size={20} className="shrink-0" />
                <span className="truncate whitespace-nowrap inline-block max-w-full text-xs sm:text-sm font-bold uppercase">
                  {getAddToCartButtonLabel('Add to Cart')}
                </span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsLiked(!isLiked)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isLiked
                    ? 'border-red-500 bg-red-500/10'
                    : 'border-border hover:border-red-500'
                }`}
              >
                <Heart
                  size={20}
                  className={isLiked ? 'fill-red-500 text-red-500' : 'text-foreground'}
                />
              </motion.button>

            </div>

            {/* Product Info */}
            <div className="border-t border-border pt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="font-semibold text-foreground capitalize">
                  {currentProduct.category}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Product ID</p>
                <p className="font-semibold text-foreground">{currentProduct.id}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
