import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

export const dynamic = 'force-static';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl?.searchParams;
  let fileName = searchParams?.get('file') || 'app-latest.zip';

  // If no file param, check version.json for the latest bundleFileName
  if (!searchParams?.get('file')) {
    try {
      const versionFilePath = path.join(process.cwd(), 'updates', 'version.json');
      const fileData = await fs.readFile(versionFilePath, 'utf8');
      const parsed = JSON.parse(fileData);
      if (parsed.bundleFileName) {
        fileName = parsed.bundleFileName;
      }
    } catch {
      // Use fallback
    }
  }

  // Prevent directory traversal attacks
  const sanitizedFileName = path.basename(fileName);
  if (!sanitizedFileName.endsWith('.zip')) {
    return new NextResponse('Invalid bundle file format', { status: 400 });
  }

  const filePath = path.join(process.cwd(), 'updates', sanitizedFileName);

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
    console.error(`[Updates API] Bundle not found at: ${filePath}`, error);
    return new NextResponse('Bundle file not found on server', { status: 404 });
  }
}
