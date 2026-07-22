import { cookies } from 'next/headers';
import CatalogueClient from './catalogue-client';
import Header from '@/components/header';

export const dynamic = 'force-dynamic';

async function getInitialProducts() {
  const cookieStore = cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    return { data: [] }; // The client-side AuthGuard will redirect them to login anyway
  }

  try {
    const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_API_URL || 'http://localhost:5000';
    const basePath = BACKEND_URL.endsWith('/api') ? '/catelogue/products' : '/api/catelogue/products';

    const res = await fetch(`${BACKEND_URL}${basePath}?limit=500&sort=view`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return { data: [] };
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

    return data;
  } catch (error) {
    console.error('[SSR] Error fetching products:', error);
    return { data: [] };
  }
}

export default async function CataloguePage() {
  const fallbackData = await getInitialProducts();

  return (
    <>
      <CatalogueClient fallbackData={fallbackData} />
    </>
  );
}
