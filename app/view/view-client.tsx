'use client';

import { useState } from 'react';
import { useProducts } from '@/lib/hooks/use-products';
import FullscreenProductViewer from '@/components/fullscreen-product-viewer';
import Header from '@/components/header';

interface ViewPageProps {
  fallbackData?: any;
  initialProductId?: string;
  initialCategory?: string;
  initialSubcategory?: string;
}

export default function SingleViewPage({ fallbackData, initialProductId, initialCategory, initialSubcategory }: ViewPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('view');

  // Use the cursor-paginated useProducts hook
  const {
    products,
    isLoading,
    isLoadingMore,
    isValidating,
    hasMore,
    loadMore,
    totalCount,
  } = useProducts({
    sort: sortBy,
    search: searchQuery,
    productId: initialProductId,
    prioritizeCategory: initialCategory,
    fallbackData: fallbackData ? [fallbackData] : undefined,
    initialLimit: 20,
    limit: 10,
  });

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

  return (
    <>
      {/* Subtle revalidation indicator */}
      {isValidating && products.length > 0 && (
        <div className="fixed top-4 right-4 z-50">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0f172a]/30"></div>
        </div>
      )}
      <FullscreenProductViewer
        products={products}
        initialProductId={initialProductId}
        totalCount={totalCount}
        hasMore={hasMore}
        loadMore={loadMore}
        isLoadingMore={isLoadingMore}
        onSearch={setSearchQuery}
      />
    </>
  );
}
