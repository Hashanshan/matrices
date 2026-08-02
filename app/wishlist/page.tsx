'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WishlistRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/wishlist');
  }, [router]);

  return (
    <div className="min-h-screen bg-[url(/bg.png)] bg-cover bg-center bg-no-repeat bg-fixed flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
    </div>
  );
}
