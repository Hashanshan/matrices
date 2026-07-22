# Product Catalogue Site Architecture

## Authentication Flow & Protected Routes

1. **Root Page (`/`)**: 
   - We have made the root (`/`) the dedicated Login Page for sales representatives.
   - It integrates directly with `AuthContext` to manage the authentication state.

2. **Main Application (`/catalogue`)**:
   - The primary categories/products view has been moved from `/` to `/catalogue`.
   - Users are redirected here automatically upon a successful login.

3. **Global Route Protection**:
   - We introduced a `<AuthGuard>` component (`components/auth-guard.tsx`).
   - The `<AuthGuard>` is implemented at the root level within `app/layout.tsx`, wrapping all children.
   - It checks the `isLoggedIn` state from `AuthContext`.
   - If a user attempts to access any route other than `/` while unauthenticated, they are instantly redirected to the login page (`/`).
   - If an authenticated user lands on `/`, they are redirected to `/catalogue`.

## Future Updates
When modifying the authentication flow, ensure that the `AuthContext` (`lib/contexts/auth-context.tsx`) remains the central source of truth for the user's session state. The `AuthGuard` handles all client-side redirect logic.

## Data Fetching & API Binding

1. **Backend Integration**: 
   - Catalogue data is fetched from the backend `/api/catelogue/products` endpoint.
   - This endpoint requires the `salesrep` auth token in the `Authorization` header (`Bearer <token>`).
   - It is designed to only fetch products with images, and projects only the necessary non-confidential fields (`name`, `productCode`, `productId`, `category` mapped to `categories`, `subCategory` mapped to `subcategories`, `image`, `sellPrice`, `description`).
   
2. **Frontend Views**:
   - `/catalogue`: Fetches products and dynamically builds the category list based on the returned data.
   - `/gallery`: Fetches the products and passes them to `<ProductGallery>` which handles client-side filtering (by category/subcategory), sorting, and searching.
   - `/view`: Fetches the products with the query parameter `?sort=view` which specifically orders the results on the backend by `subcategories` -> `categories` -> `name` before passing them to the fullscreen viewer.
