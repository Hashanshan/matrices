'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useCart } from '@/lib/contexts/cart-context';
import LoginForm from '@/components/login-form';
import Header from '@/components/header';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle, Package, Calendar, MapPin, Mail, Phone } from 'lucide-react';
import Button from '@/components/ui/button';

interface Order {
  id: string;
  date: string;
  items: any[];
  total: number;
  user: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
  };
}

export default function OrderConfirmationPage() {
  const { isLoggedIn, user } = useAuth();
  const { cart, orders } = useCart();
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (orders && orders.length > 0) {
      setLastOrder(orders[orders.length - 1]);
    }
  }, [orders]);

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center min-h-screen px-4"
        >
          <div className="w-full max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center mb-12"
            >
              <h1 className="text-5xl font-bold text-foreground mb-4">Welcome</h1>
              <p className="text-xl text-muted-foreground">Login to view your orders</p>
            </motion.div>
            <LoginForm />
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {!lastOrder ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <p className="text-lg text-muted-foreground mb-6">No orders found</p>
              <Link href="/view">
                <Button className="bg-accent text-accent-foreground">
                  Continue Shopping
                </Button>
              </Link>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-8"
            >
              {/* Success Message */}
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
                  className="flex justify-center mb-6"
                >
                  <CheckCircle className="w-16 h-16 text-green-500" />
                </motion.div>
                <h1 className="text-4xl font-bold text-foreground mb-2">Order Confirmed!</h1>
                <p className="text-lg text-muted-foreground">
                  Thank you for your purchase. Your order has been placed successfully.
                </p>
              </div>

              {/* Order Details Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-card border border-border rounded-lg p-6 space-y-6"
              >
                {/* Order ID & Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-border">
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Package size={18} />
                      <span className="text-sm font-medium">Order ID</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{lastOrder.id}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Calendar size={18} />
                      <span className="text-sm font-medium">Order Date</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{lastOrder.date}</p>
                  </div>
                </div>

                {/* Shipping Information */}
                <div>
                  <h2 className="text-lg font-bold text-foreground mb-4">Shipping Address</h2>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-3">
                      <MapPin size={18} className="flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">{lastOrder.user.name}</p>
                        <p>{lastOrder.user.address}</p>
                        <p>{lastOrder.user.city}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone size={18} />
                      <p>{lastOrder.user.phone}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail size={18} />
                      <p>{lastOrder.user.email}</p>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h2 className="text-lg font-bold text-foreground mb-4">Order Items</h2>
                  <div className="space-y-3">
                    {lastOrder.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex gap-4 p-3 bg-background rounded-lg border border-border"
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">{item.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Qty: {item.quantity}
                            {item.selectedColor && ` • Color: ${item.selectedColor}`}
                            {item.selectedSize && ` • Size: ${item.selectedSize}`}
                          </p>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground italic">
                              Notes: {item.notes}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-foreground">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ${item.price} each
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Summary */}
                <div className="pt-6 border-t border-border space-y-3">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>${(lastOrder.total * 0.9).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax (10%)</span>
                    <span>${(lastOrder.total * 0.1).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping</span>
                    <span className="text-green-500">Free</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold text-foreground pt-3 border-t border-border">
                    <span>Total</span>
                    <span className="text-accent">${lastOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </motion.div>

              {/* Next Steps */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-accent/5 border border-accent/20 rounded-lg p-6"
              >
                <h2 className="text-lg font-bold text-foreground mb-3">What&apos;s Next?</h2>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex gap-3">
                    <span className="text-accent font-bold">✓</span>
                    <span>You&apos;ll receive a confirmation email shortly at {lastOrder.user.email}</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-accent font-bold">✓</span>
                    <span>Your order will be processed and shipped within 2-3 business days</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-accent font-bold">✓</span>
                    <span>Track your order status from your account dashboard</span>
                  </li>
                </ul>
              </motion.div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
                <Link href="/view">
                  <Button className="bg-accent text-accent-foreground w-full sm:w-auto">
                    Continue Shopping
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Back to Home
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </>
  );
}
