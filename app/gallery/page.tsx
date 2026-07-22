'use client';

import { Suspense } from 'react';
import Header from '@/components/header';
import ProductGallery from '@/components/product-gallery';
import { useSearchParams } from 'next/navigation';

function GalleryContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || '';

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ProductGallery searchQuery="" initialCategory={initialCategory} />
        </div>
      </main>
    </>
  );
}

export default function GalleryPage() {
  return (
    <Suspense fallback={
      <>
        <Header showSearch={false} />
        <main className="min-h-screen bg-background flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
        </main>
      </>
    }>
      <GalleryContent />
    </Suspense>
  );
}
