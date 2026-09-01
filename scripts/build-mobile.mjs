import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function runMobileBuild() {
  console.log('⏳ Running Next.js static export for mobile (NEXT_EXPORT=true)...');
  execSync('npx cross-env NEXT_EXPORT=true next build', {
    cwd: rootDir,
    stdio: 'inherit',
  });

  // Prune heavy server API routes and previous APK/bundle artifacts from mobile web bundle
  const outApiDir = path.join(rootDir, 'out', 'api');
  if (fs.existsSync(outApiDir)) {
    console.log('🧹 Pruning server-side API binaries from mobile assets (out/api)...');
    fs.rmSync(outApiDir, { recursive: true, force: true });
  }

  const androidAssetsApi = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public', 'api');
  if (fs.existsSync(androidAssetsApi)) {
    fs.rmSync(androidAssetsApi, { recursive: true, force: true });
  }

  console.log('✅ Static export build completed and asset bundle pruned successfully.');
}

if (process.argv[1] === __filename) {
  runMobileBuild();
}

