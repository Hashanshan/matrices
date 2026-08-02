'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ViewClient from './view-client';

function ViewPageContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId') || searchParams.get('id') || searchParams.get('code') || '';
  const category = searchParams.get('category') || '';
  const subcategory = searchParams.get('subcategory') || '';

  return (
    <ViewClient
      fallbackData={[]}
      initialProductId={productId}
      initialCategory={category}
      initialSubcategory={subcategory}
    />
  );
}

export default function ViewPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-transparent py-8 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
        </main>
      }
    >
      <ViewPageContent />
    </Suspense>
  );
}
