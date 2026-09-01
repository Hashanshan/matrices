import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { ZipArchive } from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to compute sha256 of a file
function getSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

async function packageUpdate() {
  console.log('\n🚀 [Capgo Updater Packager] Starting build and bundle process...\n');

  // 1. Determine Version
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const cliVersion = process.argv[2];
  const targetVersion = cliVersion || pkg.version || '1.0.0';

  if (cliVersion && cliVersion !== pkg.version) {
    pkg.version = cliVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`📦 Updated package.json version to: ${targetVersion}`);
  }

  // 2. Build Next.js Static Export
  console.log('⏳ Running static build export for mobile (NEXT_EXPORT=true)...');
  try {
    const { runMobileBuild } = await import('./build-mobile.mjs');
    runMobileBuild();
  } catch (error) {
    console.error('❌ Build failed. Please fix build errors before packaging.', error);
    process.exit(1);
  }

  const outDir = path.join(rootDir, 'out');
  if (!fs.existsSync(outDir) || !fs.existsSync(path.join(outDir, 'index.html'))) {
    console.error('❌ "out/" folder or "out/index.html" is missing after build.');
    process.exit(1);
  }

  // 3. Ensure updates directory exists
  const updatesDir = path.join(rootDir, 'updates');
  if (!fs.existsSync(updatesDir)) {
    fs.mkdirSync(updatesDir, { recursive: true });
  }

  const zipFileName = `app-v${targetVersion}.zip`;
  const zipFilePath = path.join(updatesDir, zipFileName);

  // Remove existing zip if present
  if (fs.existsSync(zipFilePath)) {
    fs.unlinkSync(zipFilePath);
  }

  console.log(`📦 Zipping "out/" directory into: updates/${zipFileName}...`);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFilePath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(outDir, false);
    archive.finalize();
  });

  const fileSizeKb = (fs.statSync(zipFilePath).size / 1024).toFixed(1);
  console.log(`✅ Bundle created: ${zipFileName} (${fileSizeKb} KB)`);

  // 4. Calculate SHA-256 Checksum
  const checksum = getSha256(zipFilePath);
  console.log(`🔒 SHA-256 Checksum: ${checksum}`);

  // 5. Update updates/version.json
  const versionJsonPath = path.join(updatesDir, 'version.json');
  let manifest = {
    version: targetVersion,
    build: 1,
    bundleFileName: zipFileName,
    checksum: checksum,
    apkFileName: 'matrices-latest.apk',
    apkVersion: '1.0.0',
    apkVersionCode: 1,
    mandatory: false,
    releaseNotes: `Update to v${targetVersion}`,
    publishedAt: new Date().toISOString(),
  };

  if (fs.existsSync(versionJsonPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
      manifest = {
        ...existing,
        version: targetVersion,
        bundleFileName: zipFileName,
        checksum: checksum,
        publishedAt: new Date().toISOString(),
      };
    } catch {
      // Use fallback
    }
  }

  fs.writeFileSync(versionJsonPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`📝 Updated updates/version.json successfully.`);

  console.log('\n=============================================================');
  console.log('🎉 Live Update Package Ready!');
  console.log(`- Version: ${targetVersion}`);
  console.log(`- Zip Bundle: updates/${zipFileName}`);
  console.log(`- Checksum: ${checksum}`);
  console.log(`- Manifest: updates/version.json`);
  console.log('=============================================================\n');
}

packageUpdate().catch((err) => {
  console.error('Fatal packaging error:', err);
  process.exit(1);
});
