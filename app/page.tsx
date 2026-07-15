'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import LoginForm from '@/components/login-form';
import Header from '@/components/header';
import ProductGallery from '@/components/product-gallery';
import { motion } from 'framer-motion';

export default function Page() {
  const { isLoggedIn } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

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
            {/* Welcome Banner */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center mb-12"
            >
              <h1 className="text-5xl font-bold text-foreground mb-4">Welcome to Matrices</h1>
              <p className="text-xl text-muted-foreground">
                Discover our exclusive collection of premium tech products
              </p>
            </motion.div>

            {/* Login Form */}
            <LoginForm />
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <>
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showSearch={true}
      />
      <main className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <div className="bg-gradient-to-r from-accent/10 to-accent/5 rounded-lg p-8 border border-accent/20">
              <h2 className="text-4xl font-bold text-foreground mb-2">
                Explore Matrices Collection
              </h2>
              <p className="text-muted-foreground">
                Browse our curated collection of premium tech products with stunning visuals, detailed specs, and intelligent filtering.
              </p>
            </div>
          </motion.div>

          {/* Product Gallery */}
          <ProductGallery searchQuery={searchQuery} />
        </div>
      </main>
    </>
  );
}
