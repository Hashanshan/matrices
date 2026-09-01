import path from 'path';
import fsSync from 'fs';
import fs from 'fs/promises';

export interface ManifestData {
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
  apkFileSizeMb?: string;
  apkUpdatedAt?: string;
}

/**
 * Searches across known locations for an update file or build artifact.
 */
export function findUpdateFile(fileName: string): string | null {
  const sanitized = path.basename(fileName);
  const candidates = [
    // Direct from cwd
    path.join(process.cwd(), 'updates', sanitized),
    // If cwd is repo root
    path.join(process.cwd(), 'matrices', 'updates', sanitized),
    // Public directory
    path.join(process.cwd(), 'public', 'updates', sanitized),
    path.join(process.cwd(), 'matrices', 'public', 'updates', sanitized),
    // Relative to parent
    path.join(process.cwd(), '..', 'updates', sanitized),
  ];

  // If searching for APK, also check Android Gradle build output folders
  if (sanitized.endsWith('.apk')) {
    candidates.push(
      path.join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'modern', 'debug', 'app-modern-debug.apk'),
      path.join(process.cwd(), 'matrices', 'android', 'app', 'build', 'outputs', 'apk', 'modern', 'debug', 'app-modern-debug.apk'),
      path.join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'legacy', 'debug', 'app-legacy-debug.apk'),
      path.join(process.cwd(), 'matrices', 'android', 'app', 'build', 'outputs', 'apk', 'legacy', 'debug', 'app-legacy-debug.apk'),
      path.join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
      path.join(process.cwd(), 'matrices', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
    );
  }

  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Reads and parses the version.json manifest with fallbacks.
 */
export async function getVersionManifest(): Promise<ManifestData> {
  const defaultManifest: ManifestData = {
    version: '1.0.0',
    build: 1,
    bundleFileName: 'app-v1.0.0.zip',
    checksum: '',
    apkFileName: 'matrices-latest.apk',
    apkVersion: '1.0.0',
    apkVersionCode: 1,
    mandatory: false,
    releaseNotes: 'Matrices system update.',
    publishedAt: new Date().toISOString(),
  };

  const versionFilePath = findUpdateFile('version.json');
  if (versionFilePath) {
    try {
      const fileData = await fs.readFile(versionFilePath, 'utf8');
      const parsed = JSON.parse(fileData);
      return { ...defaultManifest, ...parsed };
    } catch (err) {
      console.warn('[Updates API] Could not parse version.json:', err);
    }
  }

  return defaultManifest;
}
