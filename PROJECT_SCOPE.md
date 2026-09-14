# Matrices Mobile Catalogue & Salesrep Ordering - Technical Scope

## Executive Summary

The **Matrices Mobile Catalogue Application** is a high-performance hybrid mobile and responsive web application built with **Next.js 16**, **React 19**, **Tailwind CSS v4**, and **Capacitor 8**.

It is purpose-built for field sales representatives traveling on assigned distribution routes. It enables sales reps to showcase product lines with high-resolution imagery, prioritize catalogs using customized wishlist rankings, place instant orders for retail shops, verify shop visits via GPS and camera check-ins, and receive live Over-The-Air (OTA) application updates without reinstalling APKs.

---

## 🏛️ Mobile Architecture & Native Bridge

```mermaid
graph TD
    subgraph UI & Application Layer [Next.js 16 + React 19]
        HOME[Catalogue Showcase & Hero Slider]
        GALLERY[Dynamic Product Gallery & Filters]
        CART[Zustand Cart State & Order Checkout]
        WISHLIST[Wishlist Prioritization & Reordering]
        SETTINGS[Profile & 4-Digit Security PIN]
    end

    subgraph Native Capacitor Bridge [Capacitor 8]
        CAM_PLUGIN[@capacitor/camera - Storefront Verification]
        LOC_PLUGIN[@capacitor/geolocation - GPS Route Check-in]
        FS_PLUGIN[@capacitor/filesystem - Image & Cache Store]
        UPD_PLUGIN[@capgo/capacitor-updater - Live OTA Engine]
    end

    subgraph Operating Systems & Hardware
        ANDROID_MODERN[Modern Android 7.0+ / API 24-35 APK]
        ANDROID_LEGACY[Legacy Android 4.4+ / API 19+ POS APK]
        IOS_APP[Apple iOS 14+ IPA via EAS]
        MOBILE_WEB[Mobile & Tablet Responsive Web]
    end

    UI & Application Layer --> Native Capacitor Bridge
    Native Capacitor Bridge --> ANDROID_MODERN
    Native Capacitor Bridge --> ANDROID_LEGACY
    Native Capacitor Bridge --> IOS_APP
```

---

## 📱 Core Application Modules & User Experience

### 1. Digital Product Showcase & Gallery (`app/gallery/`, `app/category/`)
* **Dynamic Wishlist Ranking**: The gallery dynamically pulls the logged-in sales representative's wishlist preferences. Categories, subcategories, and individual products starred by the salesrep automatically sort to the very top.
* **Instant Filtering & Search**: Instant filtering by Category, Subcategory, Price Range, and SKU with client-side cached data.
* **High-Resolution Visuals**: Product images served from Cloudflare R2 CDN with smooth pinch-to-zoom support (`react-medium-image-zoom`).

### 2. Interactive Cart & Field Order Placement (`app/cart/`, `app/order-confirmation/`)
* **Persistent Cart**: Powered by `zustand` with local storage persistence to prevent cart loss during network drops.
* **Shop & Route Selection**: Choose target retail shop along today's active delivery route.
* **Dynamic Pricing & Discounts**: Automatic application of wholesale price tiers, bulk volume discounts, and payment terms (Cash on Delivery, 30-day credit, Cheque).
* **Instant Submission**: Order payload sent to `/api/order/create` with offline retry queuing.

### 3. Salesrep Wishlist & Catalogue Prioritization (`app/wishlist/`)
* **Drag-and-Drop Reordering**: Sales representatives can arrange categories and products in the exact sequence they present to customers.
* **One-Tap Star/Unstar**: Star categories or items to immediately push them to the top of the catalogue.
* **Cloud Sync**: Custom order preferences synced to `/api/catelogue/wishlist` so preferences follow the salesrep across all devices.

### 4. Security PIN & Profile Management (`app/settings/`)
* **4-Digit Security PIN**: Salesreps must enter their 4-digit security PIN to unlock sensitive settings, wholesale cost breakdowns, and profile settings.
* **Forgot PIN / Reset Flow**: Verify account password to reset security PIN instantly.

---

## 🔌 Native Hardware Integration (Capacitor 8)

| Hardware Feature | Capacitor Plugin | Application Use Case |
| :--- | :--- | :--- |
| **Camera** | `@capacitor/camera` | Capturing shop storefront photos, proof of delivery, and barcode scanning. |
| **GPS Geolocation**| `@capacitor/geolocation` | Recording salesrep GPS coordinates during shop visits and calculating distance to shop. |
| **Local Filesystem**| `@capacitor/filesystem` | Caching high-res product thumbnails locally for instant offline rendering. |
| **OTA Updater** | `@capgo/capacitor-updater`| Downloading and swapping live delta web bundles in the background without user intervention. |

---

## 🤖 Multi-Flavor Android Builds & Compatibility

To support the diverse range of handheld hardware used by field sales teams, the build system compiles two distinct APK flavors:

### 1. Modern Android Flavor (`modernDebug` / `modernRelease`)
* **Target OS**: Android 7.0 (Nougat) through Android 15 (API 24 to 35).
* **Runtime**: High-performance modern Android System WebView with full ES2023+ support.

### 2. Legacy Android Flavor (`legacyDebug` / `legacyRelease`)
* **Target OS**: Android 4.4 (KitKat) through Android 6.0 (Marshmallow) (API 19 to 23).
* **Target Devices**: Rugged handheld barcode scanners, older POS terminals, and legacy field tablets.

---

## ☁️ Over-The-Air (OTA) Release & Cloudflare R2 Pipeline

1. **Automated Compilation**: Running `npm run apk:modern` or `npm run apk:legacy` executes `scripts/build-apk.mjs`.
2. **Static Export & Asset Pruning**: Generates static HTML/JS export (`out/`) and prunes server API binaries to minimize asset size.
3. **Gradle Native Build**: Automatically resolves Android SDK paths and triggers Gradle wrapper compilation.
4. **Cloudflare R2 Bucket Upload**: Uploads compiled APK directly to:
   `matrices/apk/app-release/matrices-latest.apk` on Cloudflare R2.
5. **OTA Metadata Sync**: Notifies `/api/updates/upload-apk` and writes `updates/version.json` with file size, MD5 checksum, version code, and release notes.
6. **Live App Update**: Client devices query `/api/updates/check-update` to either download an instant live zip bundle (`updates/app-vX.X.X.zip`) or prompt for a full APK upgrade.
