'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { resolveApiUrl, getAuthToken } from '../utils';
import { offlineDB } from '../offline/indexed-db';

interface AuthContextType {
  user: UserProfile | null;
  isLoggedIn: boolean;
  isPinVerified: boolean;
  login: (user: UserProfile) => void;
  logout: () => void;
  updateProfile: (profile: UserProfile) => void;
  verifyPin: (params: { pin?: string; password?: string; newPin?: string }) => Promise<{ success: boolean; msg: string; hasPinSet?: boolean; requirePassword?: boolean; requireNewPin?: boolean }>;
  resetPinVerification: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Simple stable hash for offline PIN comparison (djb2) */
function hashPin(pin: string): string {
  let hash = 5381;
  for (let i = 0; i < pin.length; i++) {
    hash = ((hash << 5) + hash) + pin.charCodeAt(i);
    hash = hash & hash; // 32-bit int
  }
  return String(hash >>> 0);
}

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function isSessionExpired(): boolean {
  if (typeof window === 'undefined') return false;
  const loginTimeStr = localStorage.getItem('matrices_login_time');
  if (!loginTimeStr) return false;
  const loginTime = Number(loginTimeStr);
  if (isNaN(loginTime) || loginTime <= 0) return false;
  return (Date.now() - loginTime) >= SESSION_DURATION_MS;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('user');
      const loginTimeStr = localStorage.getItem('matrices_login_time');
      if (loginTimeStr) {
        const elapsed = Date.now() - Number(loginTimeStr);
        if (elapsed >= SESSION_DURATION_MS) {
          return null; // Expired
        }
      }
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
      const savedUser = localStorage.getItem('user');
      const savedToken = localStorage.getItem('token');
      const loginTimeStr = localStorage.getItem('matrices_login_time');
      if (loginTimeStr) {
        const elapsed = Date.now() - Number(loginTimeStr);
        if (elapsed >= SESSION_DURATION_MS) {
          // Clean up expired session stored items immediately
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          localStorage.removeItem('matrices_login_time');
          document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          return false;
        }
      }
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
    setUser(null);
    setIsLoggedIn(false);
    markPinVerified(false);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('matrices_login_time');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  };

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
    localStorage.setItem('matrices_login_time', Date.now().toString());
  };

  const updateProfile = (profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem('user', JSON.stringify(profile));
  };

  const verifyPin = async (params: { pin?: string; password?: string; newPin?: string }): Promise<{
    success: boolean; msg: string; hasPinSet?: boolean; requirePassword?: boolean; requireNewPin?: boolean;
  }> => {
    const token = getAuthToken();
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

    // ── Local PIN check FIRST (synced local DB priority) ─────────────────────
    if (params.pin && !params.password) {
      try {
        const storedPinUser = await offlineDB.getSecure('pin_user_email');
        const currentUserEmail = (user?.email || '').toLowerCase().trim();

        // Security check: If PIN belongs to a previous/different user, reject offline verification
        if (storedPinUser && currentUserEmail && storedPinUser.toLowerCase().trim() !== currentUserEmail) {
          return { success: false, msg: 'Security PIN was set by another salesrep. Please verify with your password online.' };
        }

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
