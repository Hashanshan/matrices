'use client';

import { motion } from 'framer-motion';

export default function ViewTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, rotateY: -90, transformOrigin: 'left center' }}
      animate={{ opacity: 1, rotateY: 0, transformOrigin: 'left center' }}
      exit={{ opacity: 0, rotateY: 90, transformOrigin: 'right center' }}
      transition={{
        type: 'spring',
        stiffness: 50,
        damping: 18,
        mass: 0.8,
        duration: 0.7,
      }}
      style={{ perspective: '1500px' }}
    >
      {children}
    </motion.div>
  );
}
