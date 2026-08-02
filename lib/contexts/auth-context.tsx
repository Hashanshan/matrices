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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPinVerified, setIsPinVerified] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setIsLoggedIn(true);
      } catch (error) {
        console.error('Failed to parse user from localStorage:', error);
      }
    }

    const handleAuthError = () => {
      const mode = typeof window !== 'undefined' ? localStorage.getItem('matrices_data_mode') : null;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (mode === 'offline') return;
      logout();
      window.location.href = '/';
    };
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, []);

  const login = (newUser: UserProfile) => {
    setUser(newUser);
    setIsLoggedIn(true);
    setIsPinVerified(false);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
    setIsPinVerified(false);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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

    // ── Offline PIN check ────────────────────────────────────────────────────
    if (!isOnline && params.pin && !params.password) {
      try {
        const storedHash = await offlineDB.getSecure('pin_hash');
        if (storedHash) {
          const inputHash = hashPin(params.pin);
          if (inputHash === storedHash) {
            setIsPinVerified(true);
            return { success: true, msg: 'PIN verified (offline)' };
          } else {
            return { success: false, msg: 'Incorrect PIN (offline mode)' };
          }
        } else {
          return { success: false, msg: 'No offline PIN stored. Please sync first.', hasPinSet: false, requirePassword: true };
        }
      } catch {
        return { success: false, msg: 'Offline PIN check failed.' };
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
        setIsPinVerified(true);

        // Persist PIN hash offline for future offline access
        if (params.pin) {
          try {
            await offlineDB.saveSecure('pin_hash', hashPin(params.pin));
          } catch { /* non-critical */ }
        }
        if (params.newPin) {
          try {
            await offlineDB.saveSecure('pin_hash', hashPin(params.newPin));
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
          const storedHash = await offlineDB.getSecure('pin_hash');
          if (storedHash && hashPin(params.pin) === storedHash) {
            setIsPinVerified(true);
            return { success: true, msg: 'PIN verified (offline fallback)' };
          }
        } catch { /* ignore */ }
      }
      console.error('verifyPin error in context:', err);
      return { success: false, msg: 'Error connecting to server' };
    }
  };

  const resetPinVerification = () => {
    setIsPinVerified(false);
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
