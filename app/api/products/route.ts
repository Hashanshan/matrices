import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Route Handler — acts as a BFF (Backend For Frontend) proxy.
 * 
 * The browser calls `/api/products?...` and this handler forwards the request
 * to the real backend using the server-side-only `BACKEND_API_URL` env variable.
 * 
 * This completely hides the real backend URL from the browser's Network tab.
 * The auth token is forwarded from the client's Authorization header.
 */

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    // Forward query params as-is
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    // Forward the Authorization header from the client
    const authHeader = request.headers.get('Authorization') || '';

    const backendRes = await fetch(
      `${BACKEND_URL}/api/catelogue/products${queryString ? `?${queryString}` : ''}`,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        // Don't cache on the server — we want fresh data to flow through
        cache: 'no-store',
      }
    );

    if (!backendRes.ok) {
      const errorData = await backendRes.json().catch(() => ({ msg: 'Backend error' }));
      return NextResponse.json(errorData, { status: backendRes.status });
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[API Proxy] Error forwarding to backend:', err);
    return NextResponse.json({ msg: 'Internal proxy error' }, { status: 500 });
  }
}
