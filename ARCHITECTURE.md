# Product Catalogue Site — Architecture

## Overview
This is a Next.js application that serves as a product catalogue for salesrep users. It connects to a backend API through a server-side BFF (Backend For Frontend) proxy to ensure the real backend URL is never exposed to the browser.

## Authentication & Routing
- `/` is the login page (root). Only `salesrep` users can log in.
- All other routes are protected by `AuthGuard` (wraps `RootLayout`).
- Unauthenticated users are redirected to `/`.
- Authenticated users visiting `/` are redirected to `/catalogue`.
- `AuthContext` (`lib/contexts/auth-context.tsx`) is the single source of truth for session state. It stores the JWT token in `localStorage`.

## Future Updates
When modifying the authentication flow, ensure that the `AuthContext` (`lib/contexts/auth-context.tsx`) remains the central source of truth for the user's session state. The `AuthGuard` handles all client-side redirect logic.

## Data Fetching & API Architecture

### BFF Proxy Pattern (API Hiding)
- **The browser NEVER calls the backend directly.**
- All product requests go through the Next.js API Route Handler at `app/api/products/route.ts`.
- This route reads `BACKEND_API_URL` from `.env.local` (server-side only, never exposed to the browser) and proxies requests to the real backend.
- In the browser's Network tab, users only see calls to `/api/products`, not the real backend URL.

### Environment Variables
- `BACKEND_API_URL` — Set in `.env.local`. The real backend base URL (e.g., `http://localhost:5000`). Server-side only.

### SWR Caching Strategy (Stale-While-Revalidate)
- **Library**: `swr` (installed as a dependency).
- **Behavior**:
  - **First visit**: Fetches from the API and displays a loading spinner.
  - **Revisits**: Instantly shows cached data from memory. In the background, SWR silently revalidates against the server. If the data has changed, the UI updates seamlessly.
  - **Tab focus / reconnect**: Automatic revalidation when the user returns to the tab or reconnects to the network.
  - **Deduplication**: Identical requests within 5 seconds are deduplicated.
- **Hooks**:
  - `useProducts(options)` — Cursor-paginated infinite loading. Used by `/gallery` (`ProductGallery`).
  - `useAllProducts(options)` — Single-fetch with high limit. Used by `/catalogue` and `/view`.

### Cursor Pagination
- **Backend**: `GET /api/catelogue/products` accepts `cursor` and `limit` query parameters.
- **Cursor**: The `_id` of the last item from the previous page.
- **Response**: Includes `nextCursor` (string or null) and `hasNextPage` (boolean).
- **Frontend**: The `ProductGallery` component uses `useSWRInfinite` with an `IntersectionObserver` sentinel to automatically load the next page when the user scrolls to the bottom.

### Image URL Filtering
- The backend only returns products whose `image` field matches a valid URL pattern (`/^https?:\/\/.+/i`).
- Products without a valid image URL are completely excluded from the catalogue.

### Field Projection (Security)
The backend projects only the following non-confidential fields:
- `name`, `productCode`, `productId`, `image`, `sellPrice`, `description`
- `category` → mapped to `categories` in the response
- `subCategory` → mapped to `subcategories` in the response
- **Excluded**: `buyPrice`, `stocks`, `history`, and all other internal fields.

### Sorting
- Default: Newest first (`_id` descending).
- `sort=view`: `subCategory` → `category` → `name` (ascending). Used by the `/view` fullscreen viewer.
- `sort=price-low`: `sellPrice` ascending.
- `sort=price-high`: `sellPrice` descending.

## Key Files Reference

| File | Purpose |
|------|---------|
| `.env.local` | Backend API URL (server-side only) |
| `app/api/products/route.ts` | BFF proxy — hides backend from browser |
| `lib/hooks/use-products.ts` | SWR hooks (`useProducts`, `useAllProducts`) |
| `lib/types.ts` | TypeScript interfaces for `Product`, `FilterState`, etc. |
| `components/product-gallery.tsx` | Gallery with filters, sorting, infinite scroll |
| `components/fullscreen-product-viewer.tsx` | Fullscreen swipeable product viewer |
| `components/auth-guard.tsx` | Route protection component |
| `lib/contexts/auth-context.tsx` | Authentication state management |
| `backend/catelogue/controllers/productController.js` | Cursor pagination, projection, filtering |
| `backend/catelogue/routes/productRoutes.js` | Route definitions for catalogue API |
