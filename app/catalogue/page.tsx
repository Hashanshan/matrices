import { cookies } from 'next/headers';
import CatalogueClient from './catalogue-client';

export const dynamic = 'force-dynamic';

async function getInitialFilters() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    return { categories: [], priceRange: { min: 0, max: 40000 } };
  }

  try {
    const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_API_URL || 'http://localhost:5000';
    const basePath = BACKEND_URL.endsWith('/api') ? '/catelogue/products/filters' : '/api/catelogue/products/filters';

    const res = await fetch(`${BACKEND_URL}${basePath}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return { categories: [], priceRange: { min: 0, max: 40000 } };
    }

    const data = await res.json();
    
    // Reform image URLs to hide bucket URL using our image proxy
    if (data && data.categories && Array.isArray(data.categories)) {
      data.categories = data.categories.map((cat: any) => {
        if (cat.image && cat.image.startsWith('http')) {
            cat.image = `/api/image?url=${Buffer.from(cat.image).toString('base64')}`;
        }
        if (cat.subcategories) {
            cat.subcategories = cat.subcategories.map((sub: any) => {
                if (sub.image && sub.image.startsWith('http')) {
                    sub.image = `/api/image?url=${Buffer.from(sub.image).toString('base64')}`;
                }
                return sub;
            });
        }
        return cat;
      });
    }

    return data;
  } catch (error) {
    console.error('[SSR] Error fetching filters:', error);
    return { categories: [], priceRange: { min: 0, max: 40000 } };
  }
}

export default async function CataloguePage() {
  const fallbackData = await getInitialFilters();

  return (
    <>
      <CatalogueClient fallbackData={fallbackData} />
    </>
  );
}
