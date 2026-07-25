import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_API_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const basePath = BACKEND_URL.endsWith('/api') ? '/catelogue/wishlist' : '/api/catelogue/wishlist';

    const backendRes = await fetch(`${BACKEND_URL}${basePath}`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!backendRes.ok) {
      const errorData = await backendRes.json().catch(() => ({ msg: 'Backend error' }));
      return NextResponse.json(errorData, { status: backendRes.status });
    }

    const data = await backendRes.json();

    // Reform image URLs in fullProducts to hide storage bucket URL via image proxy
    if (data && data.wishlist && Array.isArray(data.wishlist.fullProducts)) {
      data.wishlist.fullProducts = data.wishlist.fullProducts.map((item: any) => {
        if (item.product && item.product.image && item.product.image.startsWith('http')) {
          const encodedUrl = Buffer.from(item.product.image).toString('base64');
          item.product.image = `/api/image?url=${encodedUrl}`;
        }
        return item;
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[API Proxy] Error fetching wishlist from backend:', err);
    return NextResponse.json({ msg: 'Internal proxy error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const body = await request.json();
    const basePath = BACKEND_URL.endsWith('/api') ? '/catelogue/wishlist/toggle' : '/api/catelogue/wishlist/toggle';

    const backendRes = await fetch(`${BACKEND_URL}${basePath}`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!backendRes.ok) {
      const errorData = await backendRes.json().catch(() => ({ msg: 'Backend error' }));
      return NextResponse.json(errorData, { status: backendRes.status });
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[API Proxy] Error toggling wishlist item in backend:', err);
    return NextResponse.json({ msg: 'Internal proxy error' }, { status: 500 });
  }
}
