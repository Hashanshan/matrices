import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Route Handler — acts as an Image proxy.
 * Hides the original bucket URL from the browser.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const encodedUrl = searchParams.get('url');

    if (!encodedUrl) {
      return new NextResponse('Missing URL parameter', { status: 400 });
    }

    const imageUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');

    const imageRes = await fetch(imageUrl, {
      headers: {
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      // Cache image requests for 1 hour to reduce bandwidth
      next: { revalidate: 3600 }
    });

    if (!imageRes.ok) {
      return new NextResponse('Failed to fetch image', { status: imageRes.status });
    }

    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imageRes.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
      },
    });
  } catch (err) {
    console.error('[Image Proxy] Error fetching image:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
