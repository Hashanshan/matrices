'use client';

import React from 'react';
import { useSync } from '@/lib/contexts/sync-context';
import { WifiOff, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineBanner() {
  const { isOffline, meta } = useSync();

  if (!isOffline) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className="bg-amber-500/90 backdrop-blur-md text-amber-950 px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 border-b border-amber-600/30 z-50 sticky top-0"
      >
        <WifiOff size={15} className="animate-bounce" />
        <span>Working Offline</span>
        <span className="opacity-40">•</span>
        <div className="flex items-center gap-1">
          <Database size={13} />
          <span>
            {meta?.totalProducts ? `${meta.totalProducts} items available locally` : 'Local IndexedDB Ready'}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
