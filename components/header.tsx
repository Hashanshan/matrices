'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useCart } from '@/lib/contexts/cart-context';
import { useSync } from '@/lib/contexts/sync-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Menu, X, ShoppingCart as CartIcon, LogOut, User, Settings, Heart, ShieldCheck, Store, FileText, RefreshCw, Home, BookOpen, Grid } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

import SyncButton from '@/components/mobile/sync-button';

interface HeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
}

export default function Header({ searchQuery = '', onSearchChange, showSearch = true }: HeaderProps) {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const { triggerSync } = useSync();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleLogout = () => {
    logout();
    setShowProfileMenu(false);
  };

  return (
    <header className="sticky top-0 z-50  backdrop-blur-2xl border-b border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Header */}
        <div className="flex items-center justify-between h-20 gap-6">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 group">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="relative h-14 w-40"
            >
              <Image
                src="/matrices_logo.png"
                alt="Matrices"
                fill
                className="object-contain hover:opacity-90 transition-opacity"
                priority
              />
            </motion.div>
          </Link>

          {/* Navigation Links (strictly Home, Gallery, Products, Cart) */}
          <nav className="hidden lg:flex gap-8 flex-1 justify-center">
            {[
              { href: '/catalogue', label: 'Home' },
              { href: '/gallery', label: 'Gallery' },
              { href: '/view', label: 'Products' },
              { href: '/cart', label: 'Cart' },
            ].map((link) => (
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

          {/* Search Bar - Desktop */}
          {showSearch && (
            <div className="hidden md:flex flex-1 max-w-sm">
              <motion.div
                whileFocus={{ scale: 1.02 }}
                className="w-full"
              >
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

          {/* Right Section */}
          <div className="flex items-center gap-3 md:gap-6">
            {/* Cart Button */}
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

            {/* User Profile & Settings Menu */}
            {/* User Profile & Settings Menu */}
            {user && (
              <div className="relative">
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

                {/* Profile Dropdown Popup Card (Image 2 & 3 Design) */}
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

                    <Link
                      href="/settings/wishlist"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider text-[#0f172a] bg-white hover:bg-gray-50 border border-gray-100 rounded-full transition-all shadow-xs"
                    >
                      <Heart size={18} fill="#ef4444" className="text-red-500" />
                      My Wishlist
                    </Link>

                    <Link
                      href="/settings/shops"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider text-[#0f172a] bg-white hover:bg-gray-50 border border-gray-100 rounded-full transition-all shadow-xs"
                    >
                      <Store size={18} />
                      My Shops
                    </Link>

                    <Link
                      href="/settings/orders"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider text-[#0f172a] bg-white hover:bg-gray-50 border border-gray-100 rounded-full transition-all shadow-xs"
                    >
                      <FileText size={18} />
                      My Orders
                    </Link>

                    <Link
                      href="/settings/security"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider text-[#0f172a] bg-white hover:bg-gray-50 border border-gray-100 rounded-full transition-all shadow-xs"
                    >
                      <ShieldCheck size={18} />
                      Security Settings
                    </Link>

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        triggerSync();
                      }}
                      className="w-full flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-full transition-all shadow-xs cursor-pointer"
                    >
                      <RefreshCw size={18} className="text-emerald-600 animate-spin-hover" />
                      Sync
                    </button>

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
              </div>
            )}

            {/* Mobile Hamburger Menu Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setMobileMenuOpen(!mobileMenuOpen);
                setShowProfileMenu(false);
              }}
              className="lg:hidden p-2.5 bg-[#0f172a] text-white hover:bg-[#1e293b] rounded-full shadow-md transition-all flex items-center justify-center cursor-pointer active:scale-90"
              title="Toggle Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </motion.button>
          </div>
        </div>

        {/* Hamburger Mobile Menu Drawer (Main site nav strictly: Home, Gallery, Products) */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: mobileMenuOpen ? 1 : 0, height: mobileMenuOpen ? 'auto' : 0 }}
          exit={{ opacity: 0, height: 0 }}
          className="lg:hidden overflow-hidden border-t border-white/60 bg-white/95 backdrop-blur-2xl shadow-2xl rounded-b-[2.5rem]"
        >
          {/* Mobile Search Input */}
          {showSearch && (
            <div className="p-4 border-b border-gray-200/60">
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#0f172a] font-bold text-xs uppercase shadow-inner"
              />
            </div>
          )}

          <div className="p-5 space-y-3">
            <h3 className="text-[0.65rem] font-black text-gray-400 uppercase tracking-widest px-2">NAVIGATION</h3>
            <div className="grid grid-cols-1 gap-2.5">
              {[
                { href: '/catalogue', label: 'HOME', icon: Home },
                { href: '/gallery', label: 'GALLERY', icon: BookOpen },
                { href: '/view', label: 'PRODUCTS', icon: Grid },
              ].map((item) => {
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-5 py-3.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl font-black text-xs text-[#0f172a] uppercase shadow-xs transition-all active:scale-95"
                  >
                    <ItemIcon size={18} className="text-[#0f172a]" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </header>
  );
}
