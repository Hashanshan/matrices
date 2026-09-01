import { execSync } from 'child_process';
import path from 'path';
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
  console.log('✅ Static export build completed successfully.');
}

if (process.argv[1] === __filename) {
  runMobileBuild();
}
