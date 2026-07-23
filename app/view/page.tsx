import { cookies } from 'next/headers';
import ViewClient from './view-client';

export const dynamic = 'force-dynamic';

async function getInitialProducts(productId?: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    return { data: [], category: '', subcategory: '' }; 
  }

  try {
    const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_API_URL || 'http://localhost:5000';
    const basePath = BACKEND_URL.endsWith('/api') ? '/catelogue/products' : '/api/catelogue/products';

    let category = '';
    let subcategory = '';

    if (productId) {
      const singleRes = await fetch(`${BACKEND_URL}${basePath}?productId=${productId}&limit=1`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      if (singleRes.ok) {
        const singleData = await singleRes.json();
        if (singleData?.data?.[0]) {
          category = singleData.data[0].categories || '';
          subcategory = singleData.data[0].subcategories || '';
        }
      }
    }

    const params = new URLSearchParams();
    params.set('limit', '20');
    params.set('sort', 'view');
    params.set('page', '1');
    if (productId) params.set('productId', productId);
    if (category) params.set('prioritizeCategory', category);

    const res = await fetch(`${BACKEND_URL}${basePath}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return { data: [], category, subcategory };
    }

    const data = await res.json();
    
    // Reform image URLs to hide bucket URL using our image proxy
    if (data && data.data && Array.isArray(data.data)) {
      data.data = data.data.map((product: any) => {
        if (product.image && product.image.startsWith('http')) {
          const encodedUrl = Buffer.from(product.image).toString('base64');
          product.image = `/api/image?url=${encodedUrl}`;
        }
        return product;
      });
    }

    return { data, category, subcategory };
  } catch (error) {
    console.error('[SSR] Error fetching products:', error);
    return { data: [], category: '', subcategory: '' };
  }
}

export default async function ViewPage({ searchParams }: { searchParams: Promise<{ productId?: string }> }) {
  const params = await searchParams;
  const { data: fallbackData, category, subcategory } = await getInitialProducts(params.productId);

  return (
    <>
      <ViewClient 
        fallbackData={fallbackData} 
        initialProductId={params.productId} 
        initialCategory={category}
        initialSubcategory={subcategory}
      />
    </>
  );
}
