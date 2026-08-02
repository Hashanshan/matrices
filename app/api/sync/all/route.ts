export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

/**
 * BFF Bulk Data Sync API Endpoint
 * `/api/sync/all`
 * Aggregates all catalogue items, categories, subcategories, wishlist, and shops
 * into a single unified JSON payload for local device sync.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_API_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const headers = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    };

    const productsPath = BACKEND_URL.endsWith('/api') ? '/catelogue/products' : '/api/catelogue/products';
    const filtersPath = BACKEND_URL.endsWith('/api') ? '/catelogue/products/filters' : '/api/catelogue/products/filters';
    const wishlistPath = BACKEND_URL.endsWith('/api') ? '/catelogue/wishlist' : '/api/catelogue/wishlist';
    const shopsPath = BACKEND_URL.endsWith('/api') ? '/catelogue/shops' : '/api/catelogue/shops';

    // Parallel fetch for speed
    const [productsRes, filtersRes, wishlistRes, shopsRes] = await Promise.allSettled([
      fetch(`${BACKEND_URL}${productsPath}?limit=5000`, { headers, cache: 'no-store' }),
      fetch(`${BACKEND_URL}${filtersPath}`, { headers, cache: 'no-store' }),
      fetch(`${BACKEND_URL}${wishlistPath}`, { headers, cache: 'no-store' }),
      fetch(`${BACKEND_URL}${shopsPath}`, { headers, cache: 'no-store' }),
    ]);

    let productsData: any[] = [];
    let categoriesData: any[] = [];
    let subcategoriesData: any[] = [];
    let wishlistData: any = null;
    let shopsData: any[] = [];

    if (productsRes.status === 'fulfilled' && productsRes.value.ok) {
      const resJson = await productsRes.value.json();
      productsData = resJson.data || resJson.products || (Array.isArray(resJson) ? resJson : []);
    }

    if (filtersRes.status === 'fulfilled' && filtersRes.value.ok) {
      const filtersJson = await filtersRes.value.json();
      categoriesData = filtersJson.categories || filtersJson.data?.categories || [];
      subcategoriesData = filtersJson.subcategories || filtersJson.data?.subcategories || [];
    }

    if (wishlistRes.status === 'fulfilled' && wishlistRes.value.ok) {
      wishlistData = await wishlistRes.value.json();
    }

    if (shopsRes.status === 'fulfilled' && shopsRes.value.ok) {
      const shopsJson = await shopsRes.value.json();
      shopsData = shopsJson.data || (Array.isArray(shopsJson) ? shopsJson : []);
    }

    // Process image URLs for proxy safety
    const formattedProducts = productsData.map((p: any) => {
      const productObj = {
        id: p._id || p.id || p.productId,
        productId: p.productId || p._id || p.id,
        name: p.name || p.productName || 'Unnamed Product',
        code: p.code || p.productCode || '',
        description: p.description || '',
        price: p.price || 0,
        categoryId: p.categoryId || p.category?._id || p.category || '',
        subcategoryId: p.subcategoryId || p.subcategory?._id || p.subcategory || '',
        categoryName: p.categoryName || p.category?.name || '',
        subcategoryName: p.subcategoryName || p.subcategory?.name || '',
        imageUrl: p.image || p.imageUrl || '',
        images: p.images || (p.image ? [p.image] : []),
      };

      if (productObj.imageUrl && productObj.imageUrl.startsWith('http')) {
        const encodedUrl = Buffer.from(productObj.imageUrl).toString('base64');
        productObj.imageUrl = `/api/image?url=${encodedUrl}`;
      }

      return productObj;
    });

    const formattedCategories = categoriesData.map((c: any) => ({
      id: c._id || c.id || c.categoryId,
      name: c.name || c.categoryName || 'Unnamed Category',
      image: c.image || c.imageUrl || '',
      order: c.order ?? 999,
    }));

    const formattedSubcategories = subcategoriesData.map((s: any) => ({
      id: s._id || s.id || s.subcategoryId,
      name: s.name || s.subcategoryName || 'Unnamed Subcategory',
      categoryId: s.categoryId || s.category || '',
      order: s.order ?? 999,
    }));

    const formattedShops = shopsData.map((shop: any) => ({
      id: shop._id || shop.id,
      shopName: shop.shopName || shop.name,
      address: shop.address || '',
      mapUrl: shop.mapUrl || '',
      imageUrl: shop.imageUrl || '',
    }));

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      counts: {
        products: formattedProducts.length,
        categories: formattedCategories.length,
        subcategories: formattedSubcategories.length,
        shops: formattedShops.length,
      },
      data: {
        products: formattedProducts,
        categories: formattedCategories,
        subcategories: formattedSubcategories,
        shops: formattedShops,
        wishlist: wishlistData,
      },
    });
  } catch (err) {
    console.error('[Bulk Sync API] Failed to assemble sync payload:', err);
    return NextResponse.json(
      { success: false, msg: 'Bulk sync aggregation failed' },
      { status: 500 }
    );
  }
}
