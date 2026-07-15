'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/contexts/cart-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { PRODUCTS } from '@/lib/mock-data';
import { motion } from 'framer-motion';
import { Trash2, ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Header from '@/components/header';
import { formatPrice } from '@/lib/currency';

export default function CartPage() {
  const router = useRouter();
  const { cart, removeFromCart, updateCartItem, clearCart, placeOrder } = useCart();
  const { user } = useAuth();

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity > 0) {
      updateCartItem(productId, { quantity: newQuantity });
    }
  };

  const handlePlaceOrder = () => {
    if (!user) {
      alert('Please log in first');
      return;
    }

    if (cart.items.length === 0) {
      alert('Your cart is empty');
      return;
    }

    const order = {
      id: `ORD-${Date.now()}`,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      items: cart.items,
      total: cart.total * 1.1,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        city: user.city || 'City',
      },
    };

    placeOrder(order);
    clearCart();
    
    // Redirect to order confirmation
    router.push('/order-confirmation');
  };



  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Button */}
          <Link href="/">
            <Button variant="ghost" className="mb-6 gap-2">
              <ArrowLeft size={18} />
              Continue Shopping
            </Button>
          </Link>

          <h1 className="text-3xl font-bold text-foreground mb-8">Shopping Cart</h1>

          {cart.items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center bg-card rounded-lg border border-border"
            >
              <p className="text-lg text-muted-foreground mb-4">Your cart is empty</p>
              <Link href="/">
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  Start Shopping
                </Button>
              </Link>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                {cart.items.map((item, index) => {
                  const product = item;

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-card border border-border rounded-lg p-6 flex gap-6"
                    >
                      {/* Product Image */}
                      <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-secondary">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Product Details */}
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground text-lg mb-2">
                          {product.name}
                        </h3>

                        {/* Variants */}
                        <div className="flex gap-4 text-sm text-muted-foreground mb-3">
                          {product.selectedColor && <span>Color: {product.selectedColor}</span>}
                          {product.selectedSize && <span>Size: {product.selectedSize}</span>}
                        </div>

                        {/* Notes */}
                        {product.notes && (
                          <p className="text-xs text-muted-foreground mb-3 italic">
                            Note: {product.notes}
                          </p>
                        )}

                        {/* Quantity & Price */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 border border-border rounded-lg p-1 bg-secondary">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuantityChange(product.id, product.quantity - 1)}
                              className="h-6 w-6 p-0"
                            >
                              -
                            </Button>
                            <span className="text-sm font-semibold text-foreground w-6 text-center">
                              {product.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuantityChange(product.id, product.quantity + 1)}
                              className="h-6 w-6 p-0"
                            >
                              +
                            </Button>
                          </div>

                          <div className="text-right">
                            <p className="text-2xl font-bold text-accent">
                              {formatPrice(product.price * product.quantity)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatPrice(product.price)} each
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => removeFromCart(product.id)}
                        className="text-destructive hover:text-destructive/80 transition-colors self-start"
                      >
                        <Trash2 size={20} />
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>

              {/* Order Summary */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="lg:col-span-1"
              >
                <div className="sticky top-24 bg-card border border-border rounded-lg p-6 space-y-4">
                  <h2 className="text-xl font-bold text-foreground">Order Summary</h2>

                  <div className="space-y-2 border-b border-border pb-4">
                    <div className="flex justify-between text-foreground">
                      <span>Subtotal</span>
                      <span>{formatPrice(cart.total)}</span>
                    </div>
                    <div className="flex justify-between text-foreground">
                      <span>Shipping</span>
                      <span className="text-green-600 font-semibold">Free</span>
                    </div>
                    <div className="flex justify-between text-foreground">
                      <span>Tax</span>
                      <span>{formatPrice(cart.total * 0.1)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between text-lg font-bold text-foreground">
                    <span>Total</span>
                    <span className="text-accent">{formatPrice(cart.total * 1.1)}</span>
                  </div>

                  {/* User Info */}
                  {user && (
                    <div className="bg-secondary rounded-lg p-3 text-sm space-y-1">
                      <p className="font-semibold text-foreground">{user.name}</p>
                      <p className="text-muted-foreground">{user.email}</p>
                      <p className="text-muted-foreground">{user.address}</p>
                      <p className="text-muted-foreground">
                        {user.city}, {user.zipCode}
                      </p>
                    </div>
                  )}

                  {/* Checkout Button */}
                  <Button
                    onClick={handlePlaceOrder}
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold py-3 rounded-lg"
                  >
                    Place Order
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => clearCart()}
                    className="w-full"
                  >
                    Clear Cart
                  </Button>

                  <Link href="/" className="block">
                    <Button variant="ghost" className="w-full">
                      Continue Shopping
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
