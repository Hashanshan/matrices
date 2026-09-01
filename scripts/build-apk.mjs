import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function buildApk() {
  const flavor = process.argv[2] || 'modern'; // 'modern' | 'legacy' | 'all'
  console.log(`\n🤖 [Matrices APK Builder] Starting automated build for flavor: ${flavor}...\n`);

  // 1. Read package.json version
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkg.version || '1.0.0';

  // 2. Build Next.js Static Export
  console.log('1️⃣ Building Next.js static mobile export...');
  const { runMobileBuild } = await import('./build-mobile.mjs');
  runMobileBuild();

  // 3. Sync Capacitor Android
  console.log('2️⃣ Syncing Capacitor Android plugins and web assets...');
  execSync('npx cap sync android', {
    cwd: rootDir,
    stdio: 'inherit',
  });

  // 4. Run Gradle Build
  console.log(`3️⃣ Compiling Native Android APK with Gradle (Flavor: ${flavor})...`);
  const gradleTask =
    flavor === 'legacy'
      ? 'assembleLegacyDebug'
      : flavor === 'all'
      ? 'assembleDebug'
      : 'assembleModernDebug';

  const androidDir = path.join(rootDir, 'android');
  execSync(`gradlew.bat ${gradleTask}`, {
    cwd: androidDir,
    stdio: 'inherit',
  });

  // 5. Locate Generated APK
  const possibleApkPaths = [
    path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'modern', 'debug', 'app-modern-debug.apk'),
    path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'legacy', 'debug', 'app-legacy-debug.apk'),
    path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  ];

  let sourceApkPath = possibleApkPaths.find((p) => fs.existsSync(p));

  if (!sourceApkPath) {
    console.error('❌ Could not locate generated APK file in outputs directory.');
    process.exit(1);
  }

  // 6. Ensure updates directory exists
  const updatesDir = path.join(rootDir, 'updates');
  if (!fs.existsSync(updatesDir)) {
    fs.mkdirSync(updatesDir, { recursive: true });
  }

  const destApkName = 'matrices-latest.apk';
  const destApkPath = path.join(updatesDir, destApkName);

  console.log(`4️⃣ Copying generated APK to protected folder: updates/${destApkName}...`);
  fs.copyFileSync(sourceApkPath, destApkPath);

  const stats = fs.statSync(destApkPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`✅ APK copied successfully (${sizeMb} MB)`);

  // 7. Update updates/version.json with latest APK info
  const versionJsonPath = path.join(updatesDir, 'version.json');
  let manifest = {
    version: version,
    build: 1,
    bundleFileName: `app-v${version}.zip`,
    checksum: '',
    apkFileName: destApkName,
    apkVersion: version,
    apkVersionCode: 1,
    apkFileSizeMb: `${sizeMb} MB`,
    mandatory: false,
    releaseNotes: `Matrices Android APK v${version}`,
    publishedAt: new Date().toISOString(),
  };

  if (fs.existsSync(versionJsonPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
      manifest = {
        ...existing,
        apkFileName: destApkName,
        apkVersion: version,
        apkFileSizeMb: `${sizeMb} MB`,
        apkUpdatedAt: new Date().toISOString(),
      };
    } catch {
      // Use default
    }
  }

  fs.writeFileSync(versionJsonPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`📝 Updated updates/version.json with latest APK info.`);

  console.log('\n=============================================================');
  console.log('🎉 Android APK Build & Placement Complete!');
  console.log(`- APK File: updates/${destApkName} (${sizeMb} MB)`);
  console.log(`- Download Endpoint: /api/updates/download-apk`);
  console.log(`- Version Manifest: updates/version.json`);
  console.log('=============================================================\n');
}

buildApk().catch((err) => {
  console.error('Fatal APK build error:', err);
  process.exit(1);
});
