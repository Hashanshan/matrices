'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useCart } from '@/lib/contexts/cart-context';
import { useSync } from '@/lib/contexts/sync-context';
import { Input } from '@/components/ui/input';
import {
  Menu, X, ShoppingCart as CartIcon, LogOut,
  Heart, ShieldCheck, Store, FileText, RefreshCw, ShoppingBag,
  Home, BookOpen, Grid,
  Download
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';


import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import BackButton from './back-button';

interface HeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
}

export default function Header({ searchQuery = '', onSearchChange, showSearch = true }: HeaderProps) {
  const router = useRouter();
  const { user, isLoggedIn, logout } = useAuth();
  const { cart, selectedShop, clearCart } = useCart();
  const { triggerSync, isSyncing, progress, openSyncModal, pendingQueueCount, failedQueueCount, pushChanges } = useSync();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const displayName = user?.name || (typeof window !== 'undefined' ? (localStorage.getItem('matrices_last_synced_user_name') || '') : '') || user?.email?.split('@')[0] || 'Salesrep';
  const displayEmail = user?.email || (typeof window !== 'undefined' ? (localStorage.getItem('matrices_last_synced_user_email') || '') : '') || '';
  const initialLetter = (displayName || displayEmail || 'U').charAt(0).toUpperCase();
  const showProfile = Boolean(user || isLoggedIn || (typeof window !== 'undefined' && (localStorage.getItem('token') || localStorage.getItem('user'))));

  // Close profile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  const closeAll = () => {
    setMobileMenuOpen(false);
    setShowProfileMenu(false);
  };

  const handleLogout = async () => {
    closeAll();

    // 1. Check if salesrep has unpushed modifications in SyncQueue
    const totalUnpushed = (pendingQueueCount || 0) + (failedQueueCount || 0);
    if (totalUnpushed > 0) {
      const queueResult = await Swal.fire({
        icon: 'warning',
        title: 'Unpushed Offline Changes!',
        html: `
          <div style="text-align: left; font-size: 13px; line-height: 1.6; color: #1e293b;">
            <p style="margin-bottom: 8px;">
              You have <strong>${totalUnpushed} offline modification(s)/order(s)</strong> created locally that have not been uploaded to the live database yet.
            </p>
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; padding: 10px 12px; border-radius: 8px; margin-bottom: 12px;">
              <p style="font-weight: 700; color: #92400e; margin: 0 0 4px 0;">⚡ Push Recommended Before Logout</p>
              <p style="font-size: 12px; color: #78350f; margin: 0;">
                You can push your changes now to ensure your orders are live, or keep them saved offline on this device for your next login.
              </p>
            </div>
            <p style="font-weight: 600; color: #0f172a; margin: 0;">
              Would you like to push your changes now or continue logging out?
            </p>
          </div>
        `,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '⚡ Push Changes Now',
        denyButtonText: '🔒 Keep Offline & Log Out',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#059669',
        denyButtonColor: '#0f172a',
        cancelButtonColor: '#64748b',
      });

      if (queueResult.isConfirmed) {
        openSyncModal();
        return;
      } else if (!queueResult.isDenied) {
        return; // Cancel clicked
      }
    }

    // 2. Check if user has active items in cart
    const itemCount = cart.items.length || cart.itemCount || 0;
    if (itemCount > 0) {
      const cartResult = await Swal.fire({
        icon: 'info',
        title: 'Active Shopping Cart',
        html: `
          <div style="text-align: left; font-size: 13px; line-height: 1.6; color: #1e293b;">
            <p style="margin-bottom: 8px;">
              You have <strong>${itemCount} item(s)</strong> in your shopping cart${selectedShop?.name ? ` for <strong>${selectedShop.name}</strong>` : ''}.
            </p>
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #3b82f6; padding: 10px 12px; border-radius: 8px; margin-bottom: 12px;">
              <p style="font-weight: 700; color: #1e40af; margin: 0 0 4px 0;">🛒 Cart Will Be Saved</p>
              <p style="font-size: 12px; color: #1e3a8a; margin: 0;">
                Your cart items will remain safely stored on this device for when you log back in.
              </p>
            </div>
            <p style="font-weight: 600; color: #0f172a; margin: 0;">
              Would you like to review and submit your cart order now, or keep it stored and log out?
            </p>
          </div>
        `,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '🛒 Review & Submit Cart',
        denyButtonText: '🔒 Keep Cart & Log Out',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#0f172a',
        denyButtonColor: '#334155',
        cancelButtonColor: '#64748b',
      });

      if (cartResult.isConfirmed) {
        router.push('/cart');
        return;
      } else if (!cartResult.isDenied) {
        return; // Cancel clicked
      }
    }

    logout();
    router.replace('/');
  };

  // nav links shared between hamburger & desktop
  const navLinks = [
    { href: '/catalogue', label: 'Home', icon: Home },
    { href: '/gallery', label: 'Gallery', icon: BookOpen },
    { href: '/view', label: 'Products', icon: Grid },
  ];

  const allProfileLinks = [
    { href: '/settings/orders', label: 'My Orders', icon: ShoppingBag, iconClass: 'text-amber-500' },
    { href: '/settings/wishlist', label: 'My Wishlist', icon: Heart, iconClass: 'text-red-500 fill-red-500' },
    { href: '/settings/shops', label: 'My Shops', icon: Store, iconClass: '', salesrepOnly: true },
    { href: '/settings/invoices', label: 'My Invoices', icon: FileText, iconClass: '', salesrepOnly: true },
    { href: '/settings/sync', label: 'Data Sync & Storage', icon: RefreshCw, iconClass: 'text-emerald-600', salesrepOnly: true },
    { href: '/settings/updates', label: 'App Updates & APK', icon: Download, iconClass: 'text-blue-600', salesrepOnly: true },
    { href: '/settings/security', label: 'Security Settings', icon: ShieldCheck, iconClass: '' },
  ];

  const profileLinks = user?.role === 'shop'
    ? allProfileLinks.filter(l => !l.salesrepOnly)
    : allProfileLinks;

  return (
    <header className="sticky top-0 z-50  backdrop-blur-2xl border-b border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ───── Main Bar ───── */}
        <div className="flex items-center justify-between h-20 gap-6">
          {/* Top Left: Back Button & Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <BackButton />
            <Link href="/catalogue" className="flex-shrink-0 group">
              <motion.div whileHover={{ scale: 1.05 }} className="relative h-14 w-40">
                <Image
                  src="/matrices_logo.png"
                  alt="Matrices"
                  fill
                  className="object-contain hover:opacity-90 transition-opacity"
                  priority
                />
              </motion.div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex gap-8 flex-1 justify-center">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative text-sm font-bold text-foreground hover:text-accent transition-colors group"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-1 bg-accent rounded-full group-hover:w-full transition-all duration-300" />
              </Link>
            ))}
          </nav>

          {/* Desktop Search */}
          {showSearch && (
            <div className="hidden md:flex flex-1 max-w-sm">
              <motion.div whileFocus={{ scale: 1.02 }} className="w-full">
                <Input
                  type="text"
                  placeholder="Search premium products..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="w-full px-4 py-3 bg-secondary border-2 border-border rounded-2xl focus:outline-none focus:ring-0 focus:border-accent text-foreground placeholder-muted-foreground font-medium transition-all"
                />
              </motion.div>
            </div>
          )}

          {/* ───── Right Actions ───── */}
          <div className="flex items-center gap-3 md:gap-6">
            {/* Live Background Sync Indicator */}
            {/* {isSyncing && user?.role !== 'shop' && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => openSyncModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 rounded-full font-bold text-xs cursor-pointer shadow-xs transition-all"
                title={`Catalogue syncing (${progress}%) - Click to view progress`}
              >
                <RefreshCw size={13} className="animate-spin text-sky-500" />
                <span className="hidden sm:inline font-mono">{progress}%</span>
              </motion.button>
            )} */}

            {/* Cart */}
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Link href="/cart">
                <div className="relative p-2.5 hover:bg-secondary rounded-2xl transition-colors cursor-pointer group flex items-center gap-1.5" title={selectedShop ? `Active Cart Shop: ${selectedShop.name}` : 'Shopping Cart'}>
                  <CartIcon size={24} className="text-foreground group-hover:text-accent transition-colors" />
                  {selectedShop && (
                    <span className="hidden sm:inline-block text-[10px] font-black uppercase text-blue-900 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-full truncate max-w-[90px]">
                      {selectedShop.name}
                    </span>
                  )}
                  {cart.itemCount > 0 && (
                    <motion.span
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="absolute -top-1 -right-1 bg-gradient-to-r from-accent to-accent/80 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold shadow-lg"
                    >
                      {cart.itemCount}
                    </motion.span>
                  )}
                </div>
              </Link>
            </motion.div>

            {/* Profile Avatar + Dropdown */}
            {showProfile && (
              <div className="relative hidden lg:block" ref={profileMenuRef}>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowProfileMenu(!showProfileMenu);
                    setMobileMenuOpen(false);
                  }}
                  className="p-1.5 hover:bg-secondary rounded-full transition-colors cursor-pointer"
                  title="Profile & Settings"
                >
                  <div className="w-9 h-9 bg-[#0f172a] text-white rounded-full flex items-center justify-center font-black text-sm shadow-md border border-white/40">
                    {initialLetter}
                  </div>
                </motion.button>

                <AnimatePresence>
                  {showProfileMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -15, scale: 0.95 }}
                      className="absolute right-0 mt-4 w-72 max-h-[calc(100vh-5rem)] overflow-y-auto bg-white/95 backdrop-blur-2xl border border-white/80 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.2)] p-6 space-y-3 z-50 scrollbar-none"
                    >
                      <div className="pb-3 border-b border-gray-200/60">
                        <p className="text-base font-black text-[#0f172a] uppercase">{displayName}</p>
                        {displayEmail && <p className="text-xs text-gray-500 font-bold truncate mt-0.5">{displayEmail}</p>}
                      </div>

                      {profileLinks.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setShowProfileMenu(false)}
                            className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider text-[#0f172a] bg-white hover:bg-gray-50 border border-gray-100 rounded-full transition-all shadow-xs"
                          >
                            <ItemIcon size={18} className={item.iconClass || ''} />
                            {item.label}
                          </Link>
                        );
                      })}

                      {/* <Link
                        href="/settings/sync"
                        onClick={() => setShowProfileMenu(false)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-full transition-all shadow-xs cursor-pointer"
                      >
                        <RefreshCw size={18} className="text-emerald-600" />
                        Sync Dashboard
                      </Link> */}

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-black py-4 rounded-full transition-all uppercase text-xs tracking-wider shadow-lg shadow-red-500/20 cursor-pointer"
                      >
                        <LogOut size={16} />
                        Logout
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ───── Hamburger (mobile / tablet) ───── */}
            <div className="relative lg:hidden">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setMobileMenuOpen(!mobileMenuOpen);
                  setShowProfileMenu(false);
                }}
                className="p-2.5 bg-[#0f172a] text-white hover:bg-[#1e293b] rounded-full shadow-md transition-all flex items-center justify-center cursor-pointer active:scale-90"
                title="Toggle Menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </motion.button>

              {/* Hamburger dropdown – same card style as profile */}
              <AnimatePresence>
                {mobileMenuOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setMobileMenuOpen(false)}
                    />

                    <motion.div
                      initial={{ opacity: 0, y: -15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -15, scale: 0.95 }}
                      className="absolute right-0 mt-4 w-72 max-h-[calc(100vh-5rem)] overflow-y-auto bg-white/95 backdrop-blur-2xl border border-white/80 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.2)] p-6 z-50 space-y-3 scrollbar-none"
                    >
                      {/* Mobile search */}
                      {showSearch && (
                        <div className="pb-3 border-b border-gray-200/60">
                          <Input
                            type="text"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                            className="w-full px-5 py-3 bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#0f172a] font-bold text-xs uppercase shadow-inner"
                          />
                        </div>
                      )}

                      {/* Section label */}
                      <p className="text-[0.6rem] font-black text-gray-400 uppercase tracking-widest px-1">Navigation</p>

                      {/* Nav links */}
                      {navLinks.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={closeAll}
                            className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider text-[#0f172a] bg-white hover:bg-gray-50 border border-gray-100 rounded-full transition-all shadow-xs"
                          >
                            <ItemIcon size={18} className="text-[#0f172a]" />
                            {item.label}
                          </Link>
                        );
                      })}

                      {/* Cart shortcut (only if cart has items) */}
                      {cart.itemCount > 0 && (
                        <Link
                          href="/cart"
                          onClick={closeAll}
                          className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider text-[#0f172a] bg-white hover:bg-gray-50 border border-gray-100 rounded-full transition-all shadow-xs"
                        >
                          <CartIcon size={18} />
                          Cart ({cart.itemCount})
                        </Link>
                      )}

                      {/* Divider & profile links if logged-in */}
                      {showProfile && (
                        <>
                          <div className="pt-1 border-t border-gray-200/60">
                            <p className="text-[0.6rem] font-black text-gray-400 uppercase tracking-widest px-1 mb-3 mt-2">Account</p>
                            <div className="pb-2 px-1">
                              <p className="text-sm font-black text-[#0f172a] uppercase leading-tight">{displayName}</p>
                              {displayEmail && <p className="text-xs text-gray-500 font-bold truncate">{displayEmail}</p>}
                            </div>
                          </div>

                          {profileLinks.map((item) => {
                            const ItemIcon = item.icon;
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={closeAll}
                                className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider text-[#0f172a] bg-white hover:bg-gray-50 border border-gray-100 rounded-full transition-all shadow-xs"
                              >
                                <ItemIcon size={18} className={item.iconClass || ''} />
                                {item.label}
                              </Link>
                            );
                          })}

                          {/* <Link
                            href="/settings/sync"
                            onClick={closeAll}
                            className="w-full flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-full transition-all shadow-xs cursor-pointer"
                          >
                            <RefreshCw size={18} className="text-emerald-600" />
                            Sync Dashboard
                          </Link> */}

                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-black py-4 rounded-full transition-all uppercase text-xs tracking-wider shadow-lg shadow-red-500/20 cursor-pointer"
                          >
                            <LogOut size={16} />
                            Logout
                          </motion.button>
                        </>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
