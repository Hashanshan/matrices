import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { findUpdateFile, getVersionManifest } from '@/lib/updates/server-paths';

export const dynamic = 'force-static';

export async function GET() {
  const manifest = await getVersionManifest();
  const targetApkName = manifest.apkFileName ? path.basename(manifest.apkFileName) : 'matrices-latest.apk';

  // Attempt to find the specific configured APK or fallback to any latest APK
  let filePath = findUpdateFile(targetApkName) || findUpdateFile('matrices-latest.apk');

  if (!filePath) {
    console.error(`[Updates API] APK file not found for "${targetApkName}". Working dir: ${process.cwd()}`);
    return new NextResponse('APK file not found on server', { status: 404 });
  }

  try {
    const stats = await fs.stat(filePath);
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    const downloadFileName = path.basename(filePath);

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `attachment; filename="${downloadFileName}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error(`[Updates API] Error streaming APK from ${filePath}:`, error);
    return new NextResponse('Error reading APK file', { status: 500 });
  }
}
