'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, hashCredential } from '@/lib/contexts/auth-context';
import Image from 'next/image';
import { offlineDB } from '@/lib/offline/indexed-db';
import { clearSyncQueue } from '@/lib/offline/pending-sync';
import { clearMatricesFolder, invalidateImageMemoryMap } from '@/lib/offline/image-cache';
import { invalidateProductIndex } from '@/lib/offline/offline-search';

function LoginFormContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [expiredMsg, setExpiredMsg] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    const isExpired = searchParams.get('expired') === 'true' || searchParams.get('sessionExpired') === 'true';
    const isAuthRequired = searchParams.get('auth') === 'required' || searchParams.get('login') === 'required';
    const errorParam = searchParams.get('error') || searchParams.get('msg');

    if (isExpired) {
      setExpiredMsg(true);
      import('sweetalert2').then((Swal) => {
        Swal.default.fire({
          icon: 'warning',
          title: 'Session Expired',
          text: 'Your 24-hour login session has expired. Please sign in again to continue.',
          timer: 4500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
          timerProgressBar: true,
        });
      });
    } else if (isAuthRequired) {
      import('sweetalert2').then((Swal) => {
        Swal.default.fire({
          icon: 'info',
          title: 'Sign In Required',
          text: 'Please sign in to access the product catalogue.',
          timer: 3500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
          timerProgressBar: true,
        });
      });
    } else if (errorParam) {
      const decoded = decodeURIComponent(errorParam);
      setError(decoded);
      import('sweetalert2').then((Swal) => {
        Swal.default.fire({
          icon: 'error',
          title: 'Authentication Error',
          text: decoded,
          timer: 4500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
          timerProgressBar: true,
        });
      });
    }
  }, [searchParams]);

  const handleOfflineLogin = async (cleanEmail: string, cleanPassword: string): Promise<boolean> => {
    try {
      const storedEmail = await offlineDB.getSecure('offline_auth_email').catch(() => null);
      const storedHash = await offlineDB.getSecure('offline_auth_hash').catch(() => null);
      const storedProfileStr = await offlineDB.getSecure('offline_auth_user').catch(() => null);

      if (!storedEmail || !storedHash) {
        return false;
      }

      if (storedEmail.toLowerCase() !== cleanEmail) {
        setError('Email does not match the account synced on this device.');
        return true;
      }

      const inputHash = hashCredential(`${cleanEmail}:${cleanPassword}`);
      if (inputHash !== storedHash) {
        setError('Incorrect password for offline access.');
        return true;
      }

      let userObj: any = {
        id: cleanEmail,
        name: cleanEmail.split('@')[0] || 'Salesrep',
        email: cleanEmail,
        role: 'salesrep',
      };
      if (storedProfileStr) {
        try {
          userObj = JSON.parse(storedProfileStr);
        } catch {}
      }

      login(userObj);
      localStorage.setItem('matrices_login_time', Date.now().toString());

      const SwalModule = await import('sweetalert2');
      const Swal = SwalModule.default;
      Swal.fire({
        icon: 'success',
        title: 'Signed In (Offline)',
        text: '24-hour offline access granted. Working in offline mode.',
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });

      router.push('/catalogue');
      return true;
    } catch (err) {
      console.error('Offline login error:', err);
      return false;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Check if offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const handled = await handleOfflineLogin(cleanEmail, cleanPassword);
      if (!handled) {
        setError('No offline credentials found on this device. Connect to the internet for the first login.');
      }
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(BACKEND_URL + '/api/catelogue/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        const userObj = {
          id: data.id || data.shopId || cleanEmail,
          name: data.name,
          email: data.email,
          role: data.role,
          shopId: data.shopId || data.id,
          phone: data.phone || '',
          address: data.address || '',
          token: data.token,
        };

        // Cache offline credentials securely for future 24-hour offline logins
        try {
          const credHash = hashCredential(`${cleanEmail}:${cleanPassword}`);
          await offlineDB.saveSecure('offline_auth_email', cleanEmail);
          await offlineDB.saveSecure('offline_auth_hash', credHash);
          await offlineDB.saveSecure('offline_auth_user', JSON.stringify(userObj));
        } catch (e) {
          console.warn('Failed to cache offline auth credentials:', e);
        }

        // If logged-in user is a shop, immediately clear all offline cache and redirect to catalogue in online mode
        if (data.role === 'shop') {
          login(userObj as any);
          localStorage.setItem('token', data.token);
          localStorage.setItem('matrices_login_time', Date.now().toString());
          document.cookie = `token=${data.token}; path=/; max-age=86400; SameSite=Lax`;

          await offlineDB.clearAllData().catch(() => {});
          await clearSyncQueue().catch(() => {});
          await clearMatricesFolder().catch(() => {});
          if (typeof window !== 'undefined' && 'caches' in window) {
            try {
              await caches.delete('matrices-product-images-v1');
            } catch {}
          }
          invalidateImageMemoryMap();
          invalidateProductIndex();

          localStorage.setItem('matrices_data_mode', 'online');
          localStorage.removeItem('matrices_last_synced_user_email');
          localStorage.removeItem('matrices_last_synced_user_name');
          window.dispatchEvent(new Event('matrices-data-mode-change'));
          window.dispatchEvent(new Event('matrices-sync-stats-updated'));

          router.push('/catalogue');
          return;
        }

        // 1. Check existing offline sync metadata and previously synced user (for salesreps)
        const existingMeta = await offlineDB.getMeta().catch(() => null);
        const storedSyncedEmail = (
          existingMeta?.syncedUserEmail ||
          (await offlineDB.getSecure('synced_user_email').catch(() => '')) ||
          (typeof window !== 'undefined' ? localStorage.getItem('matrices_last_synced_user_email') : '') ||
          ''
        ).toLowerCase().trim();

        const currentEmail = (data.email || cleanEmail || '').toLowerCase().trim();

        // Check if there is actual cached data in offline storage
        const hasOfflineData = Boolean(
          existingMeta &&
          (existingMeta.totalProducts > 0 || existingMeta.totalShops > 0 || Boolean(existingMeta.lastSyncedAt))
        );

        const isDifferentUser = Boolean(
          hasOfflineData &&
          storedSyncedEmail &&
          currentEmail &&
          storedSyncedEmail !== currentEmail
        );

        login(userObj as any);

        localStorage.setItem('token', data.token);
        localStorage.setItem('matrices_login_time', Date.now().toString());
        document.cookie = `token=${data.token}; path=/; max-age=86400; SameSite=Lax`;

        if (isDifferentUser) {
          const prevDisplayName = existingMeta?.syncedUserName || storedSyncedEmail;
          const currentDisplayName = data.name || data.email;

          const SwalModule = await import('sweetalert2');
          const Swal = SwalModule.default;

          const alertResult = await Swal.fire({
            icon: 'warning',
            title: 'Different User Login',
            html: `
              <div style="text-align: left; font-size: 13px; line-height: 1.6; color: #1e293b;">
                <p style="margin-bottom: 8px;">
                  You are logged in as <strong>${currentDisplayName}</strong> (<span style="color: #0284c7;">${currentEmail}</span>).
                </p>
                <div style="background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; padding: 10px 12px; border-radius: 8px; margin-bottom: 12px;">
                  <p style="font-weight: 700; color: #92400e; margin: 0 0 4px 0;">⚠️ Security & Data Isolation Notice</p>
                  <p style="font-size: 12px; color: #78350f; margin: 0;">
                    Device cache contains offline data & passcode previously synced for <strong>${prevDisplayName}</strong>.
                    To protect customer shops and orders, old cached data must be cleared before syncing your assigned catalogue.
                  </p>
                </div>
                <p style="font-weight: 600; color: #0f172a; margin: 0;">
                  Please clear old cache and download your sync data:
                </p>
              </div>
            `,
            showCancelButton: true,
            confirmButtonText: '⚡ Clear Cache & Sync My Data',
            cancelButtonText: '🧹 Clear Cache & Continue Online',
            confirmButtonColor: '#059669',
            cancelButtonColor: '#0f172a',
            allowOutsideClick: false,
            allowEscapeKey: false,
          });

          // Always wipe old user's private data, queue, and passcode so old user's shops are NEVER visible to the new user
          await offlineDB.clearAllData().catch(() => {});
          await clearSyncQueue().catch(() => {});
          await clearMatricesFolder().catch(() => {});
          if (typeof window !== 'undefined' && 'caches' in window) {
            try {
              await caches.delete('matrices-product-images-v1');
            } catch {}
          }
          invalidateImageMemoryMap();
          invalidateProductIndex();

          localStorage.setItem('matrices_data_mode', 'online');
          localStorage.removeItem('matrices_last_synced_user_email');
          localStorage.removeItem('matrices_last_synced_user_name');
          window.dispatchEvent(new Event('matrices-data-mode-change'));
          window.dispatchEvent(new Event('matrices-sync-stats-updated'));

          if (alertResult.isConfirmed) {
            router.push('/catalogue?startSync=true');
          } else {
            router.push('/catalogue');
          }
        } else {
          router.push('/catalogue');
        }
      } else {
        setError(data.msg || 'Login failed. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      // If network failed, attempt offline login fallback if cached credentials exist
      const handled = await handleOfflineLogin(cleanEmail, cleanPassword);
      if (!handled) {
        setError('A network error occurred and no matching offline account was found on this device.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const SwalModule = await import('sweetalert2');
    const Swal = SwalModule.default;
    const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    const { value: emailInput } = await Swal.fire({
      title: 'Reset Password',
      text: 'Enter your registered email address to receive a newly generated password.',
      input: 'email',
      inputValue: email.trim(),
      inputPlaceholder: 'name@example.com',
      showCancelButton: true,
      confirmButtonText: 'Send New Password',
      confirmButtonColor: '#0f172a',
      cancelButtonColor: '#64748b',
      inputValidator: (val) => {
        if (!val || !val.includes('@')) {
          return 'Please enter a valid email address';
        }
      },
      showLoaderOnConfirm: true,
      preConfirm: async (enteredEmail) => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/catelogue/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: enteredEmail.trim() }),
          });
          const json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(json.msg || json.message || 'Failed to request password reset');
          }
          return json;
        } catch (err: any) {
          Swal.showValidationMessage(err.message || 'Error communicating with server');
        }
      },
      allowOutsideClick: () => !Swal.isLoading(),
    });

    if (emailInput) {
      await Swal.fire({
        icon: 'success',
        title: 'Password Dispatched!',
        html: `
          <div style="text-align: left; font-size: 13px; line-height: 1.6; color: #1e293b;">
            <p style="margin-bottom: 8px;">
              A new password has been generated and sent to <strong>${emailInput}</strong>.
            </p>
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; padding: 10px 12px; border-radius: 8px; margin-bottom: 12px;">
              <p style="font-weight: 700; color: #92400e; margin: 0 0 4px 0;">📬 Check Spam / Junk Folder</p>
              <p style="font-size: 12px; color: #78350f; margin: 0;">
                If you do not see the email in your inbox within a couple of minutes, please check your <strong>Spam or Junk folder</strong>.
              </p>
            </div>
            <p style="font-size: 11px; color: #64748b; margin: 0;">
              * For security purposes, password reset requests can only be made once every 1 hour.
            </p>
          </div>
        `,
        confirmButtonText: 'Return to Sign In',
        confirmButtonColor: '#0f172a',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[url(/bg.png)] bg-cover bg-center bg-no-repeat bg-fixed">
      <div className="rounded-[2rem] max-w-md w-full bg-white/10 backdrop-blur-sm border border-[#0f172a] space-y-8 p-8 sm:p-10 shadow-xl transition-all duration-300 hover:shadow-2xl">
        <div>
          {/* logo */}
          <Image
            src="/matrices_logo.png"
            alt="Logo"
            width={100}
            height={100}
            className='mx-auto h-auto w-60'
          />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Matrices Sign In
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Sign in to access your catalogue and orders
          </p>
        </div>
        {expiredMsg && (
          <div className="bg-amber-500/20 border border-amber-500/50 text-amber-100 p-3 rounded-[1rem] text-xs text-center font-bold uppercase tracking-wide">
            Your 24-hour session has expired. Please sign in with your password to continue.
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md -space-y-px">
            <div className="mb-4">
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-[1rem] relative block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-colors duration-200"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-[1rem] relative block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-colors duration-200"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end -mt-3">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs font-bold text-gray-700 hover:text-black transition-colors underline cursor-pointer"
            >
              Forgot Password?
            </button>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center font-medium animate-pulse">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-[1rem] text-white ${loading ? 'bg-[#0f172a] cursor-not-allowed' : 'bg-[#0f172a] hover:bg-[#233042] focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                } transition-all duration-200 ease-in-out transform hover:-translate-y-0.5 cursor-pointer`}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f172a]" />}>
      <LoginFormContent />
    </Suspense>
  );
}
