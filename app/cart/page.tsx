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
      <main className="min-h-screen bg-[#f8f9fc]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Back Button */}
          <Link href="/">
            <Button variant="ghost" className="mb-6 gap-2">
              <ArrowLeft size={18} />
              Continue Shopping
            </Button>
          </Link>

          <h1 className="text-3xl font-black text-[#0f172a] mb-8 tracking-tight">Shopping Cart</h1>

          {cart.items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-[2rem] border border-gray-50 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.06)]"
            >
              <p className="text-lg text-gray-500 font-semibold mb-6">Your cart is empty</p>
              <Link href="/">
                <Button className="bg-[#0f172a] hover:bg-[#1e293b] text-white px-8 py-6 rounded-full font-bold shadow-md">
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
                      className="bg-white border border-gray-50 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.06)] rounded-[2rem] p-6 flex gap-6"
                    >
                      {/* Product Image */}
                      <div className="flex-shrink-0 w-28 h-28 rounded-2xl overflow-hidden bg-[#f8f9fc] p-2">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-contain mix-blend-multiply"
                        />
                      </div>

                      {/* Product Details */}
                      <div className="flex-1">
                        <h3 className="font-bold text-[#0f172a] text-xl mb-1">
                          {product.name}
                        </h3>

                        {/* Variants */}
                        <div className="flex gap-4 text-sm text-gray-500 font-medium mb-3">
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
                          <div className="flex items-center gap-3 border border-gray-100 rounded-full p-1 bg-gray-50 shadow-sm">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuantityChange(product.id, product.quantity - 1)}
                              className="h-8 w-8 p-0 rounded-full hover:bg-white hover:text-[#0f172a]"
                            >
                              -
                            </Button>
                            <span className="text-sm font-bold text-[#0f172a] w-6 text-center">
                              {product.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuantityChange(product.id, product.quantity + 1)}
                              className="h-8 w-8 p-0 rounded-full hover:bg-white hover:text-[#0f172a]"
                            >
                              +
                            </Button>
                          </div>

                          <div className="text-right">
                            <p className="text-2xl font-black text-[#0f172a]">
                              {formatPrice(product.price * product.quantity)}
                            </p>
                            <p className="text-xs font-semibold text-gray-400 mt-1">
                              {formatPrice(product.price)} each
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <motion.button
                        whileHover={{ scale: 1.1, rotate: 10 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => removeFromCart(product.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors self-start p-2"
                      >
                        <Trash2 size={20} />
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="lg:col-span-1"
              >
                <div className="sticky top-24 bg-white border border-gray-50 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.06)] rounded-[2rem] p-8 space-y-6">
                  <h2 className="text-xl font-black text-[#0f172a]">Order Summary</h2>

                  <div className="space-y-3 border-b border-gray-100 pb-6">
                    <div className="flex justify-between text-gray-600 font-medium">
                      <span>Subtotal</span>
                      <span className="font-bold text-[#0f172a]">{formatPrice(cart.total)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 font-medium">
                      <span>Shipping</span>
                      <span className="text-green-600 font-bold">Free</span>
                    </div>
                    <div className="flex justify-between text-gray-600 font-medium">
                      <span>Tax</span>
                      <span className="font-bold text-[#0f172a]">{formatPrice(cart.total * 0.1)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between text-xl font-black text-[#0f172a]">
                    <span>Total</span>
                    <span>{formatPrice(cart.total * 1.1)}</span>
                  </div>

                  {/* User Info */}
                  {user && (
                    <div className="bg-[#f8f9fc] rounded-2xl p-4 text-sm space-y-1.5 border border-gray-50">
                      <p className="font-bold text-[#0f172a]">{user.name}</p>
                      <p className="text-gray-500 font-medium">{user.email}</p>
                      <p className="text-gray-500 font-medium">{user.address}</p>
                      <p className="text-gray-500 font-medium">
                        {user.city}, {user.zipCode}
                      </p>
                    </div>
                  )}

                  {/* Checkout Button */}
                  <Button
                    onClick={handlePlaceOrder}
                    className="w-full bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold py-6 rounded-full shadow-md text-lg"
                  >
                    Place Order
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => clearCart()}
                    className="w-full rounded-full py-5 font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 border-gray-200"
                  >
                    Clear Cart
                  </Button>

                  <Link href="/" className="block">
                    <Button variant="ghost" className="w-full rounded-full py-5 font-semibold text-gray-500 hover:text-[#0f172a] hover:bg-gray-100">
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
