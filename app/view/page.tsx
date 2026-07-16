'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useCart } from '@/lib/contexts/cart-context';
import FullscreenProductViewer from '@/components/fullscreen-product-viewer';
import LoginForm from '@/components/login-form';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Menu, X, Home, Grid, BookOpen, ShoppingCart } from 'lucide-react';

export default function SingleViewPage() {
  const { isLoggedIn } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const { cart } = useCart();

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
              <h1 className="text-5xl font-bold text-foreground mb-4">Welcome to Matrices</h1>
              <p className="text-xl text-muted-foreground">
                Login to explore our premium tech collection
              </p>
            </motion.div>
            <LoginForm />
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <>
      {/* Floating Menu Toggle */}
      <div className="fixed top-6 right-6 z-[60]">
        <motion.div className="relative">
          <motion.button
            onClick={() => setMenuOpen(!menuOpen)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-12 h-12 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center shadow-lg text-white"
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
                className="absolute top-16 right-0 bg-white/90 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl p-4 w-48 flex flex-col gap-2 overflow-hidden"
              >
                {[
                  { href: '/', label: 'Home', icon: Home },
                  { href: '/categories', label: 'Categories', icon: Grid },
                  { href: '/gallery', label: 'Catalogue', icon: BookOpen },
                  { href: '/cart', label: `Cart (${cart.itemCount})`, icon: ShoppingCart },
                ].map((item) => (
                  <Link href={item.href} key={item.label} onClick={() => setMenuOpen(false)}>
                    <motion.div
                      whileHover={{ x: 4, backgroundColor: 'rgba(0,0,0,0.05)' }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-800 font-semibold text-sm transition-colors cursor-pointer"
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
      </div>

      <FullscreenProductViewer />
    </>
  );
}
