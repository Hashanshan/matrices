'use client';

import { useAuth } from '@/lib/contexts/auth-context';
import LoginForm from '@/components/login-form';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import Header from '@/components/header';

export default function Page() {
  const { isLoggedIn } = useAuth();

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
      <Header showSearch={false} />
      <main className="min-h-[calc(100vh-80px)] bg-white relative flex flex-col items-center pt-16">
        {/* Background Image Layer */}
        <div className="absolute inset-0 z-0 opacity-80 pointer-events-none mt-40">
          <Image
            src="/cover-bg.png"
            alt="Stationery background"
            fill
            className="object-cover object-top mask-image-gradient"
          />
        </div>
        
        {/* Content Layer */}
        <div className="z-10 flex flex-col items-center w-full px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mb-8 relative w-[300px] sm:w-[400px] md:w-[500px] h-[100px] sm:h-[120px]"
          >
            <Image
              src="/matrices_logo.png"
              alt="Matrices"
              fill
              className="object-contain"
              priority
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="w-full max-w-3xl border-t-4 border-primary pt-6 mb-12"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium text-gray-700 tracking-wide">
              Your Complete Stationery Partner
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-8"
          >
            <Link href="/gallery">
              <button className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white font-bold text-lg rounded-full overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                <span className="relative z-10">Open Catalog</span>
                <ChevronRight className="relative z-10 transition-transform duration-300 group-hover:translate-x-1" size={24} />
                <div className="absolute inset-0 h-full w-full bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
              </button>
            </Link>
          </motion.div>
        </div>
      </main>
    </>
  );
}
