'use client';

import { useState } from 'react';
import { Product } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Check, ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/contexts/cart-context';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/currency';

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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md mx-4 z-50 max-h-[90vh] overflow-y-auto"
          >
            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-2xl">
              {/* Header Gradient */}
              <div className="h-1 bg-gradient-to-r from-accent to-accent/80" />

              <div className="p-6 sm:p-8">
                {/* Close Button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 hover:bg-secondary rounded-lg transition-colors"
                >
                  <X size={20} className="text-muted-foreground" />
                </motion.button>

                {/* Product Image */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-6 rounded-xl overflow-hidden bg-secondary h-40"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </motion.div>

                {/* Product Info */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="mb-6"
                >
                  <h3 className="text-xl font-bold text-foreground mb-2">{product.name}</h3>
                  <p className="text-3xl font-bold text-accent">{formatPrice(product.price)}</p>
                </motion.div>

                {/* Color Selection */}
                {product.variants?.colors && product.variants.colors.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mb-6"
                  >
                    <label className="block text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
                      Color
                    </label>
                    <div className="flex gap-3 flex-wrap">
                      {product.variants.colors.map((color) => (
                        <motion.button
                          key={color.id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedColor(color.name)}
                          className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                            selectedColor === color.name
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-border text-foreground hover:border-accent'
                          }`}
                        >
                          {selectedColor === color.name && (
                            <Check size={16} className="inline mr-2" />
                          )}
                          {color.name}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Size Selection */}
                {product.variants?.sizes && product.variants.sizes.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="mb-6"
                  >
                    <label className="block text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
                      Size
                    </label>
                    <div className="flex gap-3 flex-wrap">
                      {product.variants.sizes.map((size) => (
                        <motion.button
                          key={size.id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedSize(size.name)}
                          className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                            selectedSize === size.name
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-border text-foreground hover:border-accent'
                          }`}
                        >
                          {selectedSize === size.name && (
                            <Check size={16} className="inline mr-2" />
                          )}
                          {size.name}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Quantity */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mb-6"
                >
                  <label className="block text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
                    Quantity
                  </label>
                  <div className="flex items-center gap-4 bg-secondary rounded-xl p-3 w-fit">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-2 hover:bg-border rounded-lg transition-colors"
                    >
                      <Minus size={18} />
                    </motion.button>
                    <span className="text-lg font-bold text-foreground w-8 text-center">{quantity}</span>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setQuantity(quantity + 1)}
                      className="p-2 hover:bg-border rounded-lg transition-colors"
                    >
                      <Plus size={18} />
                    </motion.button>
                  </div>
                </motion.div>

                {/* Special Notes */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="mb-6"
                >
                  <label className="block text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
                    Special Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any special requirements or notes..."
                    className="w-full px-4 py-3 rounded-xl border border-border bg-secondary text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none h-20"
                  />
                </motion.div>

                {/* Success Message */}
                {showSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-green-100 border border-green-300 rounded-xl flex items-center gap-3"
                  >
                    <Check size={20} className="text-green-600" />
                    <span className="text-green-700 font-medium">Added to cart successfully!</span>
                  </motion.div>
                )}

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex gap-3"
                >
                  <Button
                    onClick={onClose}
                    variant="outline"
                    className="flex-1 py-3 rounded-xl"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAddToCart}
                    disabled={isSubmitting || showSuccess}
                    className="flex-1 bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : (
                      <>
                        <ShoppingCart size={20} />
                        Add to Cart
                      </>
                    )}
                  </motion.button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
