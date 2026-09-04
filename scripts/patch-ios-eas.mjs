import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function patchIosForEas() {
  // 1. Patch @expo/config-plugins in node_modules if present
  const pathsJsPath = path.join(rootDir, 'node_modules', '@expo', 'config-plugins', 'build', 'ios', 'Paths.js');
  if (fs.existsSync(pathsJsPath)) {
    let content = fs.readFileSync(pathsJsPath, 'utf8');
    content = content.replace(/'ios\/\*\.xcodeproj/g, "'ios/**/*.xcodeproj");
    content = content.replace(/'ios\/\*\/Info\.plist'/g, "'ios/**/Info.plist'");
    content = content.replace(/'ios\/\*\/AppDelegate/g, "'ios/**/AppDelegate");
    content = content.replace(/'ios\/\*\/Podfile'/g, "'ios/**/Podfile'");
    content = content.replace(/'ios\/\*\.xcodeproj\/xcshareddata\/xcschemes\/\*\.xcscheme'/g, "'ios/**/xcshareddata/xcschemes/*.xcscheme'");
    fs.writeFileSync(pathsJsPath, content, 'utf8');
    console.log('✅ Patched @expo/config-plugins for Capacitor iOS structure.');
  }

  // 2. Setup iOS compatibility structure in ios/ for Fastlane & EAS Build
  const iosDir = path.join(rootDir, 'ios');
  const iosAppDir = path.join(iosDir, 'App');

  if (fs.existsSync(iosAppDir)) {
    // Copy/link xcshareddata directly into ios/App.xcodeproj
    const targetProj = path.join(iosDir, 'App.xcodeproj');
    const srcProj = path.join(iosAppDir, 'App.xcodeproj');
    if (!fs.existsSync(targetProj) && fs.existsSync(srcProj)) {
      try {
        fs.cpSync(srcProj, targetProj, { recursive: true });
        console.log('✅ Created ios/App.xcodeproj mirror.');
      } catch (err) {
        console.warn('Could not mirror App.xcodeproj:', err);
      }
    }

    // Copy/link App.xcworkspace directly to ios/App.xcworkspace
    const targetWs = path.join(iosDir, 'App.xcworkspace');
    const srcWs = path.join(iosAppDir, 'App.xcworkspace');
    if (!fs.existsSync(targetWs) && fs.existsSync(srcWs)) {
      try {
        fs.cpSync(srcWs, targetWs, { recursive: true });
        console.log('✅ Created ios/App.xcworkspace mirror.');
      } catch (err) {
        console.warn('Could not mirror App.xcworkspace:', err);
      }
    }

    // Ensure Info.plist is discoverable at ios/App/Info.plist
    const targetPlist = path.join(iosAppDir, 'Info.plist');
    const srcPlist = path.join(iosAppDir, 'App', 'Info.plist');
    if (!fs.existsSync(targetPlist) && fs.existsSync(srcPlist)) {
      try {
        fs.copyFileSync(srcPlist, targetPlist);
        console.log('✅ Mirrored Info.plist to ios/App/Info.plist.');
      } catch (err) {
        console.warn('Could not copy Info.plist:', err);
      }
    }
  }
}

if (process.argv[1] === __filename) {
  patchIosForEas();
}
