'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import Header from '@/components/header';
import ProductGallery from '@/components/product-gallery';
import { Product } from '@/lib/types';
import { useSearchParams } from 'next/navigation';

export default function GalleryPage() {
  const { isLoggedIn } = useAuth();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || '';
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchProducts = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/catelogue/products', {
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
        <main className="min-h-screen bg-background flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header showSearch={false} />
        <main className="min-h-screen bg-background flex justify-center items-center">
          <div className="text-red-500 font-bold">{error}</div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ProductGallery 
            products={products} 
            searchQuery="" 
            initialCategory={initialCategory}
          />
        </div>
      </main>
    </>
  );
}
