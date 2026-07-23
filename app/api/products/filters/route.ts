import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_API_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const basePath = BACKEND_URL.endsWith('/api') ? '/catelogue/products/filters' : '/api/catelogue/products/filters';

    const backendRes = await fetch(`${BACKEND_URL}${basePath}`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Always fetch fresh filters
    });

    if (!backendRes.ok) {
      const errorData = await backendRes.json().catch(() => ({ msg: 'Backend error' }));
      return NextResponse.json(errorData, { status: backendRes.status });
    }

    const data = await backendRes.json();

    // Reform image URLs to hide bucket URL
    if (data && data.categories && Array.isArray(data.categories)) {
      data.categories = data.categories.map((cat: any) => {
        if (cat.image && cat.image.startsWith('http')) {
          cat.image = `/api/image?url=${Buffer.from(cat.image).toString('base64')}`;
        }
        if (cat.subcategories && Array.isArray(cat.subcategories)) {
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

    return NextResponse.json(data);
  } catch (err) {
    console.error('[API Proxy] Error fetching filters from backend:', err);
    return NextResponse.json({ msg: 'Internal proxy error' }, { status: 500 });
  }
}
