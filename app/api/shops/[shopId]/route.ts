import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_API_URL || 'http://localhost:5000';

export const dynamic = 'force-static';
export function generateStaticParams() {
  return [{ shopId: '1' }, { shopId: 'default' }];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const { shopId } = await params;
    const authHeader = request.headers.get('Authorization') || '';
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    const basePath = BACKEND_URL.endsWith('/api')
      ? `/catelogue/shops/byid/${shopId}`
      : `/api/catelogue/shops/byid/${shopId}`;

    const targetUrl = queryString ? `${BACKEND_URL}${basePath}?${queryString}` : `${BACKEND_URL}${basePath}`;

    const backendRes = await fetch(targetUrl, {
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
    return NextResponse.json(data);
  } catch (err) {
    console.error('[API Proxy] Error fetching catalogue shop details from backend:', err);
    return NextResponse.json({ msg: 'Internal proxy error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const { shopId } = await params;
    const authHeader = request.headers.get('Authorization') || '';
    const body = await request.json().catch(() => ({}));

    const basePath = BACKEND_URL.endsWith('/api')
      ? `/catelogue/shops/byid/${shopId}`
      : `/api/catelogue/shops/byid/${shopId}`;

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
    console.error('[API Proxy] Error posting catalogue shop details from backend:', err);
    return NextResponse.json({ msg: 'Internal proxy error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const { shopId } = await params;
    const authHeader = request.headers.get('Authorization') || '';
    const body = await request.json().catch(() => ({}));

    const basePath = BACKEND_URL.endsWith('/api')
      ? `/catelogue/shops/update/${shopId}`
      : `/api/catelogue/shops/update/${shopId}`;

    const backendRes = await fetch(`${BACKEND_URL}${basePath}`, {
      method: 'PUT',
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
    console.error('[API Proxy] Error updating catalogue shop in backend:', err);
    return NextResponse.json({ msg: 'Internal proxy error' }, { status: 500 });
  }
}

