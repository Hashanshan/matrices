'use client';

import { useState, use } from 'react';
import { useCart } from '@/lib/contexts/cart-context';
import { MOCK_PRODUCTS } from '@/lib/mock-data';
import { motion } from 'framer-motion';
import { Star, ShoppingCart, ArrowLeft, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Header from '@/components/header';

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const product = MOCK_PRODUCTS.find((p) => p.id === resolvedParams.id);
  const { addToCart } = useCart();

  const [selectedImage, setSelectedImage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [selectedColor, setSelectedColor] = useState(product?.variants.colors[0]?.id || '');
  const [selectedSize, setSelectedSize] = useState(product?.variants.sizes[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [showAddedMessage, setShowAddedMessage] = useState(false);

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">Product not found</h1>
          <Link href="/">
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
              Back to Shop
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (!selectedColor && product.variants.colors.length > 0) {
      alert('Please select a color');
      return;
    }
    if (!selectedSize && product.variants.sizes.length > 0) {
      alert('Please select a size');
      return;
    }

    addToCart({
      productId: product.id,
      quantity,
      selectedColor,
      selectedSize,
      notes: notes || undefined,
    });

    setShowAddedMessage(true);
    setTimeout(() => setShowAddedMessage(false), 2000);
  };

  const images = product.images && product.images.length > 0 ? product.images : [product.image];

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Button */}
          <Link href="/">
            <Button variant="ghost" className="mb-6 gap-2">
              <ArrowLeft size={18} />
              Back to Shop
            </Button>
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Image Gallery */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              {/* Main Image with Zoom */}
              <div
                className="relative w-full aspect-[4/3] sm:aspect-square bg-white rounded-2xl overflow-hidden cursor-zoom-in border border-border/50 shadow-sm"
                onClick={() => setIsZoomed(!isZoomed)}
              >
                <Image
                  src={images[selectedImage]}
                  alt={product.name}
                  fill
                  className={`object-contain p-4 w-full h-full ${isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'} transition-transform duration-300`}
                />
                <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm shadow-md">
                  {selectedImage + 1} / {images.length}
                </div>
              </div>

              {/* Thumbnail Gallery */}
              {images.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {images.map((img, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedImage(idx)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                        selectedImage === idx ? 'border-accent' : 'border-border'
                      }`}
                    >
                      <Image
                        src={img}
                        alt={`${product.name} ${idx + 1}`}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Product Details */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {/* Title & Rating */}
              <div>
                <div className="flex items-start justify-between mb-3">
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">{product.name}</h1>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={18}
                        className={i < Math.floor(product.rating) ? 'fill-current' : ''}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({product.reviews} reviews)
                  </span>
                </div>
                <span className="inline-block bg-accent/10 text-accent px-3 py-1 rounded-full text-sm font-semibold">
                  {product.category}
                </span>
              </div>

              {/* Price */}
              <div className="border-t border-b border-border/50 py-6 bg-secondary/30 rounded-xl px-4 mt-6">
                <p className="text-4xl font-black text-primary">${product.price.toFixed(2)}</p>
                {product.inStock && (
                  <p className="text-sm text-emerald-600 mt-2 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    In Stock - Ready to Ship
                  </p>
                )}
              </div>

              {/* Description */}
              <p className="text-muted-foreground leading-relaxed">{product.description}</p>

              {/* Variants */}
              <div className="space-y-4 border-t border-border pt-6">
                {/* Colors */}
                {product.variants.colors.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-3">
                      Color: {product.variants.colors.find((c) => c.id === selectedColor)?.name}
                    </label>
                    <div className="flex gap-3 flex-wrap">
                      {product.variants.colors.map((color) => (
                        <motion.button
                          key={color.id}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedColor(color.id)}
                          className={`relative w-12 h-12 rounded-full border-2 transition-all ${
                            selectedColor === color.id ? 'border-accent ring-2 ring-accent/50' : 'border-border'
                          }`}
                          style={{ backgroundColor: color.color }}
                          title={color.name}
                        >
                          {selectedColor === color.id && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sizes */}
                {product.variants.sizes.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-3">
                      Size: {product.variants.sizes.find((s) => s.id === selectedSize)?.name}
                    </label>
                    <div className="flex gap-3 flex-wrap">
                      {product.variants.sizes.map((size) => (
                        <motion.button
                          key={size.id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedSize(size.id)}
                          className={`px-4 py-2 border-2 rounded-lg font-semibold transition-all ${
                            selectedSize === size.id
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

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-3">
                    Quantity
                  </label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-1"
                    >
                      -
                    </Button>
                    <span className="text-lg font-semibold text-foreground w-8 text-center">
                      {quantity}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setQuantity(quantity + 1)}
                      className="px-3 py-1"
                    >
                      +
                    </Button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Special Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="E.g., Colors needed, special preferences..."
                    className="w-full px-3 py-2 border border-border rounded-lg bg-secondary text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    rows={3}
                  />
                </div>
              </div>

              {/* Add to Cart Button */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={handleAddToCart}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold py-3 rounded-lg flex items-center justify-center gap-2 text-lg"
                >
                  <ShoppingCart size={20} />
                  Add to Cart
                </Button>
              </motion.div>

              {/* Success Message */}
              {showAddedMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2"
                >
                  <span>✓ Added to cart successfully!</span>
                </motion.div>
              )}

              {/* Product Details Info */}
              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Availability</p>
                  <p className="font-semibold text-foreground">
                    {product.inStock ? 'In Stock' : 'Out of Stock'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Category</p>
                  <p className="font-semibold text-foreground">{product.category}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </>
  );
}
