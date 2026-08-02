import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://magnum-backend.vercel.app';

export function resolveApiUrl(path: string): string {
  if (!path) return path;

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (path.startsWith('/api/products/filters')) {
    return `${BACKEND_URL}/api/catelogue/products/filters`;
  }
  if (path.startsWith('/api/products')) {
    const query = path.replace('/api/products', '');
    return `${BACKEND_URL}/api/catelogue/products${query}`;
  }
  if (path.startsWith('/api/wishlist/reorder')) {
    return `${BACKEND_URL}/api/catelogue/wishlist/reorder`;
  }
  if (path.startsWith('/api/wishlist')) {
    return `${BACKEND_URL}/api/catelogue/wishlist`;
  }
  if (path.startsWith('/api/sync/all')) {
    return `${BACKEND_URL}/api/catelogue/sync/all`;
  }
  if (path.startsWith('/api/shops')) {
    const subPath = path.replace('/api/shops', '');
    return `${BACKEND_URL}/api/catelogue/shops${subPath}`;
  }
  if (path.startsWith('/api/orders')) {
    const subPath = path.replace('/api/orders', '');
    return `${BACKEND_URL}/api/catelogue/orders${subPath}`;
  }
  if (path.startsWith('/api/auth/profile')) {
    return `${BACKEND_URL}/api/catelogue/auth/profile`;
  }
  if (path.startsWith('/api/auth/verify-pin')) {
    return `${BACKEND_URL}/api/catelogue/auth/verify-pin`;
  }
  if (path.startsWith('/api/')) {
    return `${BACKEND_URL}${path}`;
  }

  return path;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (token && token !== 'undefined' && token !== 'null') return token;

  const savedUser = localStorage.getItem('user');
  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser);
      if (parsed?.token && parsed.token !== 'undefined' && parsed.token !== 'null') {
        return parsed.token;
      }
    } catch (e) {}
  }

  const cookieMatch = document.cookie.match(/(?:^|; )\s*token\s*=\s*([^;]+)/);
  if (cookieMatch) {
    const val = decodeURIComponent(cookieMatch[1]);
    if (val && val !== 'undefined' && val !== 'null') return val;
  }

  return null;
}
