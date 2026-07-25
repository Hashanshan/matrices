# Product Catalogue Site — Architecture

## Overview
This is a Next.js application that serves as a product catalogue for salesrep users. It connects to a backend API through a server-side BFF (Backend For Frontend) proxy to ensure the real backend URL is never exposed to the browser.

---

## Authentication & Routing
- `/` is the login page (root). Only `salesrep` users can log in.
- All other routes are protected by `AuthGuard` (wraps `RootLayout`).
- Unauthenticated users are redirected to `/`.
- Authenticated users visiting `/` are redirected to `/catalogue`.
- `AuthContext` (`lib/contexts/auth-context.tsx`) is the single source of truth for session state. It stores the JWT token in `localStorage`.

## Future Updates
When modifying the authentication flow, ensure that the `AuthContext` (`lib/contexts/auth-context.tsx`) remains the central source of truth for the user's session state. The `AuthGuard` handles all client-side redirect logic.

---

## Wishlist System & Priority Sorting Architecture

### 1. Overview & Data Flow
The Wishlist system provides persistent, API-based management of favorite Categories, Subcategories, and Products for each logged-in sales representative. Wishlist items dictate visual priority throughout the site.

- **BFF Proxy Routes**:
  - `app/api/wishlist/route.ts`: Proxies `GET` (fetch user wishlist) and `POST` (toggle item in wishlist) to backend `GET /api/catelogue/wishlist` and `POST /api/catelogue/wishlist/toggle`.
  - `app/api/wishlist/reorder/route.ts`: Proxies `PUT` (reorder items) to backend `PUT /api/catelogue/wishlist/reorder`.
- **Wishlist Context & Hook (`lib/contexts/wishlist-context.tsx`)**:
  - Leverages SWR to cache wishlist state globally and perform optimistic UI updates upon toggling or reordering.
  - Exposes helper methods: `isCategoryWishlisted`, `isSubcategoryWishlisted`, `isProductWishlisted`, `toggleCategoryWishlist`, `toggleSubcategoryWishlist`, `toggleProductWishlist`, and `reorderWishlist`.

---

### 2. Wishlist Priority Sorting Rules

#### `/catalogue` Page
- **Main Categories View**: Wishlisted Categories appear **FIRST** in the grid, sorted by user-defined wishlist priority (`order`). Non-wishlisted categories follow, sorted alphabetically (A-Z).
- **Subcategories View**: Under a selected category, Wishlisted Subcategories appear **FIRST**, sorted by user-defined wishlist priority (`order`). Non-wishlisted subcategories follow, sorted alphabetically (A-Z).
- **Interactive Toggles**: Heart icon buttons on Category and Subcategory cards enable instant toggling without leaving the page.

#### `/gallery` Page
- **Salesrep Wishlist Isolation**: Each salesrep user has their own isolated `Wishlist` document in MongoDB tied to their `userId`.
- **Backend Product & Filter API Integration**:
  - `GET /api/catelogue/products/filters` checks the salesrep's wishlist in backend database and returns categories and subcategories with wishlisted items sorted **FIRST** (in wishlist priority order).
  - `GET /api/catelogue/products` computes `wishlistScore` in MongoDB aggregation pipeline per salesrep, serving products belonging to wishlisted categories, subcategories, and products **FIRST** on page load.
- **Category Sections Sorting**: Accordion category sections on `/gallery` (`sortedGroupedEntries`) are sorted with Wishlisted Categories appearing **FIRST** (ordered by user wishlist priority index), followed by non-wishlisted categories.
- **Filter Sidebar & Subcategories**: Categories and subcategories in the filter sidebar default to wishlist priority order.
- **Product Gallery Display**: Under each category section, products wishlisted by the user appear **FIRST**, preserving custom wishlist priority. Non-wishlisted products follow in their default sort order.
- **Visual Design**: The redundant text badge "WISHLISTED" was removed. Only the Heart icon (filled red heart when saved vs. empty outline when not) is rendered on cards for a clean, elegant aesthetic.

#### `/view` Page (`app/view/page.tsx` & `components/fullscreen-product-viewer.tsx`)
- **Wishlist Integration**: Connected Heart button in full-screen product viewer directly to `useWishlist` hook (`isProductWishlisted` and `toggleProductWishlist`). Allows instant toggling of product wishlist status.
- **Wishlist-First Product Priority**: `GET /api/catelogue/products` computes `wishlistScore` in MongoDB aggregation pipeline per salesrep, serving wishlisted products/categories/subcategories **FIRST** on page load.

---

