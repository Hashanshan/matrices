'use client';

import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { triggerBack } from '@/lib/utils/back-navigation';

interface BackButtonProps {
  className?: string;
  label?: string;
  showLabel?: boolean;
  onClick?: () => void;
}

export default function BackButton({
  className = '',
  label = '',
  showLabel = true,
  onClick,
}: BackButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      triggerBack();
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05, x: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      className={`inline-flex items-center  px-2.5 py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-gray-200/80 text-[#0f172a] shadow-md hover:bg-white hover:border-gray-300 hover:shadow-md transition-all font-bold text-xs sm:text-sm group cursor-pointer ${className}`}
      title="Go Back"
      aria-label="Go Back"
    >
      <ChevronLeft size={18} className="text-[#0f172a] group-hover:-translate-x-0.5 transition-transform" />
      {/* {showLabel && <span className="hidden sm:inline">{label}</span>} */}
    </motion.button>
  );
}
