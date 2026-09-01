import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

export const dynamic = 'force-static';

export async function GET() {
  const versionFilePath = path.join(process.cwd(), 'updates', 'version.json');
  let apkFileName = 'matrices-latest.apk';

  try {
    const fileData = await fs.readFile(versionFilePath, 'utf8');
    const parsed = JSON.parse(fileData);
    if (parsed.apkFileName) {
      apkFileName = path.basename(parsed.apkFileName);
    }
  } catch (err) {
    console.warn('[Updates API] Could not read version.json for APK filename, using default.', err);
  }

  const filePath = path.join(process.cwd(), 'updates', apkFileName);

  try {
    const stats = await fs.stat(filePath);
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `attachment; filename="${apkFileName}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error(`[Updates API] APK file not found at: ${filePath}`, error);
    return new NextResponse('APK file not found on server', { status: 404 });
  }
}
