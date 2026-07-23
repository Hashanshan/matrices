'use client';

import { useAllProducts } from '@/lib/hooks/use-products';
import FullscreenProductViewer from '@/components/fullscreen-product-viewer';
import Header from '@/components/header';

interface ViewPageProps {
  fallbackData?: any;
  initialProductId?: string;
}

export default function SingleViewPage({ fallbackData, initialProductId }: ViewPageProps) {
  // SWR-cached fetch with 'view' sort (subCategory -> category -> name)
  // Instant on revisit, silently revalidates in background
  const { products, isLoading, isValidating } = useAllProducts({ sort: 'view', fallbackData });

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
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">No products available</h2>
      </div>
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
      <FullscreenProductViewer products={products} initialProductId={initialProductId} />
    </>
  );
}
