import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_API_URL || 'http://localhost:5000';

export const dynamic = 'force-static';
export function generateStaticParams() {
  return [{ orderId: '1' }, { orderId: 'default' }];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const authHeader = request.headers.get('Authorization') || '';
    const basePath = BACKEND_URL.endsWith('/api')
      ? `/catelogue/orders/byid/${orderId}`
      : `/api/catelogue/orders/byid/${orderId}`;

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
    return NextResponse.json(data);
  } catch (err) {
    console.error('[API Proxy] Error fetching catalogue order details from backend:', err);
    return NextResponse.json({ msg: 'Internal proxy error' }, { status: 500 });
  }
}
