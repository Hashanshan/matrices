export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_API_URL || 'http://localhost:5000';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const body = await request.json();
    const basePath = BACKEND_URL.endsWith('/api') ? '/catelogue/auth/verify-pin' : '/api/catelogue/auth/verify-pin';

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
    console.error('[API Proxy] Error verifying PIN:', err);
    return NextResponse.json({ msg: 'Internal proxy error' }, { status: 500 });
  }
}
