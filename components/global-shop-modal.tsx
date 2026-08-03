'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Search, X, Check, Lock, MapPin, Phone, Loader2 } from 'lucide-react';
import { offlineDB } from '@/lib/offline/indexed-db';
import { resolveApiUrl, getAuthToken } from '@/lib/utils';
import { useAuth } from '@/lib/contexts/auth-context';
import useSWR from 'swr';

export interface ShopOption {
  shopId: string;
  name: string;
  phone?: string;
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

  // ALWAYS require PIN verification every time the modal opens (No bypass!)
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setPinVerified(false);
      setPinError('');
      setIsVerifying(false);
      setSearchQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    async function mergeShops() {
      if (!shopsData) return;
      const dbShops = await offlineDB.getAll<any>('shops').catch(() => []);
      const apiShops: ShopOption[] = shopsData?.shops || [];
      const shopMap = new Map<string, ShopOption>();

      dbShops.forEach((s: any) => {
        const id = s.shopId || s.id;
        if (id) {
          shopMap.set(id, {
            shopId: id,
            name: s.name || 'Unnamed Shop',
            phone: s.phone || '',
            address: s.address || '',
          });
        }
      });

      apiShops.forEach((s: any) => {
        if (s.shopId) {
          shopMap.set(s.shopId, {
            shopId: s.shopId,
            name: s.name || 'Unnamed Shop',
            phone: s.phone || '',
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
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.shopId || '').toLowerCase().includes(q) ||
      (s.address || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q)
    );
  });

  // Verify PIN with Live API (with offline fallback in AuthContext)
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanPin = pin.trim();
    if (!cleanPin) {
      setPinError('Please enter your PIN');
      return;
    }

    setIsVerifying(true);
    setPinError('');

    try {
      // 1. Call verifyPin from auth-context (checks live backend API & offline hash fallback!)
      const result = await verifyPin({ pin: cleanPin });

      if (result.success) {
        setPinVerified(true);
        setPinError('');
      } else {
        setPinError(result.msg || 'Invalid Security PIN. Please try again.');
      }
    } catch (err) {
      console.error('PIN verification error:', err);
      setPinError('Failed to verify PIN. Please try again.');
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-[2rem] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 cursor-default"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#0f172a] text-white rounded-xl">
                <Store size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#0f172a] uppercase tracking-tight">
                  SELECT CUSTOMER SHOP
                </h3>
                <p className="text-xs font-bold text-gray-400">
                  Verify PIN to select or change customer shop
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* VIEW 1: MANDATORY SECURITY PIN VERIFICATION (Asked every time!) */}
          {!pinVerified ? (
            <form onSubmit={handlePinSubmit} className="space-y-4 py-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                  <Lock size={24} />
                </div>
                <h4 className="text-base font-black text-[#0f172a] uppercase">VERIFY SECURITY PIN</h4>
                <p className="text-xs font-bold text-gray-500 max-w-xs mx-auto">
                  Enter your Sales Representative PIN to proceed with shop selection. Verified via Live API.
                </p>
              </div>

              <div className="space-y-2 max-w-xs mx-auto">
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter Security PIN"
                  disabled={isVerifying}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-2xl p-3.5 text-center text-lg font-black tracking-widest text-[#0f172a] focus:outline-none focus:border-[#0f172a] disabled:opacity-50"
                  autoFocus
                />
                {pinError && <p className="text-xs font-bold text-red-500 text-center">{pinError}</p>}
              </div>

              <div className="flex justify-center pt-2">
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full max-w-xs bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase tracking-wider py-3.5 rounded-full shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> VERIFYING LIVE PIN...
                    </>
                  ) : (
                    'VERIFY & SELECT SHOP'
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* VIEW 2: SHOP SELECTION LIST */
            <div className="space-y-4 flex-1 flex flex-col min-h-0">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shops by name or ID..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                  autoFocus
                />
              </div>

              {/* Shops Cards Container */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[380px]">
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
                            : 'bg-white border-slate-200 hover:border-[#0f172a] hover:bg-slate-50/80 text-[#0f172a]'
                        }`}
                      >
                        <div className="space-y-1">
                          <h4 className="text-sm font-black uppercase">{shop.name}</h4>
                          <div className="flex items-center gap-3 text-xs font-bold opacity-80">
                            <span className="font-mono">ID: {shop.shopId}</span>
                            {shop.phone && (
                              <span className="flex items-center gap-1">
                                <Phone size={12} /> {shop.phone}
                              </span>
                            )}
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
