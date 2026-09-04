'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { resolveApiUrl, getAuthToken } from '../utils';
import { offlineDB } from '../offline/indexed-db';
import { clearMatricesFolder, invalidateImageMemoryMap } from '../offline/image-cache';
import { clearSyncQueue } from '../offline/pending-sync';
import { invalidateProductIndex } from '../offline/offline-search';

interface AuthContextType {
  user: UserProfile | null;
  isLoggedIn: boolean;
  isPinVerified: boolean;
  login: (user: UserProfile) => void;
  logout: () => void;
  updateProfile: (profile: UserProfile) => void;
  verifyPin: (params: { pin?: string; password?: string; newPin?: string }) => Promise<{ success: boolean; msg: string; hasPinSet?: boolean; requirePassword?: boolean; requireNewPin?: boolean }>;
  resetPinVerification: () => void;
  markPinVerified: (verified: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Simple stable hash for offline PIN/password comparison (djb2) */
export function hashCredential(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // 32-bit int
  }
  return String(hash >>> 0);
}

export const hashPin = hashCredential;

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function isSessionExpired(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  if (!token && !savedUser) return false; // Not logged in -> NOT expired!

  const loginTimeStr = localStorage.getItem('matrices_login_time');
  if (!loginTimeStr) {
    // If user credentials exist but timestamp wasn't written yet, heal it with current time
    localStorage.setItem('matrices_login_time', Date.now().toString());
    return false;
  }
  const loginTime = Number(loginTimeStr);
  if (isNaN(loginTime) || loginTime <= 0) {
    localStorage.setItem('matrices_login_time', Date.now().toString());
    return false;
  }
  return (Date.now() - loginTime) >= SESSION_DURATION_MS;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      if (isSessionExpired()) {
        return null; // Session expired
      }
      const savedUser = localStorage.getItem('user') || localStorage.getItem('matrices_user');
      if (savedUser) {
        try {
          return JSON.parse(savedUser);
        } catch (error) {
          console.error('Failed to parse user from localStorage:', error);
        }
      }
    }
    return null;
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      if (isSessionExpired()) {
        // Clean up expired session stored items immediately
        localStorage.removeItem('user');
        localStorage.removeItem('matrices_user');
        localStorage.removeItem('token');
        localStorage.removeItem('matrices_login_time');
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        return false;
      }
      const savedUser = localStorage.getItem('user') || localStorage.getItem('matrices_user');
      const savedToken = localStorage.getItem('token');
      return Boolean(savedUser || savedToken);
    }
    return false;
  });

  const [isPinVerified, setIsPinVerified] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('matrices_pin_verified') === 'true';
    }
    return false;
  });

  const markPinVerified = (verified: boolean) => {
    setIsPinVerified(verified);
    if (typeof window !== 'undefined') {
      if (verified) {
        sessionStorage.setItem('matrices_pin_verified', 'true');
      } else {
        sessionStorage.removeItem('matrices_pin_verified');
      }
    }
  };

  const logout = () => {
    // Record cart owner and user info before clearing session so on next login we can detect match/mismatch and show proper name
    if (user?.email) {
      localStorage.setItem('matrices_cart_owner', user.email.toLowerCase().trim());
      localStorage.setItem('matrices_last_user_email', user.email.toLowerCase().trim());
      if (user.name) {
        localStorage.setItem('matrices_last_user_name', user.name);
      }
    }
    setUser(null);
    setIsLoggedIn(false);
    markPinVerified(false);
    localStorage.removeItem('user');
    localStorage.removeItem('matrices_user');
    localStorage.removeItem('token');
    localStorage.removeItem('matrices_token');
    localStorage.removeItem('matrices_login_time');
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('matrices-auth-updated'));
    }
  };

  const restoreUserSession = async () => {
    if (typeof window === 'undefined') return;
    try {
      if (isSessionExpired()) {
        logout();
        return;
      }

      let parsedUser: UserProfile | null = null;
      const savedUser = localStorage.getItem('user') || localStorage.getItem('matrices_user');
      if (savedUser) {
        try {
          parsedUser = JSON.parse(savedUser);
        } catch (e) {}
      }

      const token = getAuthToken();
      if (parsedUser) {
        setUser(parsedUser);
        setIsLoggedIn(true);
      } else if (token) {
        setIsLoggedIn(true);
      } else {
        logout();
        return;
      }

      // If online and token exists, fetch latest profile from backend to ensure data is 100% fresh
      if (token && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const profileUrl = resolveApiUrl('/api/auth/profile');
          const res = await fetch(profileUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          });
          if (res.ok) {
            const data = await res.json();
            if (data && (data.name || data.email)) {
              const freshUser: UserProfile = {
                id: data.id || data._id || parsedUser?.id || '',
                name: data.name || parsedUser?.name || '',
                email: data.email || parsedUser?.email || '',
                role: data.role || parsedUser?.role || (data.shopId ? 'shop' : 'salesrep'),
                shopId: data.shopId || parsedUser?.shopId || '',
                phone: data.phone || parsedUser?.phone || '',
                address: data.address || parsedUser?.address || '',
                city: data.city || parsedUser?.city || '',
                zipCode: data.zipCode || parsedUser?.zipCode || '',
                hasPinSet: data.hasPinSet ?? parsedUser?.hasPinSet,
              };
              setUser(freshUser);
              setIsLoggedIn(true);
              localStorage.setItem('user', JSON.stringify(freshUser));
              if (freshUser.name) localStorage.setItem('matrices_last_synced_user_name', freshUser.name);
              if (freshUser.email) localStorage.setItem('matrices_last_synced_user_email', freshUser.email);
            }
          } else if (res.status === 401 || res.status === 403) {
            // Token expired on server
            logout();
            if (typeof window !== 'undefined' && window.location.pathname !== '/') {
              window.location.href = '/?expired=true';
            }
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Error restoring user session:', err);
    }
  };

  // Restore and sync session on mount and listen to storage/sync events
  useEffect(() => {
    restoreUserSession();

    const handleAuthUpdated = () => {
      restoreUserSession();
    };

    window.addEventListener('matrices-auth-updated', handleAuthUpdated);
    window.addEventListener('storage', handleAuthUpdated);
    window.addEventListener('matrices-sync-stats-updated', handleAuthUpdated);

    return () => {
      window.removeEventListener('matrices-auth-updated', handleAuthUpdated);
      window.removeEventListener('storage', handleAuthUpdated);
      window.removeEventListener('matrices-sync-stats-updated', handleAuthUpdated);
    };
  }, []);

  // Check 24-hour expiration periodically and on window focus
  useEffect(() => {
    const checkExpiration = () => {
      if (isLoggedIn && isSessionExpired()) {
        logout();
        if (typeof window !== 'undefined' && window.location.pathname !== '/') {
          window.location.href = '/?expired=true';
        }
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 30000); // Check every 30s
    window.addEventListener('focus', checkExpiration);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkExpiration);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    const handleAuthError = () => {
      const mode = typeof window !== 'undefined' ? localStorage.getItem('matrices_data_mode') : null;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (mode === 'offline') return;
      // If user session exists locally, do not kill local session on transient network auth errors
      const savedUser = localStorage.getItem('user');
      if (savedUser) return;
      logout();
      window.location.href = '/';
    };
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, []);

  const login = (newUser: UserProfile) => {
    setUser(newUser);
    setIsLoggedIn(true);
    markPinVerified(false);
    localStorage.setItem('user', JSON.stringify(newUser));
    if (newUser.name) {
      localStorage.setItem('matrices_last_user_name', newUser.name);
      localStorage.setItem('matrices_last_synced_user_name', newUser.name);
    }
    if (newUser.email) {
      localStorage.setItem('matrices_last_user_email', newUser.email.toLowerCase().trim());
      localStorage.setItem('matrices_last_synced_user_email', newUser.email.toLowerCase().trim());
    }
    localStorage.setItem('matrices_login_time', Date.now().toString());

    if (newUser.role === 'shop') {
      offlineDB.clearAllData().catch(() => {});
      clearSyncQueue().catch(() => {});
      clearMatricesFolder().catch(() => {});
      invalidateImageMemoryMap();
      invalidateProductIndex();
      localStorage.removeItem('matrices_last_synced_user_email');
      localStorage.removeItem('matrices_last_synced_user_name');
      localStorage.setItem('matrices_data_mode', 'online');
      const shopObj = {
        shopId: newUser.shopId || newUser.id,
        name: newUser.name || 'Your Shop',
        email: newUser.email || '',
        phone: newUser.phone || '',
        address: newUser.address || (newUser.city ? `${newUser.city}` : ''),
      };
      localStorage.setItem('matrices_cart_shop', JSON.stringify(shopObj));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('matrices-data-mode-change'));
        window.dispatchEvent(new Event('matrices-sync-stats-updated'));
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('matrices-auth-updated'));
    }
  };

  const updateProfile = (profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem('user', JSON.stringify(profile));
    if (profile.name) localStorage.setItem('matrices_last_synced_user_name', profile.name);
    if (profile.email) localStorage.setItem('matrices_last_synced_user_email', profile.email);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('matrices-auth-updated'));
    }
  };

  const verifyPin = async (params: { pin?: string; password?: string; newPin?: string }): Promise<{
    success: boolean; msg: string; hasPinSet?: boolean; requirePassword?: boolean; requireNewPin?: boolean;
  }> => {
    const token = getAuthToken();
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

    // ── Local PIN check FIRST (synced local DB priority for current user) ─────
    if (params.pin && !params.password) {
      try {
        const storedPinUser = await offlineDB.getSecure('pin_user_email');
        const currentUserEmail = (user?.email || '').toLowerCase().trim();

        // If stored PIN belongs to the CURRENT user, verify locally
        if (storedPinUser && currentUserEmail && storedPinUser.toLowerCase().trim() === currentUserEmail) {
          const storedHash = await offlineDB.getSecure('pin_hash');
          if (storedHash) {
            const inputHash = hashPin(params.pin);
            if (inputHash === storedHash) {
              markPinVerified(true);
              return { success: true, msg: 'PIN verified' };
            } else {
              return { success: false, msg: 'Incorrect PIN' };
            }
          }
        } else if (!isOnline) {
          // If completely offline and PIN belongs to a different user, reject
          if (storedPinUser && currentUserEmail && storedPinUser.toLowerCase().trim() !== currentUserEmail) {
            return { success: false, msg: 'Security PIN was set by another salesrep. Please connect to the internet to verify with your password online.' };
          }
        }
      } catch {
        /* Fallthrough to live API if local check errors */
      }
    }

    // ── Online server check ──────────────────────────────────────────────────
    const targetUrl = resolveApiUrl('/api/auth/verify-pin');
    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        markPinVerified(true);

        // Persist PIN hash offline for future offline access for the current user
        const pinToSave = params.newPin || params.pin;
        if (pinToSave) {
          try {
            await offlineDB.saveSecure('pin_hash', hashPin(pinToSave));
            if (user?.email) {
              await offlineDB.saveSecure('pin_user_email', user.email.toLowerCase().trim());
            }
          } catch { /* non-critical */ }
        }

        return {
          success: true,
          msg: data.msg || 'PIN verified',
          requireNewPin: data.requireNewPin,
        };
      } else {
        return {
          success: false,
          msg: data.msg || 'Invalid PIN or password',
          hasPinSet: data.hasPinSet,
          requirePassword: data.requirePassword,
        };
      }
    } catch (err) {
      // Network error → try offline fallback for PIN-only check
      if (params.pin && !params.password) {
        try {
          const storedPinUser = await offlineDB.getSecure('pin_user_email');
          const currentUserEmail = (user?.email || '').toLowerCase().trim();

          if (!storedPinUser || !currentUserEmail || storedPinUser.toLowerCase().trim() === currentUserEmail) {
            const storedHash = await offlineDB.getSecure('pin_hash');
            if (storedHash && hashPin(params.pin) === storedHash) {
              markPinVerified(true);
              return { success: true, msg: 'PIN verified (offline fallback)' };
            }
          }
        } catch { /* ignore */ }
      }
      console.error('verifyPin error in context:', err);
      return { success: false, msg: 'Error connecting to server' };
    }
  };

  const resetPinVerification = () => {
    markPinVerified(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn,
        isPinVerified,
        login,
        logout,
        updateProfile,
        verifyPin,
        resetPinVerification,
        markPinVerified,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
