import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export const dynamic = 'force-static';

interface ManifestData {
  version: string;
  build?: number;
  bundleFileName?: string;
  checksum?: string;
  apkFileName?: string;
  apkVersion?: string;
  apkVersionCode?: number;
  mandatory?: boolean;
  releaseNotes?: string;
  publishedAt?: string;
}

async function getUpdateManifest() {
  const frontEndUrl = (process.env.NEXT_PUBLIC_FRONT_END_URL || 'https://matrices.devcodz.com').replace(/\/$/, '');
  const versionFilePath = path.join(process.cwd(), 'updates', 'version.json');

  let manifest: ManifestData = {
    version: '1.0.0',
    build: 1,
    bundleFileName: 'app-v1.0.0.zip',
    checksum: '',
    apkFileName: 'matrices-latest.apk',
    apkVersion: '1.0.0',
    apkVersionCode: 1,
    mandatory: false,
    releaseNotes: 'Matrices system update.',
  };

  try {
    const fileData = await fs.readFile(versionFilePath, 'utf8');
    manifest = { ...manifest, ...JSON.parse(fileData) };
  } catch (err) {
    console.warn('[Updates API] Could not read updates/version.json, using default fallback.', err);
  }

  const bundleFile = manifest.bundleFileName || `app-v${manifest.version}.zip`;
  const bundleUrl = `${frontEndUrl}/api/updates/bundle?file=${bundleFile}`;
  const apkDownloadUrl = `${frontEndUrl}/api/updates/download-apk`;

  return {
    version: manifest.version,
    build: manifest.build || 1,
    url: bundleUrl,
    checksum: manifest.checksum || '',
    apkUrl: apkDownloadUrl,
    apkVersion: manifest.apkVersion || '1.0.0',
    apkVersionCode: manifest.apkVersionCode || 1,
    mandatory: manifest.mandatory ?? false,
    releaseNotes: manifest.releaseNotes || '',
    publishedAt: manifest.publishedAt || new Date().toISOString(),
  };
}

export async function GET() {
  const responseData = await getUpdateManifest();
  return NextResponse.json(responseData, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Content-Type': 'application/json',
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    console.log('[Updates API] Incoming update check from device:', body);
  } catch {
    // Ignore body parse errors
  }

  const responseData = await getUpdateManifest();
  return NextResponse.json(responseData, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Content-Type': 'application/json',
    },
  });
}
