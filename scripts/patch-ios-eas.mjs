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

  // 2. Clean up any root ios/App.xcodeproj, ios/App.xcworkspace, or ios/App/Info.plist mirrors that break SPM resolution
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

  // 3. Ensure ios/Podfile exists for EAS "Install pods" step with target integration disabled (SPM used)
  const podfilePath = path.join(iosDir, 'Podfile');
  const podfileContent = `platform :ios, '15.0'
install! 'cocoapods', :integrate_targets => false

target 'App' do
  # All plugins are managed via Swift Package Manager (CapApp-SPM)
end
`;
  if (!fs.existsSync(podfilePath) || fs.readFileSync(podfilePath, 'utf8') !== podfileContent) {
    fs.writeFileSync(podfilePath, podfileContent, 'utf8');
    console.log('✅ Configured ios/Podfile for EAS pod install step.');
  }

  // 4. Configure ios/Gymfile for simulator preview builds (no signing required)
  const gymfilePath = path.join(iosDir, 'Gymfile');
  const gymfileContent = `# Generated for EAS Build Capacitor iOS SPM simulator workflow
workspace "./App/App.xcworkspace"
scheme "App"
configuration "Release"
destination "generic/platform=iOS Simulator"
derived_data_path "./build"
skip_package_ipa true
skip_archive true
`;
  if (!fs.existsSync(gymfilePath) || fs.readFileSync(gymfilePath, 'utf8') !== gymfileContent) {
    fs.writeFileSync(gymfilePath, gymfileContent, 'utf8');
    console.log('✅ Configured ios/Gymfile for EAS simulator build.');
  }

  // 5. Ensure valid 1024x1024 AppIcon in Assets.xcassets
  const appIconDest = path.join(iosAppDir, 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
  const sourceIcon = path.join(rootDir, 'public', 'matrices-neon-logo.png');
  if (fs.existsSync(sourceIcon) && fs.existsSync(path.dirname(appIconDest))) {
    try {
      const needsCopy = !fs.existsSync(appIconDest) || fs.readFileSync(appIconDest).length !== fs.readFileSync(sourceIcon).length;
      if (needsCopy) {
        fs.copyFileSync(sourceIcon, appIconDest);
        console.log('✅ Synchronized 1024x1024 AppIcon in Assets.xcassets.');
      }
    } catch (err) {
      console.warn('Could not sync AppIcon:', err);
    }
  }

  // 6. Patch @expo/config-plugins in node_modules if present (for any legacy globs)
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
