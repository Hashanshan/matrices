'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import FullscreenProductViewer from '@/components/fullscreen-product-viewer';
import { Product } from '@/lib/types';
import Header from '@/components/header';

export default function SingleViewPage() {
  const { isLoggedIn } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchProducts = async () => {
      try {
        const token = localStorage.getItem('token');
        // Fetch products sorted for view mode: subCategory -> category -> name
        const res = await fetch('http://localhost:5000/api/catelogue/products?sort=view', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!res.ok) {
          throw new Error('Failed to fetch catalogue data');
        }

        const data = await res.json();
        setProducts(data.data || []);
      } catch (err: any) {
        console.error('Error fetching products:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [isLoggedIn]);

  if (loading) {
    return (
      <>
        <Header showSearch={false} />
        <main className="min-h-screen bg-transparent py-8 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header showSearch={false} />
        <main className="min-h-screen bg-transparent py-8 flex justify-center items-center">
          <div className="text-red-500 font-bold">{error}</div>
        </main>
      </>
    );
  }

  if (products.length === 0) {
    return (
      <>
        <Header showSearch={false} />
        <main className="min-h-screen bg-transparent py-8 flex justify-center items-center">
          <div className="text-gray-500 font-bold">No products found.</div>
        </main>
      </>
    );
  }

  return (
    <>
      <FullscreenProductViewer products={products} />
    </>
  );
}
