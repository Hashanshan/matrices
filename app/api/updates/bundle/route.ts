import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { findUpdateFile, getVersionManifest } from '@/lib/updates/server-paths';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl?.searchParams;
  let fileName = searchParams?.get('file');

  // If no file param, check version manifest for the latest bundleFileName
  if (!fileName) {
    const manifest = await getVersionManifest();
    fileName = manifest.bundleFileName || `app-v${manifest.version}.zip`;
  }

  // Prevent directory traversal attacks
  const sanitizedFileName = path.basename(fileName);
  if (!sanitizedFileName.endsWith('.zip')) {
    return new NextResponse('Invalid bundle file format', { status: 400 });
  }

  const filePath = findUpdateFile(sanitizedFileName);

  if (!filePath) {
    console.error(`[Updates API] Bundle not found for: ${sanitizedFileName}. Working dir: ${process.cwd()}`);
    return new NextResponse('Bundle file not found on server', { status: 404 });
  }

  try {
    const stats = await fs.stat(filePath);
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `attachment; filename="${sanitizedFileName}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error(`[Updates API] Error reading bundle from ${filePath}:`, error);
    return new NextResponse('Bundle file not found on server', { status: 404 });
  }
}
