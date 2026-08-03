'use client';

import { useState } from 'react';
import { useProducts } from '@/lib/hooks/use-products';
import FullscreenProductViewer from '@/components/fullscreen-product-viewer';
import Header from '@/components/header';

import { loadGalleryFilters, clearGalleryFilters } from '@/lib/utils/filter-storage';

interface ViewPageProps {
  fallbackData?: any;
  initialProductId?: string;
  initialCategory?: string;
  initialSubcategory?: string;
  initialSortBy?: string;
  initialSearchQuery?: string;
}

export default function SingleViewPage({
  fallbackData,
  initialProductId,
  initialCategory,
  initialSubcategory,
  initialSortBy,
  initialSearchQuery,
}: ViewPageProps) {
  const savedFilters = loadGalleryFilters();

  const activeCategory = initialCategory || (savedFilters.categories.length > 0 ? savedFilters.categories[0] : undefined);
  const activeSubcategory = initialSubcategory || (savedFilters.subcategories.length > 0 ? savedFilters.subcategories[0] : undefined);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || savedFilters.searchQuery || '');
  const [sortBy, setSortBy] = useState(initialSortBy || savedFilters.sortBy || 'view');

  const backendSort = sortBy === 'price-low' ? 'price-low'
    : sortBy === 'price-high' ? 'price-high'
    : sortBy;

  // Use the cursor-paginated useProducts hook
  const {
    products,
    isLoading,
    isLoadingMore,
    isValidating,
    hasMore,
    loadMore,
    totalCount,
    exactMatchFound,
  } = useProducts({
    sort: backendSort,
    search: searchQuery,
    productId: initialProductId,
    category: activeCategory,
    subcategory: activeSubcategory,
    prioritizeCategory: activeCategory,
    fallbackData: Array.isArray(fallbackData) && fallbackData.length > 0 ? fallbackData : undefined,
    initialLimit: 20,
    limit: 10,
  });

  const handleClearFilters = () => {
    clearGalleryFilters();
    setSearchQuery('');
    setSortBy('newest');
  };

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
        key={initialProductId || 'viewer'}
        products={products}
        initialProductId={initialProductId}
        totalCount={totalCount}
        hasMore={hasMore}
        loadMore={loadMore}
        isLoadingMore={isLoadingMore}
        onSearch={setSearchQuery}
        exactMatchFound={exactMatchFound}
        activeCategory={activeCategory}
        activeSubcategory={activeSubcategory}
        activeSortBy={sortBy}
        onSortChange={setSortBy}
        onClearFilters={handleClearFilters}
      />
    </>
  );
}
