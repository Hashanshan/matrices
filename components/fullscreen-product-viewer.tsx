'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShoppingCart, X, Minus, Plus, Heart, Share2, Star, Check } from 'lucide-react';
import { useCart } from '@/lib/contexts/cart-context';
import { Button } from '@/components/ui/button';
import { MOCK_PRODUCTS } from '@/lib/mock-data';
import { formatPrice } from '@/lib/currency';

export default function FullscreenProductViewer() {
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
  const touchStartX = useRef(0);
  const { addToCart } = useCart();

  const currentProduct = MOCK_PRODUCTS[currentIndex];

  const handleSwipe = (newDirection: 'left' | 'right') => {
    setDirection(newDirection);
    if (newDirection === 'right') {
      setCurrentIndex((prev) => (prev === 0 ? MOCK_PRODUCTS.length - 1 : prev - 1));
    } else {
      setCurrentIndex((prev) => (prev === MOCK_PRODUCTS.length - 1 ? 0 : prev + 1));
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
    <div className="w-full h-screen bg-gradient-to-br from-background via-background to-card overflow-hidden relative">
      {/* Animated background gradient */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Full Image Container */}
      <div
        className="w-full h-full flex items-center justify-center relative cursor-move group"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
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
            className="absolute inset-0 flex items-center justify-center p-4 sm:p-8"
            onClick={() => setImageZoomed(!imageZoomed)}
          >
            <motion.div
              className="relative w-full h-full"
              animate={imageZoomed ? { scale: 1.2 } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <img
                src={currentProduct.image}
                alt={currentProduct.name}
                className="w-full h-full object-contain rounded-3xl shadow-2xl"
              />
              {/* Zoom hint */}
              <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
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
          className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-foreground p-3 sm:p-4 rounded-full transition-all z-20 hidden sm:flex items-center justify-center shadow-2xl backdrop-blur-sm border border-white/50"
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
          className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-foreground p-3 sm:p-4 rounded-full transition-all z-20 hidden sm:flex items-center justify-center shadow-2xl backdrop-blur-sm border border-white/50"
        >
          <ChevronRight size={28} />
        </motion.button>

        {/* Product Counter - Enhanced */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-6 left-6 sm:top-8 sm:left-8 backdrop-blur-md bg-white/20 text-white px-4 py-3 rounded-xl border border-white/30 shadow-lg"
        >
          <p className="text-sm font-semibold tracking-wider">{String(currentIndex + 1).padStart(2, '0')} / {String(MOCK_PRODUCTS.length).padStart(2, '0')}</p>
        </motion.div>

        {/* Action Buttons - Top Right */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-6 sm:top-8 right-6 sm:right-8 flex gap-3 z-20"
        >
          <motion.button
            onClick={() => setIsLiked(!isLiked)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-3 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 text-white transition-all border border-white/30 shadow-lg"
          >
            <Heart size={22} fill={isLiked ? 'currentColor' : 'none'} />
          </motion.button>
          <motion.button
            onClick={handleShare}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-3 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 text-white transition-all border border-white/30 shadow-lg"
          >
            <Share2 size={22} />
          </motion.button>
        </motion.div>

        {/* Product Info Overlay - Premium */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-32 sm:bottom-40 left-6 sm:left-8 backdrop-blur-xl bg-white/15 text-white px-6 py-5 rounded-2xl max-w-sm border border-white/30 shadow-2xl"
        >
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-white">{currentProduct.name}</h2>
          <p className="text-sm text-white/90 line-clamp-2 mb-4">{currentProduct.description}</p>
          
          {/* Rating */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={16}
                  className={i < Math.floor(currentProduct.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-white/30'}
                />
              ))}
            </div>
            <span className="text-sm text-white/80">({currentProduct.reviews} reviews)</span>
          </div>

          {/* Price & Stock */}
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-4xl font-bold text-white">{formatPrice(currentProduct.price)}</span>
              {currentProduct.originalPrice && (
                <span className="ml-2 text-sm text-white/70 line-through">{formatPrice(currentProduct.originalPrice)}</span>
              )}
            </div>
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${
                currentProduct.inStock
                  ? 'bg-green-500/30 text-green-200 border border-green-400'
                  : 'bg-red-500/30 text-red-200 border border-red-400'
              }`}
            >
              {currentProduct.inStock ? 'In Stock' : 'Out of Stock'}
            </motion.div>
          </div>
        </motion.div>

        {/* Add to Cart Button - Enhanced */}
        <motion.button
          whileHover={{ scale: 1.05, y: -4 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsModalOpen(true)}
          disabled={!currentProduct.inStock}
          className="absolute bottom-32 sm:bottom-40 left-1/2 -translate-x-1/2 bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-white px-8 sm:px-12 py-4 sm:py-5 rounded-full font-bold flex items-center gap-3 shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed z-30 border border-white/20 backdrop-blur-sm text-lg"
        >
          <ShoppingCart size={24} />
          <span>Add to Cart</span>
        </motion.button>

        {/* Thumbnail Navigation - Bottom */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto px-4 max-w-xs sm:max-w-2xl justify-center z-20 hidden sm:flex pb-2"
        >
          {MOCK_PRODUCTS.map((product, idx) => (
            <motion.button
              key={product.id}
              onClick={() => {
                setDirection(idx > currentIndex ? 'left' : 'right');
                setCurrentIndex(idx);
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={`flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all backdrop-blur-sm ${
                idx === currentIndex
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

      {/* Add to Cart Modal - Premium */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-background to-card rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-border/50"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-accent/20 to-accent/10 border-b border-border px-6 py-6 flex items-center justify-between backdrop-blur-sm">
                <h3 className="text-2xl font-bold text-foreground">Customize Your Order</h3>
                <motion.button
                  onClick={() => setIsModalOpen(false)}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-muted-foreground hover:text-foreground transition-colors p-2"
                >
                  <X size={24} />
                </motion.button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Product Preview */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-card to-card/50 rounded-2xl overflow-hidden aspect-square border border-border/50 shadow-lg"
                >
                  <img
                    src={currentProduct.image}
                    alt={currentProduct.name}
                    className="w-full h-full object-cover"
                  />
                </motion.div>

                {/* Product Name & Price */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <h4 className="text-2xl font-bold text-foreground mb-2">{currentProduct.name}</h4>
                  <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-accent">{formatPrice(currentProduct.price)}</span>
              {currentProduct.originalPrice && (
                <span className="text-sm text-muted-foreground line-through">{formatPrice(currentProduct.originalPrice)}</span>
              )}
                  </div>
                </motion.div>

                {/* Colors */}
                {currentProduct.variants?.colors && currentProduct.variants.colors.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <label className="block text-sm font-bold text-foreground mb-3 uppercase tracking-wide">
                      Color
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {currentProduct.variants.colors.map((color) => (
                        <motion.button
                          key={color.id}
                          onClick={() => setSelectedColor(color.name)}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.95 }}
                          className={`px-5 py-3 rounded-xl border-2 font-medium transition-all ${
                            selectedColor === color.name
                              ? 'border-accent bg-accent/20 text-accent shadow-lg'
                              : 'border-border text-foreground hover:border-accent/50 hover:bg-card'
                          }`}
                        >
                          {selectedColor === color.name && <span className="mr-2">✓</span>}
                          {color.name}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Sizes */}
                {currentProduct.variants?.sizes && currentProduct.variants.sizes.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <label className="block text-sm font-bold text-foreground mb-3 uppercase tracking-wide">
                      Size
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {currentProduct.variants.sizes.map((size) => (
                        <motion.button
                          key={size.id}
                          onClick={() => setSelectedSize(size.name)}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.95 }}
                          className={`px-5 py-3 rounded-xl border-2 font-medium transition-all ${
                            selectedSize === size.name
                              ? 'border-accent bg-accent/20 text-accent shadow-lg'
                              : 'border-border text-foreground hover:border-accent/50 hover:bg-card'
                          }`}
                        >
                          {selectedSize === size.name && <span className="mr-2">✓</span>}
                          {size.name}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Quantity */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <label className="block text-sm font-bold text-foreground mb-3 uppercase tracking-wide">
                    Quantity
                  </label>
                  <div className="flex items-center gap-4 bg-gradient-to-r from-card to-card/50 p-4 rounded-xl w-fit border border-border/50">
                    <motion.button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 hover:bg-secondary rounded-lg transition-colors"
                    >
                      <Minus size={20} className="text-accent" />
                    </motion.button>
                    <span className="text-2xl font-bold w-12 text-center text-foreground">
                      {quantity}
                    </span>
                    <motion.button
                      onClick={() => setQuantity(quantity + 1)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 hover:bg-secondary rounded-lg transition-colors"
                    >
                      <Plus size={20} className="text-accent" />
                    </motion.button>
                  </div>
                </motion.div>

                {/* Special Notes */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <label className="block text-sm font-bold text-foreground mb-2 uppercase tracking-wide">
                    Special Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any special requirements or preferences..."
                    className="w-full px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 text-sm transition-all"
                    rows={3}
                  />
                </motion.div>

                {/* Success Message */}
                <AnimatePresence>
                  {addedSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2 bg-green-500/20 border border-green-500/50 text-green-200 px-4 py-3 rounded-xl"
                    >
                      <Check size={20} />
                      <span className="font-semibold">Added to cart successfully!</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                    <Button
                      onClick={() => setIsModalOpen(false)}
                      variant="outline"
                      className="w-full h-12 rounded-xl border-2 font-bold text-lg"
                    >
                      Cancel
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                    <Button
                      onClick={handleAddToCart}
                      disabled={addedSuccess}
                      className="w-full h-12 bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-white font-bold rounded-xl text-lg"
                    >
                      {addedSuccess ? (
                        <motion.div className="flex items-center gap-2">
                          <Check size={20} />
                          <span>Added!</span>
                        </motion.div>
                      ) : (
                        'Add to Cart'
                      )}
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
