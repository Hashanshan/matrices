'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({ currentPage, totalPages, onPageChange, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = [];
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className={`flex items-center justify-center gap-2 flex-wrap ${className}`}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="px-3.5 py-2 rounded-full font-black text-xs uppercase bg-white/60 hover:bg-white text-[#0f172a] border border-white/60 shadow-xs transition-all disabled:opacity-30 disabled:hover:bg-white/60 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
      >
        <ChevronLeft size={14} /> PREV
      </button>

      {startPage > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className="w-8 h-8 rounded-full font-black text-xs bg-white/60 hover:bg-white text-[#0f172a] border border-white/60 shadow-xs transition-all flex items-center justify-center cursor-pointer"
          >
            1
          </button>
          {startPage > 2 && <span className="text-xs font-black text-[#0f172a]">...</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`w-8 h-8 rounded-full font-black text-xs transition-all flex items-center justify-center border shadow-xs cursor-pointer ${
            p === currentPage
              ? 'bg-[#0f172a] text-white border-[#0f172a] shadow-md scale-105'
              : 'bg-white/60 hover:bg-white text-[#0f172a] border-white/60'
          }`}
        >
          {p}
        </button>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="text-xs font-black text-[#0f172a]">...</span>}
          <button
            onClick={() => onPageChange(totalPages)}
            className="w-8 h-8 rounded-full font-black text-xs bg-white/60 hover:bg-white text-[#0f172a] border border-white/60 shadow-xs transition-all flex items-center justify-center cursor-pointer"
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="px-3.5 py-2 rounded-full font-black text-xs uppercase bg-white/60 hover:bg-white text-[#0f172a] border border-white/60 shadow-xs transition-all disabled:opacity-30 disabled:hover:bg-white/60 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
      >
        NEXT <ChevronRight size={14} />
      </button>
    </div>
  );
}
