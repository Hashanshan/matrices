'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';

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

import { resolveApiUrl, getAuthToken } from '../utils';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPinVerified, setIsPinVerified] = useState(false);

  // Load user from localStorage on mount
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

  const verifyPin = async (params: { pin?: string; password?: string; newPin?: string }): Promise<{ success: boolean; msg: string; hasPinSet?: boolean; requirePassword?: boolean; requireNewPin?: boolean }> => {
    const token = getAuthToken();
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
