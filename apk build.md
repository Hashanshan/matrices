# Android APK Build Guide for Next.js Apps (Capacitor)

This guide documents the complete workflow for converting and building a **Next.js** web application into an **Android APK / AAB** using **Capacitor**, along with solutions to common build issues.

---

## 1. Quick Start Commands (In This Project)

```bash
# 1. Sync web assets & native plugins to Android
npm run cap:sync

# 2. Build Debug APK (Modern Android 7.0+ / API 24+)
npm run apk:modern

# 3. Build Debug APK (Legacy Android 4.4+ / API 19+)
npm run apk:legacy

# 4. Build All Debug APK Flavors
npm run apk:build
```

### Generated APK Locations
* **Modern APK**: `android/app/build/outputs/apk/modern/debug/app-modern-debug.apk`
* **Legacy APK**: `android/app/build/outputs/apk/legacy/debug/app-legacy-debug.apk`

---

## 2. Issues Encountered & How They Were Resolved

### Issue A: `Could not read script '.../cordova.variables.gradle' as it does not exist`
* **Root Cause**: The script `npm run apk:build` previously executed `cap copy` instead of `cap sync`. `cap copy` only transfers static HTML/JS files into Android assets without regenerating native plugin bridges or extracting the `capacitor-cordova-android-plugins` Gradle module.
* **Resolution**:
  1. Ran `npx cap sync android` (or `npm run cap:sync`) to properly regenerate `android/capacitor-cordova-android-plugins` and `cordova.variables.gradle`.
  2. Updated `package.json` build scripts from `cap copy` to `cap sync android`.

### Issue B: `SDK location not found. Define a valid SDK location...`
* **Root Cause**: Gradle could not detect the Android SDK path because `android/local.properties` was missing or excluded in `.gitignore`.
* **Resolution**: Created `android/local.properties` with the path to the Android SDK:
  ```properties
  sdk.dir=C\:\\Users\\sathi\\AppData\\Local\\Android\\Sdk
  ```

### Issue C: Next.js Font Fetch Error (`Failed to fetch Geist from Google Fonts`)
* **Root Cause**: `next/font/google` attempts to fetch font definitions from Google CDN during `next build`. If there is a temporary network interruption or offline build, Turbopack fails.
* **Resolution**: Ensure active internet access during `next build` or configure local static fonts in `public/fonts` if building in an isolated offline environment.

---

## 3. End-to-End Steps: Converting Any Next.js Site into an Android APK

Follow these step-by-step instructions to convert any Next.js site to an Android application.

### Step 1: System Prerequisites
1. **Node.js**: LTS version installed (Node 18+ or 20+).
2. **Java Development Kit (JDK)**: JDK 17 or JDK 21 installed. Verify with `javac -version`.
3. **Android Studio & SDK**:
   * Install Android Studio.
   * Open **SDK Manager** and install:
     * Android SDK Platform (API 34 or 35).
     * Android SDK Build-Tools.
     * Android SDK Command-line Tools.
     * Android SDK Platform-Tools.
4. **Environment Variables**:
   * Set `ANDROID_HOME` pointing to `C:\Users\<username>\AppData\Local\Android\Sdk`.
   * Add `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\cmdline-tools\latest\bin` to `PATH`.

---

### Step 2: Configure Next.js for Static Export
Capacitor runs the web app inside an Android WebView from static assets. Next.js must be configured for static HTML export (`out` directory).

1. Edit `next.config.mjs` (or `next.config.js`):
   ```javascript
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     output: 'export',          // Generates the static 'out' folder
     images: {
       unoptimized: true,       // Static exports require unoptimized images
     },
     typescript: {
       ignoreBuildErrors: true, // Optional: prevent minor type issues from breaking builds
     },
   };

   export default nextConfig;
   ```

2. **Handle Dynamic Routes**:
   Any dynamic page (e.g. `app/category/[category_name]/page.tsx` or `app/settings/orders/[orderId]/page.tsx`) must export `generateStaticParams()` so Next.js can pre-render static HTML at build time.

---

### Step 3: Install and Initialize Capacitor
If setting up Capacitor from scratch in a Next.js project:

1. Install dependencies:
   ```bash
   npm install @capacitor/core @capacitor/android @capacitor/cli --save
   ```

2. Initialize Capacitor:
   ```bash
   npx cap init
   ```
   * **App Name**: `Matrices` (or your app name)
   * **App ID**: `com.matrices.catalogue` (Reverse domain format)
   * **Web Asset Directory**: `out` (Must match Next.js static output directory)

