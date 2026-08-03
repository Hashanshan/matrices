'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useCart } from '@/lib/contexts/cart-context';
import { useSync } from '@/lib/contexts/sync-context';
import { useDataMode } from '@/lib/contexts/data-mode-context';
import { Input } from '@/components/ui/input';
import {
  Menu, X, ShoppingCart as CartIcon, LogOut,
  Heart, ShieldCheck, Store, FileText, RefreshCw,
  Home, BookOpen, Grid, Database, Wifi, WifiOff
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';


import BackButton from './back-button';

interface HeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
}

export default function Header({ searchQuery = '', onSearchChange, showSearch = true }: HeaderProps) {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const { triggerSync } = useSync();
  const { dataMode, toggleDataMode, hasSyncedData } = useDataMode();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

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

  const handleDataModeToggle = async () => {
    if (dataMode === 'online' && !hasSyncedData) {
      alert('No synced offline data found. Please sync your catalog first from Settings -> Data Sync.');
      return;
    }
    await toggleDataMode();
  };

  const handleLogout = () => {
    logout();
    setShowProfileMenu(false);
  };

  const closeAll = () => {
    setMobileMenuOpen(false);
    setShowProfileMenu(false);
  };

  // nav links shared between hamburger & desktop
  const navLinks = [
    { href: '/catalogue', label: 'Home', icon: Home },
    { href: '/gallery', label: 'Gallery', icon: BookOpen },
    { href: '/view', label: 'Products', icon: Grid },
  ];

  const profileLinks = [
    { href: '/settings/wishlist', label: 'My Wishlist', icon: Heart, iconClass: 'text-red-500 fill-red-500' },
    { href: '/settings/shops', label: 'My Shops', icon: Store, iconClass: '' },
    { href: '/settings/invoices', label: 'My Invoices', icon: FileText, iconClass: '' },
    { href: '/settings/sync', label: 'Data Sync & Storage', icon: RefreshCw, iconClass: 'text-emerald-600' },
    { href: '/settings/security', label: 'Security Settings', icon: ShieldCheck, iconClass: '' },
  ];

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
            {/* Cart */}
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Link href="/cart">
                <div className="relative p-2.5 hover:bg-secondary rounded-2xl transition-colors cursor-pointer group" title="Shopping Cart">
                  <CartIcon size={24} className="text-foreground group-hover:text-accent transition-colors" />
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
            {user && (
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
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                </motion.button>

                <AnimatePresence>
                  {showProfileMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -15, scale: 0.95 }}
                      className="absolute right-0 mt-4 w-72 bg-white/95 backdrop-blur-2xl border border-white/80 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.2)] p-6 space-y-3 z-50 overflow-hidden"
                    >
                      <div className="pb-3 border-b border-gray-200/60">
                        <p className="text-base font-black text-[#0f172a] uppercase">{user.name}</p>
                        <p className="text-xs text-gray-500 font-bold truncate mt-0.5">{user.email}</p>
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

                      {/* Data Mode Switch Button */}
                      <button
                        onClick={handleDataModeToggle}
                        className={`w-full flex items-center justify-between px-5 py-3.5 font-black text-xs uppercase tracking-wider rounded-full transition-all border shadow-xs cursor-pointer ${dataMode === 'offline'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100'
                          }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {dataMode === 'offline' ? (
                            <Database size={18} className="text-emerald-600" />
                          ) : (
                            <Wifi size={18} className="text-blue-600" />
                          )}
                          <span>Mode: {dataMode.toUpperCase()}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-mono ${dataMode === 'offline' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'}`}>
                          {dataMode === 'offline' ? 'Offline' : 'Online'}
                        </span>
                      </button>

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
                      className="absolute right-0 mt-4 w-72 bg-white/95 backdrop-blur-2xl border border-white/80 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.2)] p-6 z-50 space-y-3 overflow-hidden"
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
                      {user && (
                        <>
                          <div className="pt-1 border-t border-gray-200/60">
                            <p className="text-[0.6rem] font-black text-gray-400 uppercase tracking-widest px-1 mb-3 mt-2">Account</p>
                            <div className="pb-2 px-1">
                              <p className="text-sm font-black text-[#0f172a] uppercase leading-tight">{user.name}</p>
                              <p className="text-xs text-gray-500 font-bold truncate">{user.email}</p>
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

                          {/* Data Mode Switch Button in Hamburger */}
                          <button
                            onClick={() => { closeAll(); handleDataModeToggle(); }}
                            className={`w-full flex items-center justify-between px-5 py-3.5 font-black text-xs uppercase tracking-wider rounded-full transition-all border shadow-xs cursor-pointer ${dataMode === 'offline'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-blue-50 text-blue-900 border-blue-200'
                              }`}
                          >
                            <div className="flex items-center gap-2.5">
                              {dataMode === 'offline' ? (
                                <Database size={18} className="text-emerald-600" />
                              ) : (
                                <Wifi size={18} className="text-blue-600" />
                              )}
                              <span>Mode: {dataMode.toUpperCase()}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-mono ${dataMode === 'offline' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'}`}>
                              {dataMode === 'offline' ? 'Offline' : 'Online'}
                            </span>
                          </button>

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
                            onClick={() => { closeAll(); logout(); }}
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
