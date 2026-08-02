'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useCart } from '@/lib/contexts/cart-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Menu, X, ShoppingCart as CartIcon, LogOut, User, Settings, Heart, ShieldCheck, Store, FileText } from 'lucide-react';
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
            {user && (
              <div className="relative hidden md:block ">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="p-2 hover:bg-secondary rounded-full transition-colors"
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-accent to-accent/60 rounded-full flex items-center justify-center text-white font-black text-sm shadow-md">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                </motion.button>

                {/* Desktop Profile Dropdown (iPad Glassmorphism Pill Design) */}
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -15, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-72 bg-white backdrop-blur-2xl border border-white/80 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.18)] p-6 space-y-3 z-50 overflow-hidden"
                  >
                    <div className="pb-3 border-b border-gray-200/60">
                      <p className="text-base font-black text-[#0f172a] uppercase">{user.name}</p>
                      <p className="text-xs text-gray-500 font-bold truncate mt-0.5">{user.email}</p>
                    </div>

                    <Link
                      href="/settings/wishlist"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider text-[#0f172a] bg-white/60 hover:bg-white border border-white/60 rounded-full transition-all shadow-sm"
                    >
                      <Heart size={18} fill="#ef4444" className="text-red-500" />
                      My Wishlist
                    </Link>

                    <Link
                      href="/settings/shops"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider text-[#0f172a] bg-white/60 hover:bg-white border border-white/60 rounded-full transition-all shadow-sm"
                    >
                      <Store size={18} />
                      My Shops
                    </Link>

                    <Link
                      href="/settings/orders"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider text-[#0f172a] bg-white/60 hover:bg-white border border-white/60 rounded-full transition-all shadow-sm"
                    >
                      <FileText size={18} />
                      My Orders
                    </Link>

                    <Link
                      href="/settings/security"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider text-[#0f172a] bg-white/60 hover:bg-white border border-white/60 rounded-full transition-all shadow-sm"
                    >
                      <ShieldCheck size={18} />
                      Security Settings
                    </Link>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-black py-4 rounded-full transition-all uppercase text-xs tracking-wider shadow-lg shadow-red-500/20"
                    >
                      <LogOut size={16} />
                      Logout
                    </motion.button>
                  </motion.div>
                )}
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 hover:bg-secondary rounded-2xl transition-colors"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </motion.button>
          </div>
        </div>

        {/* Mobile Menu */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: mobileMenuOpen ? 1 : 0, height: mobileMenuOpen ? 'auto' : 0 }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden overflow-hidden border-t border-border"
        >
          {/* Search Bar - Mobile */}
          {showSearch && (
            <div className="p-4 border-b border-border">
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="w-full px-4 py-3 bg-secondary border-2 border-border rounded-2xl focus:outline-none focus:border-accent text-foreground"
              />
            </div>
          )}

          {/* Navigation (strictly Home, Gallery, Products, Cart) */}
          <nav className="p-4 space-y-2 border-b border-border">
            {[
              { href: '/catalogue', label: 'Home' },
              { href: '/gallery', label: 'Gallery' },
              { href: '/view', label: 'Products' },
              { href: '/cart', label: `Cart (${cart.itemCount})` },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-3 text-foreground font-bold hover:bg-secondary rounded-2xl transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* User Info & Settings Links */}
          {user && (
            <div className="p-4 space-y-3">
              <div className="p-5 bg-white/60 backdrop-blur-xl border border-white/60 rounded-[2rem] shadow-sm">
                <p className="font-black text-[#0f172a] uppercase text-base">{user.name}</p>
                <p className="text-xs text-gray-500 font-bold mt-0.5">{user.email}</p>
              </div>

              <Link
                href="/settings/wishlist"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider bg-white/60 hover:bg-white text-[#0f172a] border border-white/60 rounded-full transition-all shadow-sm"
              >
                <Heart size={18} fill="#ef4444" className="text-red-500" />
                My Wishlist
              </Link>

              <Link
                href="/settings/shops"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider bg-white/60 hover:bg-white text-[#0f172a] border border-white/60 rounded-full transition-all shadow-sm"
              >
                <Store size={18} />
                My Shops
              </Link>

              <Link
                href="/settings/orders"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider bg-white/60 hover:bg-white text-[#0f172a] border border-white/60 rounded-full transition-all shadow-sm"
              >
                <FileText size={18} />
                My Orders
              </Link>

              <Link
                href="/settings/security"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-5 py-3.5 font-black text-xs uppercase tracking-wider bg-white/60 hover:bg-white text-[#0f172a] border border-white/60 rounded-full transition-all shadow-sm"
              >
                <ShieldCheck size={18} />
                Security Settings
              </Link>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-black py-4 rounded-full transition-all uppercase text-xs tracking-wider shadow-md"
              >
                <LogOut size={16} />
                Logout
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>
    </header>
  );
}
