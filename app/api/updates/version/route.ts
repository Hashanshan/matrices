import { NextResponse } from 'next/server';
import { getVersionManifest } from '@/lib/updates/server-paths';

export const dynamic = 'force-dynamic';

async function buildUpdateResponse() {
  const frontEndUrl = (process.env.NEXT_PUBLIC_FRONT_END_URL || 'https://matrices.devcodz.com').replace(/\/$/, '');
  const manifest = await getVersionManifest();

  const bundleFile = manifest.bundleFileName || `app-v${manifest.version}.zip`;
  const bundleUrl = `${frontEndUrl}/api/updates/bundle?file=${bundleFile}`;
  const apkDownloadUrl = `${frontEndUrl}/api/updates/download-apk`;

  return {
    version: manifest.version,
    build: manifest.build || 1,
    url: bundleUrl,
    checksum: manifest.checksum || '',
    apkUrl: manifest.apkUrl || apkDownloadUrl,
    apkVersion: manifest.apkVersion || manifest.version || '1.0.0',
    apkVersionCode: manifest.apkVersionCode || 1,
    apkFileName: manifest.apkFileName || 'matrices-latest.apk',
    apkFileSizeMb: manifest.apkFileSizeMb,
    apkUpdatedAt: manifest.apkUpdatedAt,
    mandatory: manifest.mandatory ?? false,
    releaseNotes: manifest.releaseNotes || '',
    publishedAt: manifest.publishedAt || new Date().toISOString(),
  };
}

export async function GET() {
  const responseData = await buildUpdateResponse();
  return NextResponse.json(responseData, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Content-Type': 'application/json',
    },
  });
}
