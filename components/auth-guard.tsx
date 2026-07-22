'use client';

import { useAuth } from '@/lib/contexts/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // If user is not logged in and not on the login page (root), redirect to root
    if (!isLoggedIn && pathname !== '/') {
      router.replace('/');
    }
    
    // Optional: If user is logged in and on the login page, redirect to catalogue
    if (isLoggedIn && pathname === '/') {
      router.replace('/catalogue');
    }
  }, [isLoggedIn, pathname, router, mounted]);

  // Don't render children until we've checked auth to prevent flashing protected content
  if (!mounted) {
    return null; // Or a loading spinner
  }

  // If not logged in and trying to access a protected route, don't render children (redirect will happen)
  if (!isLoggedIn && pathname !== '/') {
    return null; // Or a loading spinner
  }

  return <>{children}</>;
}
