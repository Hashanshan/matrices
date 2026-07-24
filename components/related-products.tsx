'use client';

import { useProducts } from '@/lib/hooks/use-products';
import ProductCard from './product-card';
import { motion } from 'framer-motion';

export default function RelatedProducts() {
  const { products, isLoading } = useProducts({
    sort: 'newest',
    limit: 8,
  });

  if (isLoading) {
    return (
      <div className="mt-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f172a]"></div>
      </div>
    );
  }

  if (!products || products.length === 0) return null;

  return (
    <div className="mt-16 w-full max-w-7xl mx-auto">
      <h3 className="text-2xl font-black text-[#0f172a] mb-8 uppercase tracking-widest text-center">
        Related Products
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        {products.map((product, index) => (
          <ProductCard key={product.id} product={product} index={index} />
        ))}
      </div>
    </div>
  );
}
