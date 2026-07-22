'use client';

import { useAllProducts } from '@/lib/hooks/use-products';
import FullscreenProductViewer from '@/components/fullscreen-product-viewer';
import Header from '@/components/header';

export default function SingleViewPage() {
  // SWR-cached fetch with 'view' sort (subCategory -> category -> name)
  // Instant on revisit, silently revalidates in background
  const { products, isLoading, isValidating } = useAllProducts({ sort: 'view' });

  if (isLoading && products.length === 0) {
    return (
      <>
        <Header showSearch={false} />
        <main className="min-h-screen bg-transparent py-8 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
        </main>
      </>
    );
  }

  if (products.length === 0) {
    return (
      <>
        <Header showSearch={false} />
        <main className="min-h-screen bg-transparent py-8 flex justify-center items-center">
          <div className="text-gray-500 font-bold">No products found.</div>
        </main>
      </>
    );
  }

  return (
    <>
      {/* Subtle revalidation indicator */}
      {isValidating && products.length > 0 && (
        <div className="fixed top-4 right-4 z-50">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0f172a]/30"></div>
        </div>
      )}
      <FullscreenProductViewer products={products} />
    </>
  );
}
