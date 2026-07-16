'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  className?: string;
}

export default function CustomSelect({ options, value, onChange, icon, className = '' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between pl-11 pr-4 py-3.5 border-2 border-gray-100 rounded-full bg-white text-[#0f172a] font-bold text-sm focus:outline-none focus:border-[#0f172a] focus:ring-4 focus:ring-blue-900/5 transition-all shadow-sm hover:border-gray-200"
      >
        {icon && (
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
            {icon}
          </div>
        )}
        <span className="truncate">{selectedOption?.label}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-gray-400 ml-2" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-[100] w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden"
          >
            <ul className="py-2 flex flex-col">
              {options.map((option) => (
                <li
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`px-4 py-3 text-sm font-semibold cursor-pointer transition-colors hover ${value === option.value
                    ? 'bg-[#0F172A] text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
