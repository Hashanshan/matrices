'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Search, X, Check, Lock, MapPin, Phone, ShieldCheck, Delete, ArrowRight, Mail } from 'lucide-react';
import { offlineDB } from '@/lib/offline/indexed-db';
import { resolveApiUrl, getAuthToken } from '@/lib/utils';
import { useAuth } from '@/lib/contexts/auth-context';
import useSWR from 'swr';

export interface ShopOption {
  shopId: string;
  name: string;
  email?: string;
  phone?: string;
  phones?: string[];
  address?: string;
}

interface GlobalShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectShop: (shop: ShopOption) => void;
  currentShop?: ShopOption | null;
}

const shopsFetcher = async (url: string) => {
  const mode = typeof window !== 'undefined' ? (localStorage.getItem('matrices_data_mode') as string) : 'online';
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const getOfflineShops = async () => {
    const rawShops = await offlineDB.getAll<any>('shops').catch(() => []);
    return { success: true, shops: rawShops };
  };

  if (mode === 'offline' || isOffline) {
    return await getOfflineShops();
  }

  const token = getAuthToken();
  const targetUrl = resolveApiUrl(url);
  try {
    const res = await fetch(targetUrl, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error('Failed to fetch shops');
    return res.json();
  } catch {
    return await getOfflineShops();
  }
};

export default function GlobalShopModal({
  isOpen,
  onClose,
  onSelectShop,
  currentShop,
}: GlobalShopModalProps) {
  const { verifyPin } = useAuth();

  const [pin, setPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [allShops, setAllShops] = useState<ShopOption[]>([]);

  // Fetch shops
  const { data: shopsData, isLoading } = useSWR(
    isOpen ? '/api/shops?limit=100' : null,
    shopsFetcher
  );

  // ALWAYS require PIN verification every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setPinVerified(false);
      setPinError('');
      setIsVerifying(false);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Physical keyboard listener for PIN entry
  useEffect(() => {
    if (!isOpen || pinVerified) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pinVerified, pin]);

  // Merge IndexedDB & API Shops
  useEffect(() => {
    async function mergeShops() {
      const dbShops = await offlineDB.getAll<any>('shops').catch(() => []);
      const apiShops: any[] = shopsData?.shops || [];
      const shopMap = new Map<string, ShopOption>();

      dbShops.forEach((s: any) => {
        const id = s.shopId || s.id;
        if (id) {
          const pList = Array.isArray(s.phones) && s.phones.length > 0 ? s.phones : (s.phone ? s.phone.split(',').map((p: string) => p.trim()).filter(Boolean) : []);
          shopMap.set(id, {
            shopId: id,
            name: s.name || 'Unnamed Shop',
            email: s.email || '',
            phone: s.phone || (pList[0] || ''),
            phones: pList,
            address: s.address || '',
          });
        }
      });

      apiShops.forEach((s: any) => {
        if (s.shopId) {
          const pList = Array.isArray(s.phones) && s.phones.length > 0 ? s.phones : (s.phone ? s.phone.split(',').map((p: string) => p.trim()).filter(Boolean) : []);
          shopMap.set(s.shopId, {
            shopId: s.shopId,
            name: s.name || 'Unnamed Shop',
            email: s.email || '',
            phone: s.phone || (pList[0] || ''),
            phones: pList,
            address: s.address || '',
          });
        }
      });

      setAllShops(Array.from(shopMap.values()));
    }

    mergeShops();
  }, [shopsData]);

  const filteredShops = allShops.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const phoneMatch = (s.phone || '').toLowerCase().includes(q) ||
      (Array.isArray(s.phones) && s.phones.some((p) => p.toLowerCase().includes(q)));
    const emailMatch = (s.email || '').toLowerCase().includes(q);
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.shopId || '').toLowerCase().includes(q) ||
      (s.address || '').toLowerCase().includes(q) ||
      emailMatch ||
      phoneMatch
    );
  });

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setPinError('');

      if (nextPin.length === 4) {
        submitPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setPinError('');
  };

  const handleClear = () => {
    setPin('');
    setPinError('');
  };

  const submitPin = async (submittedPin: string) => {
    if (!submittedPin || submittedPin.length < 4) return;

    setIsVerifying(true);
    setPinError('');

    try {
      const result = await verifyPin({ pin: submittedPin });

      if (result.success) {
        setPinVerified(true);
        setPinError('');
      } else {
        setPinError(result.msg || 'Incorrect Security PIN');
        setPin('');
      }
    } catch (err) {
      console.error('PIN verification error:', err);
      setPinError('Failed to verify PIN. Please try again.');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleShopSelect = (shop: ShopOption) => {
    onSelectShop(shop);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md max-h-[95vh] bg-white/40 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 border border-white/60 shadow-[0_25px_70px_rgba(0,0,0,0.25)] flex flex-col overflow-y-auto scrollbar-hide cursor-default"
        >
          {/* Close Button - iPad Style Pill */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2.5 text-gray-600 hover:text-[#0f172a] hover:bg-white/60 rounded-full transition-all shadow-sm border border-white/40 cursor-pointer z-10"
          >
            <X size={18} />
          </button>

          {/* STEP 1: iPad-STYLE NUMERIC KEYPAD PIN VERIFICATION (EXACT SAME COLORS & GLASSMORPHISM AS SETTINGS PINMODAL!) */}
          {!pinVerified ? (
            <div className="space-y-4 py-2 my-auto">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-[#0f172a] text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-950/20 border border-white/20">
                  <ShieldCheck size={32} />
                </div>
                <h2 className="text-2xl font-black text-[#0f172a] uppercase tracking-wide">
                  SECURITY PIN REQUIRED
                </h2>
                <p className="text-xs text-gray-600 font-bold tracking-wider uppercase mt-1">
                  ENTER YOUR 4-DIGIT PIN TO SELECT CUSTOMER SHOP
                </p>
              </div>

              {/* Error Message */}
              {pinError && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs font-black text-red-500 mb-4 uppercase">
                  {pinError}
                </motion.p>
              )}

              {/* 4 Circular Digit Indicators */}
              <div className="flex justify-center items-center gap-4 mb-6">
                {[0, 1, 2, 3].map((index) => {
                  const isFilled = index < pin.length;
                  return (
                    <motion.div
                      key={index}
                      animate={{ scale: isFilled ? 1.15 : 1 }}
                      className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all shadow-sm ${
                        pinError
                          ? 'border-red-500 bg-red-50 text-red-500'
                          : isFilled
                          ? 'border-[#0f172a] bg-[#0f172a] text-white shadow-md'
                          : 'border-gray-300/80 bg-white/60'
                      }`}
                    >
                      {isFilled ? <Lock size={16} /> : null}
                    </motion.div>
                  );
                })}
              </div>

              {/* iPad Circular Numeric Keypad Grid */}
              <div className="grid grid-cols-3 gap-4 max-w-[260px] mx-auto mb-6">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleDigit(num)}
                    disabled={isVerifying}
                    className="w-16 h-16 rounded-full bg-white/70 hover:bg-white text-[#0f172a] font-extrabold text-2xl border border-white/80 shadow-md active:scale-90 transition-all disabled:opacity-50 flex items-center justify-center mx-auto cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isVerifying || pin.length === 0}
                  className="w-16 h-16 rounded-full bg-white/40 hover:bg-white text-gray-700 font-bold text-xs uppercase border border-white/60 disabled:opacity-30 transition-all flex items-center justify-center mx-auto shadow-sm cursor-pointer"
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('0')}
                  disabled={isVerifying}
                  className="w-16 h-16 rounded-full bg-white/70 hover:bg-white text-[#0f172a] font-extrabold text-2xl border border-white/80 shadow-md active:scale-90 transition-all disabled:opacity-50 flex items-center justify-center mx-auto cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  disabled={isVerifying || pin.length === 0}
                  className="w-16 h-16 rounded-full bg-white/40 hover:bg-white text-[#0f172a] flex items-center justify-center border border-white/60 disabled:opacity-30 transition-all mx-auto shadow-sm cursor-pointer"
                >
                  <Delete size={20} />
                </button>
              </div>

              {/* Submit Verify Button */}
              <button
                type="button"
                onClick={() => submitPin(pin)}
                disabled={pin.length < 4 || isVerifying}
                className="w-full bg-[#0f172a] text-white py-4 rounded-full font-black text-sm uppercase tracking-wider hover:bg-[#1e293b] disabled:opacity-40 transition-all shadow-xl flex items-center justify-center gap-2 mb-3 cursor-pointer active:scale-95"
              >
                {isVerifying ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    VERIFY PIN & CHOOSE SHOP <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          ) : (
            /* STEP 2: CUSTOMER SHOP SELECTION LIST */
            <div className="space-y-4 flex-1 flex flex-col min-h-0 pt-2">
              <div className="flex items-center gap-3 pb-2 border-b border-gray-200/60">
                <div className="p-2.5 bg-[#0f172a] text-white rounded-2xl shadow-md">
                  <Store size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0f172a] uppercase tracking-tight">
                    SELECT CUSTOMER SHOP
                  </h3>
                  <p className="text-[11px] font-bold text-gray-500 uppercase">
                    PIN Verified. Choose shop for cart session.
                  </p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="SEARCH SHOPS BY NAME OR ID..."
                  className="w-full pl-11 pr-4 py-3 bg-white/70 backdrop-blur-xl border border-white/80 rounded-full text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 uppercase shadow-xs"
                  autoFocus
                />
              </div>

              {/* Shops Cards Container */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[360px]">
                {isLoading ? (
                  <div className="py-12 text-center text-xs font-bold text-gray-400 uppercase animate-pulse">
                    Loading assigned shops...
                  </div>
                ) : filteredShops.length === 0 ? (
                  <div className="py-12 text-center text-xs font-bold text-gray-400 uppercase">
                    No assigned shops found
                  </div>
                ) : (
                  filteredShops.map((shop) => {
                    const isSelected = currentShop?.shopId === shop.shopId;
                    return (
                      <div
                        key={shop.shopId}
                        onClick={() => handleShopSelect(shop)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#0f172a] text-white border-[#0f172a] shadow-md'
                            : 'bg-white/80 border-white/90 hover:border-[#0f172a] hover:bg-white text-[#0f172a] shadow-xs'
                        }`}
                      >
                        <div className="space-y-1">
                          <h4 className="text-sm font-black uppercase">{shop.name}</h4>
                          <div className="flex flex-wrap items-center gap-3 text-xs font-bold opacity-80">
                            <span className="font-mono">ID: {shop.shopId}</span>
                            {shop.email && (
                              <span className="flex items-center gap-1">
                                <Mail size={12} /> {shop.email}
                              </span>
                            )}
                            {(() => {
                              const pList = Array.isArray(shop.phones) && shop.phones.length > 0
                                ? shop.phones
                                : (shop.phone ? [shop.phone] : []);
                              if (pList.length === 0) return null;
                              return (
                                <span className="flex items-center gap-1">
                                  <Phone size={12} /> {pList.join(' • ')}
                                </span>
                              );
                            })()}
                          </div>
                          {shop.address && (
                            <p className="text-[11px] opacity-70 truncate max-w-xs font-medium flex items-center gap-1">
                              <MapPin size={11} /> {shop.address}
                            </p>
                          )}
                        </div>

                        {isSelected ? (
                          <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center">
                            <Check size={16} />
                          </div>
                        ) : (
                          <span className="text-xs font-black uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                            SELECT
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
