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
  const androidDir = path.join(rootDir, 'android');
  const localPropPath = path.join(androidDir, 'local.properties');

  if (!fs.existsSync(localPropPath)) {
    const defaultSdkPaths = [
      process.env.ANDROID_HOME,
      process.env.ANDROID_SDK_ROOT,
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null,
      'C:/Android/sdk',
      'C:/Users/' + (process.env.USERNAME || 'sathi') + '/AppData/Local/Android/Sdk'
    ].filter(Boolean);

    const foundSdk = defaultSdkPaths.find((p) => p && fs.existsSync(p));
    if (foundSdk) {
      const formatted = foundSdk.replace(/\\/g, '/');
      fs.writeFileSync(localPropPath, `sdk.dir=${formatted}\n`, 'utf8');
      console.log(`🔧 Auto-configured android/local.properties with SDK: ${formatted}`);
    }
  }

  const gradleTask =
    flavor === 'legacy'
      ? 'clean assembleLegacyDebug'
      : flavor === 'all'
      ? 'clean assembleDebug'
      : 'clean assembleModernDebug';

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

  // 7. Upload to Cloudinary Bucket under folder 'apk/app-release'
  console.log('5️⃣ Uploading compiled APK to Cloudinary bucket under folder: apk/app-release...');
  let bucketApkUrl = process.env.APK_BUCKET_URL || process.env.NEXT_PUBLIC_APK_URL || '';

  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    let cloudinarySdk = null;

    try {
      cloudinarySdk = require('cloudinary').v2;
    } catch {
      try {
        cloudinarySdk = require(path.join(rootDir, '..', 'backend', 'node_modules', 'cloudinary')).v2;
      } catch {
        try {
          cloudinarySdk = require(path.join(rootDir, '..', 'project', 'node_modules', 'cloudinary')).v2;
        } catch {
          cloudinarySdk = null;
        }
      }
    }

    if (cloudinarySdk) {
      let cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME;
      let apiKey = process.env.CLOUDINARY_API_KEY || process.env.API_KEY;
      let apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET;

      const backendEnvPath = path.join(rootDir, '..', 'backend', '.env');
      if ((!cloudName || !apiKey || !apiSecret) && fs.existsSync(backendEnvPath)) {
        const envContent = fs.readFileSync(backendEnvPath, 'utf8');
        const getEnv = (k) => {
          const match = envContent.match(new RegExp(`^${k}=["']?([^"'\\r\\n]+)["']?`, 'm'));
          return match ? match[1] : null;
        };
        cloudName = cloudName || getEnv('CLOUD_NAME') || getEnv('CLOUDINARY_CLOUD_NAME');
        apiKey = apiKey || getEnv('API_KEY') || getEnv('CLOUDINARY_API_KEY');
        apiSecret = apiSecret || getEnv('API_SECRET') || getEnv('CLOUDINARY_API_SECRET');
      }

      cloudName = cloudName || 'spjswcjp';
      apiKey = apiKey || '847781563998851';
      apiSecret = apiSecret || 'vbUitMRN6u95twzg1Jj4lCEMuzg';

      cloudinarySdk.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret
      });

      // 1. Delete previous APKs from bucket
      console.log('🗑️ Deleting previous APK(s) from Cloudinary bucket (folder: apk/app-release)...');
      try {
        await cloudinarySdk.api.delete_resources_by_prefix('apk/app-release', {
          resource_type: 'raw',
          invalidate: true
        });
        console.log('✅ Old APK(s) deleted from bucket successfully.');
      } catch (delErr) {
        // Non-fatal if folder was empty
        console.log('ℹ️ Bucket cleanup note:', delErr.message || delErr);
      }

      // 2. Upload the new APK
      const uploadRes = await cloudinarySdk.uploader.upload(destApkPath, {
        folder: 'apk/app-release',
        public_id: 'matrices-latest.apk',
        resource_type: 'raw',
        overwrite: true,
        invalidate: true,
        use_filename: true,
        unique_filename: false
      });

      if (uploadRes && uploadRes.secure_url) {
        bucketApkUrl = uploadRes.secure_url;
        console.log(`☁️ Cloudinary Bucket Upload Success: ${bucketApkUrl}`);
      }
    } else {
      console.warn('⚠️ Cloudinary SDK not found. Skipping direct bucket upload.');
    }
  } catch (uploadErr) {
    console.warn('⚠️ Cloudinary bucket upload warning:', uploadErr.message || uploadErr);
  }

  // 8. Notify Backend Update Route
  const backendApiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://magnum-backend.vercel.app').replace(/\/$/, '');
  try {
    const syncRes = await fetch(`${backendApiUrl}/api/updates/upload-apk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version,
        build: 1,
        fileName: destApkName,
        folder: 'apk/app-release',
        apkFileSizeMb: `${sizeMb} MB`,
        apkUrl: bucketApkUrl || `${backendApiUrl}/api/updates/download-apk`,
        releaseNotes: `Matrices Android APK v${version}`
      })
    });
    if (syncRes.ok) {
      const syncData = await syncRes.json();
      if (syncData?.manifest?.apkUrl) {
        bucketApkUrl = syncData.manifest.apkUrl;
      }
      console.log('📡 Backend /api/updates/upload-apk synced successfully.');
    }
  } catch {
    // Backend sync error non-fatal during offline/local build
  }

  // 9. Update updates/version.json with latest APK info
  const versionJsonPath = path.join(updatesDir, 'version.json');

  let manifest = {
    version: version,
    build: 1,
    bundleFileName: `app-v${version}.zip`,
    checksum: '',
    apkFileName: destApkName,
    apkUrl: bucketApkUrl || '',
    apkVersion: version,
    apkVersionCode: 1,
    apkFileSizeMb: `${sizeMb} MB`,
    mandatory: false,
    releaseNotes: `Matrices Android APK v${version}`,
    publishedAt: new Date().toISOString(),
    apkUpdatedAt: new Date().toISOString(),
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
        publishedAt: existing.publishedAt || new Date().toISOString(),
      };
      if (bucketApkUrl) {
        manifest.apkUrl = bucketApkUrl;
      }
    } catch {
      // Use default
    }
  }

  fs.writeFileSync(versionJsonPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`📝 Updated updates/version.json with latest APK info.`);

  console.log('\n=============================================================');
  console.log('🎉 Android APK Build & Placement Complete!');
  console.log(`- APK File: updates/${destApkName} (${sizeMb} MB)`);
  console.log(`- Bucket Download URL: ${manifest.apkUrl || '/api/updates/download-apk'}`);
  console.log(`- Version Manifest: updates/version.json`);
  console.log('=============================================================\n');
}

buildApk().catch((err) => {
  console.error('Fatal APK build error:', err);
  process.exit(1);
});

