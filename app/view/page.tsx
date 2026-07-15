'use client';

import { useAuth } from '@/lib/contexts/auth-context';
import FullscreenProductViewer from '@/components/fullscreen-product-viewer';
import Header from '@/components/header';
import LoginForm from '@/components/login-form';
import { motion } from 'framer-motion';

export default function SingleViewPage() {
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
      <Header showSearch={false} />
      <FullscreenProductViewer />
    </>
  );
}
