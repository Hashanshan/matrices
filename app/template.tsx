'use client';

import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, rotateY: -90, transformOrigin: 'left center' }}
      animate={{ opacity: 1, rotateY: 0, transformOrigin: 'left center' }}
      exit={{ opacity: 0, rotateY: 90, transformOrigin: 'right center' }}
      transition={{
        type: 'spring',
        stiffness: 60,
        damping: 20,
        duration: 0.6,
      }}
      style={{ perspective: '1200px' }}
    >
      {children}
    </motion.div>
  );
}
