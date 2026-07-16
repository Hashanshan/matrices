'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import LoginForm from '@/components/login-form';
import Header from '@/components/header';
import ProductGallery from '@/components/product-gallery';
import { motion } from 'framer-motion';

export default function GalleryPage() {
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
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center mb-12"
            >
              <h1 className="text-5xl font-bold text-foreground mb-4">Welcome to Matrices</h1>
              <p className="text-xl text-muted-foreground">
                Please log in to access the catalog
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
      <Header
        // searchQuery={searchQuery}
        // onSearchChange={setSearchQuery}
        // showSearch={true}.
        showSearch={false}
      />
      <main className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ProductGallery searchQuery={searchQuery} />
        </div>
      </main>
    </>
  );
}