3. Configure `capacitor.config.json` (or `capacitor.config.ts`):
   ```json
   {
     "appId": "com.matrices.catalogue",
     "appName": "Matrices",
     "webDir": "out",
     "bundledWebRuntime": false,
     "server": {
       "androidScheme": "https",
       "cleartext": true
     }
   }
   ```

4. Add Android platform:
   ```bash
   npx cap add android
   ```

---

### Step 4: Configure Android SDK (`local.properties`)
Create `android/local.properties` (if it does not already exist):
```properties
sdk.dir=C\:\\Users\\sathi\\AppData\\Local\\Android\\Sdk
```
*(Replace `sathi` with your Windows username, ensuring backslashes are escaped with `\\`)*.

---

### Step 5: Sync Web App to Android Platform
Every time you make changes to your Next.js application, build the static export and sync it with Android:

```bash
# 1. Export static website
npm run build

# 2. Copy assets and sync native plugin configurations
npx cap sync android
```

> **Why `cap sync` instead of `cap copy`?**
> * `cap copy`: Only moves web assets (`out/` -> `android/.../assets/public`).
> * `cap sync`: Runs `cap copy` **AND** `cap update` (generates plugin Gradle projects, manifest entries, and settings). Always use `cap sync`.

---

### Step 6: Build the Android APK

Navigate into the `android` folder and use the Gradle wrapper:

#### A. Build Debug APK
```bash
cd android
./gradlew assembleDebug
# Or on Windows cmd:
gradlew.bat assembleDebug
```
* Output: `android/app/build/outputs/apk/debug/app-debug.apk` (or flavor subfolders).

#### B. Build Specific Flavor (e.g. Modern Debug)
```bash
cd android
gradlew.bat assembleModernDebug
```
* Output: `android/app/build/outputs/apk/modern/debug/app-modern-debug.apk`

---

### Step 7: Build Signed Release APK / AAB (For Play Store / Distribution)

1. **Generate a Keystore** (Run once):
   ```bash
   keytool -genkey -v -keystore release-key.jks -alias my-app-alias -keyalg RSA -keysize 2048 -validity 10000
   ```
   Save `release-key.jks` in `android/app/` (keep it secure and out of git).

2. **Configure Signing in `android/app/build.gradle`**:
   ```groovy
   android {
       signingConfigs {
           release {
               storeFile file('release-key.jks')
               storePassword System.getenv("KEYSTORE_PASSWORD") ?: "YOUR_KEYSTORE_PASSWORD"
               keyAlias "my-app-alias"
               keyPassword System.getenv("KEY_PASSWORD") ?: "YOUR_KEY_PASSWORD"
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled true
               proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
           }
       }
   }
   ```

3. **Build Release APK**:
   ```bash
   cd android
   gradlew.bat assembleModernRelease
   ```
   * Output APK: `android/app/build/outputs/apk/modern/release/app-modern-release.apk`

4. **Build Android App Bundle (.aab) for Google Play**:
   ```bash
   cd android
   gradlew.bat bundleModernRelease
   ```
   * Output AAB: `android/app/build/outputs/bundle/modernRelease/app-modern-release.aab`

---

## 4. Useful NPM Scripts Reference (`package.json`)

To make development seamless, keep these scripts configured in `package.json`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "cap:sync": "next build && cap sync android",
  "apk:modern": "next build && cap sync android && cd android && gradlew.bat assembleModernDebug",
  "apk:legacy": "next build && cap sync android && cd android && gradlew.bat assembleLegacyDebug",
  "apk:build": "next build && cap sync android && cd android && gradlew.bat assembleDebug",
  "cap:open": "cap open android"
}
```

---

## 5. Troubleshooting & FAQ

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| `Could not read script .../cordova.variables.gradle` | `cap copy` was run without `cap sync`, or plugins folder was deleted | Run `npx cap sync android` to re-extract plugin scaffolding. |
| `SDK location not found` | Gradle does not know where Android SDK is installed | Create `android/local.properties` with `sdk.dir=C\:\\Users\\<user>\\AppData\\Local\\Android\\Sdk`. |
| `Failed to fetch font from Google Fonts` | Network issue or offline environment during `next build` | Connect to the internet or host fonts locally in `/public/fonts`. |
| Dynamic route error `Page /category/[id] couldn't be exported` | Dynamic route without static generation | Add `generateStaticParams()` returning array of static params in the page file. |
| White / blank screen on app launch | Routing or base path mismatch in static files | Ensure `next.config.mjs` has `output: 'export'` and relative routing is respected. |
| Hardware back button exits app unexpectedly | Android back button unhandled in single-page React app | Register `@capacitor/app` `backButton` listener to handle React router navigation history. |
