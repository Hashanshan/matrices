import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function patchIosForEas() {
  const iosDir = path.join(rootDir, 'ios');
  const iosAppDir = path.join(iosDir, 'App');

  // 1. Normalize Windows backslashes to POSIX forward slashes in CapApp-SPM/Package.swift
  const packageSwiftPath = path.join(iosAppDir, 'CapApp-SPM', 'Package.swift');
  if (fs.existsSync(packageSwiftPath)) {
    let content = fs.readFileSync(packageSwiftPath, 'utf8');
    // Replace Windows path separators in SPM package path references (e.g., path: "..\\..\\..\\node_modules\\...")
    const updatedContent = content.replace(/path:\s*"([^"]+)"/g, (match, p1) => {
      return `path: "${p1.replace(/\\/g, '/')}"`;
    });
    if (updatedContent !== content) {
      fs.writeFileSync(packageSwiftPath, updatedContent, 'utf8');
      console.log('✅ Normalized POSIX path separators in CapApp-SPM/Package.swift.');
    }
  }

  // 2. Clean up any root ios/App.xcodeproj, ios/App.xcworkspace, ios/App/Info.plist, or ios/Podfile mirrors that break SPM resolution
  const staleTargetProj = path.join(iosDir, 'App.xcodeproj');
  if (fs.existsSync(staleTargetProj)) {
    try {
      fs.rmSync(staleTargetProj, { recursive: true, force: true });
      console.log('🧹 Removed stale ios/App.xcodeproj duplicate.');
    } catch (err) {
      console.warn('Could not remove stale App.xcodeproj:', err);
    }
  }

  const staleTargetWs = path.join(iosDir, 'App.xcworkspace');
  if (fs.existsSync(staleTargetWs)) {
    try {
      fs.rmSync(staleTargetWs, { recursive: true, force: true });
      console.log('🧹 Removed stale ios/App.xcworkspace duplicate.');
    } catch (err) {
      console.warn('Could not remove stale App.xcworkspace:', err);
    }
  }

  const staleTargetPlist = path.join(iosAppDir, 'Info.plist');
  if (fs.existsSync(staleTargetPlist)) {
    try {
      fs.rmSync(staleTargetPlist, { force: true });
      console.log('🧹 Removed stale ios/App/Info.plist duplicate.');
    } catch (err) {
      console.warn('Could not remove stale ios/App/Info.plist:', err);
    }
  }

  const stalePodfile = path.join(iosDir, 'Podfile');
  if (fs.existsSync(stalePodfile)) {
    try {
      fs.rmSync(stalePodfile, { force: true });
      console.log('🧹 Removed unused root Podfile (SPM used instead).');
    } catch (err) {
      console.warn('Could not remove stale Podfile:', err);
    }
  }

  // 3. Ensure ios/Gymfile is configured to point Fastlane directly to the Capacitor workspace
  const gymfilePath = path.join(iosDir, 'Gymfile');
  const gymfileContent = `# Generated for EAS Build Capacitor iOS SPM workflow
workspace "./App/App.xcworkspace"
scheme "App"
`;
  if (!fs.existsSync(gymfilePath) || fs.readFileSync(gymfilePath, 'utf8') !== gymfileContent) {
    fs.writeFileSync(gymfilePath, gymfileContent, 'utf8');
    console.log('✅ Configured ios/Gymfile with workspace "./App/App.xcworkspace" and scheme "App".');
  }

  // 4. Patch @expo/config-plugins in node_modules if present (for any legacy globs)
  const pathsJsPath = path.join(rootDir, 'node_modules', '@expo', 'config-plugins', 'build', 'ios', 'Paths.js');
  if (fs.existsSync(pathsJsPath)) {
    let content = fs.readFileSync(pathsJsPath, 'utf8');
    content = content.replace(/'ios\/\*\.xcodeproj/g, "'ios/**/*.xcodeproj");
    content = content.replace(/'ios\/\*\/Info\.plist'/g, "'ios/**/Info.plist'");
    content = content.replace(/'ios\/\*\/AppDelegate/g, "'ios/**/AppDelegate");
    content = content.replace(/'ios\/\*\.xcodeproj\/xcshareddata\/xcschemes\/\*\.xcscheme'/g, "'ios/**/xcshareddata/xcschemes/*.xcscheme'");
    fs.writeFileSync(pathsJsPath, content, 'utf8');
  }
}

if (process.argv[1] === __filename) {
  patchIosForEas();
}
