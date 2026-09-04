'use client';

import { useState } from 'react';
import { useViewProducts } from '@/lib/hooks/use-view-products';
import FullscreenProductViewer from '@/components/fullscreen-product-viewer';
import Header from '@/components/header';

import { loadGalleryFilters, clearGalleryFilters } from '@/lib/utils/filter-storage';

interface ViewPageProps {
  fallbackData?: any;
  initialProductId?: string;
  initialCategory?: string;
  initialSubcategory?: string;
  initialSortBy?: string;
  initialTimeFilter?: string;
  initialSearchQuery?: string;
}

export default function SingleViewPage({
  fallbackData,
  initialProductId,
  initialCategory,
  initialSubcategory,
  initialSortBy,
  initialTimeFilter,
  initialSearchQuery,
}: ViewPageProps) {
  const savedFilters = loadGalleryFilters();

  const activeCategory = initialCategory || (savedFilters.categories.length > 0 ? savedFilters.categories[0] : undefined);
  const activeSubcategory = initialSubcategory || (savedFilters.subcategories.length > 0 ? savedFilters.subcategories[0] : undefined);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || savedFilters.searchQuery || '');
  const [sortBy, setSortBy] = useState(initialSortBy || savedFilters.sortBy || 'newest');
  const [timeFilter, setTimeFilter] = useState(initialTimeFilter || savedFilters.timeFilter || 'all');

  const backendSort = sortBy === 'price-low' ? 'price-low'
    : sortBy === 'price-high' ? 'price-high'
      : sortBy;

  // Use specialized useViewProducts hook: loads first 50 & last 50 upfront in online mode + bidirectional instant buffering
  const {
    products,
    isLoading,
    isValidating,
    totalCount,
    exactMatchFound,
    prioritizeIndex,
  } = useViewProducts({
    sort: backendSort || 'newest',
    timeFilter: timeFilter || 'all',
    category: activeCategory,
    subcategory: activeSubcategory,
    search: searchQuery || initialProductId,
    productId: initialProductId,
    fallbackData: Array.isArray(fallbackData) && fallbackData.length > 0 ? fallbackData : undefined,
    limit: 50,
  });

  const handleClearFilters = () => {
    clearGalleryFilters();
    setSearchQuery('');
    setSortBy('newest');
    setTimeFilter('all');
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
        prioritizeIndex={prioritizeIndex}
        onSearch={setSearchQuery}
        exactMatchFound={exactMatchFound}
        activeCategory={activeCategory}
        activeSubcategory={activeSubcategory}
        activeSortBy={sortBy}
        onSortChange={setSortBy}
        activeTimeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
        onClearFilters={handleClearFilters}
      />
    </>
  );
}
