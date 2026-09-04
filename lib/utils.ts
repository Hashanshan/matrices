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
    const query = path.replace('/api/products/filters', '');
    return `${BACKEND_URL}/api/catelogue/products/filters${query}`;
  }
  if (path.startsWith('/api/products')) {
    const query = path.replace('/api/products', '');
    return `${BACKEND_URL}/api/catelogue/products${query}`;
  }
  if (path.startsWith('/api/wishlist')) {
    const subPath = path.replace('/api/wishlist', '');
    return `${BACKEND_URL}/api/catelogue/wishlist${subPath}`;
  }
  if (path.startsWith('/api/sync/all')) {
    const subPath = path.replace('/api/sync/all', '');
    return `${BACKEND_URL}/api/catelogue/sync/all${subPath}`;
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
    const subPath = path.replace('/api/auth/profile', '');
    return `${BACKEND_URL}/api/catelogue/auth/profile${subPath}`;
  }
  if (path.startsWith('/api/auth/verify-pin')) {
    const subPath = path.replace('/api/auth/verify-pin', '');
    return `${BACKEND_URL}/api/catelogue/auth/verify-pin${subPath}`;
  }
  if (path.startsWith('/api/')) {
    return `${BACKEND_URL}${path}`;
  }

  return path;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token') || localStorage.getItem('matrices_token');
  if (token && token !== 'undefined' && token !== 'null') return token;

  const savedUser = localStorage.getItem('user') || localStorage.getItem('matrices_user');
  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser);
      if (parsed?.token && parsed.token !== 'undefined' && parsed.token !== 'null') {
        return parsed.token;
      }
    } catch (e) {}
  }

  // Only check document.cookie if an active user session exists in localStorage
  if (savedUser) {
    const cookieMatch = document.cookie.match(/(?:^|; )\s*token\s*=\s*([^;]+)/);
    if (cookieMatch) {
      const val = decodeURIComponent(cookieMatch[1]);
      if (val && val !== 'undefined' && val !== 'null') return val;
    }
  }

  return null;
}

/** Check if API response indicates token/session expiration and redirect to login */
export function handleTokenExpiredRedirect(data?: any, status?: number): boolean {
  if (typeof window === 'undefined') return false;

  const msg = typeof data === 'string'
    ? data
    : (data?.msg || data?.message || data?.error || '');

  const isExpired =
    status === 401 ||
    status === 403 ||
    (typeof msg === 'string' && /token expired|jwt expired|session expired/i.test(msg));

  if (isExpired) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('matrices_user');
    localStorage.removeItem('matrices_token');
    localStorage.removeItem('matrices_login_time');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax;';
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0;';
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0;';

    const isLoginPage = window.location.pathname === '/';
    if (!isLoginPage) {
      window.location.href = '/?expired=true';
    }
    return true;
  }
  return false;
}