### 3. Security Settings Page (`app/settings/security/page.tsx`)
- **Per-Visit PIN Security Gate**: Accessing Security Settings (`/settings/security`) requires 4-digit Security PIN verification via `PinModal` (`components/pin-modal.tsx`) on **every single visit**.
- **Password & PIN Configuration**:
  - **Password Tab**: Allows editing Name, viewing read-only Email, and changing account Password.
  - **Security PIN Tab**: Allows setting or updating the 4-digit Security PIN.
- **iPad OS Design**: Built with `rounded-[2.5rem]` glassmorphism cards, `rounded-full` iPad OS style pill buttons, `rounded-full` input fields, and circular `rounded-full` keypad buttons in `PinModal`.

---

### 4. Settings Wishlist Page (`app/settings/wishlist/page.tsx`)
- **Per-Visit PIN Security Gate**: Accessing Wishlist under Settings (`/settings/wishlist`) is strictly protected by 4-digit Security PIN verification on **every single visit**.
- **Tab-Based Navigation**: Features iPad-style pill tabs for **All Items**, **Categories**, **Subcategories**, and **Products**.
- **Interactive Priority Reordering**: Supports Move Up / Move Down controls with live persistence to backend MongoDB.
- **Card & Border Radius Design System**: All category, subcategory, and product containers are styled with `rounded-[2.5rem]` glassmorphism cards, `rounded-full` action controls, and `rounded-full` badges matching the site design system.

---

### 5. Navigation & Header Restructuring (`components/header.tsx`)
- **Strict Top Navigation Links**: Desktop & Mobile Navbars strictly display:
  1. **Home** (`/catalogue`)
  2. **Gallery** (`/gallery`)
  3. **Products** (`/view`)
  4. **Cart** (`/cart`)
- **User Profile Dropdown Menu**: Contains separate links for **My Wishlist** (`/settings/wishlist`) and **Security Settings** (`/settings/security`), both protected by the Security PIN gate.

## Data Fetching & API Architecture

### BFF Proxy Pattern (API Hiding)
- **The browser NEVER calls the backend directly.**
- Product requests go through `app/api/products/route.ts`.
- Filter requests go through `app/api/products/filters/route.ts`.
- Wishlist requests go through `app/api/wishlist/route.ts` and `app/api/wishlist/reorder/route.ts`.
- Reads `BACKEND_API_URL` from `.env.local` (server-side only) and forwards Authorization tokens.

### Environment Variables
- `BACKEND_API_URL` — Set in `.env.local`. The real backend base URL (e.g., `http://localhost:5000`). Server-side only.

### SWR Caching Strategy (Stale-While-Revalidate)
- **Library**: `swr` (installed as a dependency).
- **Behavior**:
  - **First visit**: Fetches from the API and displays a loading spinner.
  - **Revisits**: Instantly shows cached data from memory. In the background, SWR silently revalidates against the server.
  - **Deduplication**: Identical requests within 5 seconds are deduplicated.
- **Hooks**:
  - `useProducts(options)` — Cursor-paginated infinite loading. Used by `/gallery` (`ProductGallery`).
  - `useAllProducts(options)` — Single-fetch with high limit. Used by `/catalogue` and `/view`.
  - `useWishlist()` — Real-time SWR hook for user wishlist state.

### Image Proxy (Bucket URL Hiding)
- **Mechanism**: The `app/api/image/route.ts` proxy transforms all valid image URLs into a base64 encoded URL format: `/api/image?url=<base64_encoded_url>` to hide S3/storage bucket URLs from client inspector.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `.env.local` | Backend API URL (server-side only) |
| `app/api/products/route.ts` | BFF proxy for products |
| `app/api/wishlist/route.ts` | BFF proxy for wishlist GET & POST |
| `app/api/wishlist/reorder/route.ts` | BFF proxy for wishlist PUT reorder |
| `lib/contexts/wishlist-context.tsx` | Wishlist state management provider and `useWishlist` hook |
| `app/wishlist/page.tsx` | Dedicated Wishlist management and reordering page |
| `app/catalogue/catalogue-client.tsx` | Main catalogue page with category & subcategory wishlist priority sorting |
| `components/product-gallery.tsx` | Product gallery with product wishlist priority sorting |
| `components/product-card.tsx` | Product card with interactive wishlist toggle |
| `components/header.tsx` | Site header with Wishlist navigation link and item count badge |
| `backend/models/Wishlist.js` | MongoDB model for per-user wishlist storage |
| `backend/catelogue/controllers/wishlistController.js` | Backend wishlist logic (get, toggle, reorder) |
| `backend/catelogue/routes/wishlistRoutes.js` | Express route definitions for wishlist API |
