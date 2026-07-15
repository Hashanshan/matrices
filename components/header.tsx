'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useCart } from '@/lib/contexts/cart-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Menu, X, ShoppingCart as CartIcon, LogOut, User } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

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
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-lg border-b border-border shadow-lg">
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
                src="/matrices-neon-logo.png"
                alt="Matrices"
                fill
                className="object-contain hover:opacity-90 transition-opacity"
                priority
              />
            </motion.div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden lg:flex gap-8 flex-1 justify-center">
            {[
              { href: '/', label: 'Gallery View' },
              { href: '/view', label: 'Product View' },
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
                  className="w-full px-4 py-3 bg-secondary border-2 border-border rounded-xl focus:outline-none focus:ring-0 focus:border-accent text-foreground placeholder-muted-foreground font-medium transition-all"
                />
              </motion.div>
            </div>
          )}

          {/* Right Section */}
          <div className="flex items-center gap-3 md:gap-6">
            {/* Cart Button */}
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Link href="/cart">
                <div className="relative p-2 hover:bg-secondary rounded-xl transition-colors cursor-pointer group">
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

            {/* User Menu */}
            {user && (
              <div className="relative hidden md:block">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="p-2 hover:bg-secondary rounded-xl transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent/60 rounded-lg flex items-center justify-center text-white font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                </motion.button>

                {/* Desktop Profile Dropdown */}
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -15, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-64 bg-card border-2 border-border rounded-2xl shadow-2xl p-6 space-y-4"
                  >
                    <div className="pb-4 border-b border-border">
                      <p className="text-base font-bold text-foreground">{user.name}</p>
                      <p className="text-sm text-accent font-medium">{user.email}</p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive text-white font-bold py-3 rounded-xl transition-all"
                    >
                      <LogOut size={18} />
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
              className="md:hidden p-2 hover:bg-secondary rounded-xl transition-colors"
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
                className="w-full px-4 py-3 bg-secondary border-2 border-border rounded-xl focus:outline-none focus:border-accent text-foreground"
              />
            </div>
          )}

          {/* Navigation */}
          <nav className="p-4 space-y-2 border-b border-border">
            {[
              { href: '/', label: 'Gallery View' },
              { href: '/view', label: 'Product View' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-3 text-foreground font-bold hover:bg-secondary rounded-xl transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* User Info */}
          {user && (
            <div className="p-4 space-y-4">
              <div className="p-4 bg-secondary rounded-xl">
                <p className="font-bold text-foreground text-lg">{user.name}</p>
                <p className="text-sm text-accent font-medium">{user.email}</p>
                <p className="text-xs text-muted-foreground mt-1">{user.phone}</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 bg-destructive hover:bg-destructive/90 text-white font-bold py-3 rounded-xl transition-all"
              >
                <LogOut size={18} />
                Logout
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>
    </header>
  );
}
