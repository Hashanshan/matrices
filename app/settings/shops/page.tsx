'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { useAuth } from '@/lib/contexts/auth-context';
import PinModal from '@/components/pin-modal';
import Pagination from '@/components/pagination';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Phone, MapPin, Edit, ShieldCheck, Heart, Search, Lock, X, Check, ShoppingBag, DollarSign, CreditCard, Clock, Eye } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { formatPrice } from '@/lib/currency';

interface Shop {
  shopId: string;
  name: string;
  phone: string;
  address: string;
  deliveredOrders: number;
  pendingOrders: number;
  totalSales: number;
  chequeCount: number;
  chequeValue: number;
  currentCredit: number;
}

const fetcher = async (url: string) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ msg: 'Failed to fetch shops' }));
    throw new Error(error.msg || 'Failed to fetch');
  }
  return res.json();
};

export default function SettingsShopsPage() {
  const { isPinVerified, resetPinVerification } = useAuth();
  const [showPinModal, setShowPinModal] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', address: '' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const swrKey = `/api/shops?searchQuery=${encodeURIComponent(searchQuery)}&page=${page}&limit=9&sortField=updatedAt&sortOrder=-1`;
  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
  });

  const shops: Shop[] = data?.shops || [];
  const totalPages: number = data?.totalPages || 1;
  const totalRecords: number = data?.totalRecords || shops.length;

  // Reset page to 1 on search change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
  };

  // Require Security PIN verification on visit
  useEffect(() => {
    resetPinVerification();
  }, []);

  useEffect(() => {
    setShowPinModal(!isPinVerified);
  }, [isPinVerified]);

  const handleEditClick = (shop: Shop) => {
    setEditingShop(shop);
    setEditForm({
      name: shop.name,
      phone: shop.phone,
      address: shop.address
    });
    setUpdateMsg(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;

    setIsUpdating(true);
    setUpdateMsg(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`/api/shops/update/${editingShop.shopId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(editForm),
      });

      const resData = await res.json();
      setIsUpdating(false);

      if (res.ok && resData.success) {
        setUpdateMsg({ type: 'success', text: 'Shop updated successfully!' });
        mutate();
        setTimeout(() => {
          setEditingShop(null);
          setUpdateMsg(null);
        }, 1200);
      } else {
        setUpdateMsg({ type: 'error', text: resData.msg || 'Failed to update shop' });
      }
    } catch (err: any) {
      setIsUpdating(false);
      setUpdateMsg({ type: 'error', text: err.message || 'Error updating shop' });
    }
  };

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-[url('/bg.png')] bg-cover bg-center bg-no-repeat bg-fixed py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Security PIN Gate Modal */}
          <PinModal
            isOpen={showPinModal}
            onClose={() => {
              if (!isPinVerified) {
                window.location.href = '/catalogue';
              } else {
                setShowPinModal(false);
              }
            }}
            onSuccess={() => setShowPinModal(false)}
          />

          {!isPinVerified ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-20 h-20 bg-[#0f172a] text-white rounded-full flex items-center justify-center mb-4 shadow-xl border border-white/20">
                <Lock size={36} />
              </div>
              <h2 className="text-2xl font-black text-[#0f172a] uppercase mb-2">SHOP SETTINGS ARE LOCKED</h2>
              <p className="text-gray-500 font-bold max-w-sm mb-6 uppercase text-xs">
                PLEASE ENTER YOUR 4-DIGIT SECURITY PIN TO ACCESS YOUR ASSIGNED SHOPS.
              </p>
              <button
                onClick={() => setShowPinModal(true)}
                className="bg-[#0f172a] text-white px-8 py-4 rounded-full font-black text-sm uppercase tracking-wider hover:bg-[#1e293b] shadow-xl transition-all"
              >
                ENTER SECURITY PIN
              </button>
            </div>
          ) : (
            <>
              {/* Header Title Section */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3.5 bg-[#0f172a]/10 border border-[#0f172a]/20 rounded-full text-[#0f172a] shadow-sm flex items-center justify-center">
                    <Store size={32} />
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-[#0f172a] uppercase tracking-wide">
                      MY SHOPS
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 font-bold tracking-wide mt-1 uppercase">
                      VIEW AND MANAGE DETAILS FOR YOUR ASSIGNED SHOPS
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href="/settings/wishlist"
                    className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-5 py-3.5 rounded-full shadow-md transition-all flex items-center gap-2"
                  >
                    <Heart size={16} fill="#ef4444" className="text-red-500" /> WISHLIST
                  </Link>
                  <Link
                    href="/settings/security"
                    className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-5 py-3.5 rounded-full shadow-md transition-all flex items-center gap-2"
                  >
                    <ShieldCheck size={16} /> SECURITY
                  </Link>
                  <span className="text-xs font-black text-white bg-[#0f172a] px-6 py-3.5 rounded-full shadow-lg uppercase">
                    {totalRecords} {totalRecords === 1 ? 'SHOP' : 'SHOPS'}
                  </span>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mb-8 flex items-center justify-between gap-4">
                <div className="relative max-w-md w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    placeholder="SEARCH SHOPS BY NAME, ID, PHONE, ADDRESS..."
                    className="w-full pl-11 pr-4 py-3.5 bg-white/50 backdrop-blur-xl border border-white/60 rounded-full text-xs font-bold text-[#0f172a] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/30 shadow-sm uppercase"
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center items-center py-32">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
                </div>
              ) : shops.length === 0 ? (
                <div className="text-center py-20 bg-white/20 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 shadow-lg">
                  <div className="w-20 h-20 bg-gray-100/50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-600">
                    <Store size={36} />
                  </div>
                  <h2 className="text-2xl font-black text-[#0f172a] uppercase mb-2">
                    {searchQuery ? 'NO MATCHING SHOPS FOUND' : 'NO ACCESSIBLE SHOPS ASSIGNED'}
                  </h2>
                  <p className="text-gray-500 font-semibold mb-6 max-w-md mx-auto uppercase text-xs">
                    {searchQuery
                      ? 'TRY A DIFFERENT SEARCH TERM TO FIND ASSIGNED SHOPS.'
                      : 'YOU CURRENTLY DO NOT HAVE ANY ACTIVE SHOPS ASSIGNED TO YOUR SALESREP ACCOUNT.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {shops.map((shop) => (
                      <motion.div
                        key={shop.shopId}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.06)] flex flex-col justify-between group hover:border-white/90 transition-all"
                      >
                        <div>
                          {/* Header Badge & Title */}
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="min-w-0">
                              <span className="text-[0.65rem] font-black text-[#0f172a] tracking-widest uppercase bg-white/60 border border-white/80 px-3 py-1 rounded-full inline-block mb-2 shadow-xs">
                                {shop.shopId}
                              </span>
                              <h3 className="font-extrabold text-[#0f172a] text-xl uppercase leading-tight truncate">
                                {shop.name}
                              </h3>
                            </div>
                            <button
                              onClick={() => handleEditClick(shop)}
                              className="p-3 bg-white/70 hover:bg-white text-[#0f172a] rounded-full transition-all border border-white/60 shadow-sm flex-shrink-0 cursor-pointer"
                              title="Edit Shop Details"
                            >
                              <Edit size={16} />
                            </button>
                          </div>

                          {/* Contact & Location Info */}
                          <div className="space-y-2 mb-5">
                            <a
                              href={`tel:${shop.phone}`}
                              className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-[#0f172a] uppercase transition-colors"
                            >
                              <Phone size={14} className="text-gray-500 flex-shrink-0" />
                              <span>{shop.phone}</span>
                            </a>
                            <div className="flex items-start gap-2 text-xs font-bold text-gray-600 uppercase">
                              <MapPin size={14} className="text-gray-500 flex-shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{shop.address}</span>
                            </div>
                          </div>

                          {/* Metrics Grid */}
                          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-gray-200/60 text-xs">
                            <div className="p-3 bg-white/40 rounded-2xl border border-white/40">
                              <p className="text-[0.65rem] text-gray-500 font-bold uppercase flex items-center gap-1">
                                <ShoppingBag size={12} /> Total Sales
                              </p>
                              <p className="font-black text-[#0f172a] text-sm mt-0.5">{formatPrice(shop.totalSales)}</p>
                            </div>

                            <div className="p-3 bg-white/40 rounded-2xl border border-white/40">
                              <p className="text-[0.65rem] text-gray-500 font-bold uppercase flex items-center gap-1">
                                <DollarSign size={12} /> Current Credit
                              </p>
                              <p className="font-black text-[#0f172a] text-sm mt-0.5">{formatPrice(shop.currentCredit)}</p>
                            </div>

                            <div className="p-3 bg-white/40 rounded-2xl border border-white/40">
                              <p className="text-[0.65rem] text-gray-500 font-bold uppercase flex items-center gap-1">
                                <Check size={12} /> Delivered
                              </p>
                              <p className="font-black text-[#0f172a] text-sm mt-0.5">{shop.deliveredOrders} Orders</p>
                            </div>

                            <div className="p-3 bg-white/40 rounded-2xl border border-white/40">
                              <p className="text-[0.65rem] text-gray-500 font-bold uppercase flex items-center gap-1">
                                <Clock size={12} /> Pending
                              </p>
                              <p className="font-black text-[#0f172a] text-sm mt-0.5">{shop.pendingOrders} Orders</p>
                            </div>

                            <div className="p-3 bg-white/40 rounded-2xl border border-white/40 col-span-2">
                              <p className="text-[0.65rem] text-gray-500 font-bold uppercase flex items-center gap-1">
                                <CreditCard size={12} /> Cheques Summary
                              </p>
                              <p className="font-black text-[#0f172a] text-sm mt-0.5">
                                {shop.chequeCount} Cheques ({formatPrice(shop.chequeValue)})
                              </p>
                            </div>
                          </div>

                          {/* View Single Shop & Invoices Link */}
                          <div className="mt-4 pt-3 border-t border-gray-200/60">
                            <Link
                              href={`/settings/shops/${shop.shopId}`}
                              className="w-full flex items-center justify-center gap-2 py-3 bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase tracking-wider rounded-full transition-all shadow-md"
                            >
                              <Eye size={14} /> VIEW INVOICES & DETAILS
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* API Pagination Component */}
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={(p) => setPage(p)}
                    className="mt-6 mb-4"
                  />
                </>
              )}
            </>
          )}

          {/* Edit Shop Modal */}
          {editingShop && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-white/50 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 border border-white/60 shadow-[0_25px_70px_rgba(0,0,0,0.25)]"
              >
                <button
                  onClick={() => setEditingShop(null)}
                  className="absolute top-6 right-6 p-2 text-gray-600 hover:text-[#0f172a] hover:bg-white/60 rounded-full transition-all border border-white/40 cursor-pointer"
                >
                  <X size={18} />
                </button>

                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-[#0f172a] text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
                    <Store size={28} />
                  </div>
                  <h2 className="text-2xl font-black text-[#0f172a] uppercase">EDIT SHOP DETAILS</h2>
                  <p className="text-xs text-gray-500 font-bold uppercase mt-1">
                    SHOP ID: {editingShop.shopId}
                  </p>
                </div>

                {updateMsg && (
                  <div className={`p-3 rounded-full text-center text-xs font-black uppercase mb-4 ${
                    updateMsg.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
                  }`}>
                    {updateMsg.text}
                  </div>
                )}

                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-[#0f172a] uppercase mb-1.5">
                      SHOP NAME *
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      required
                      placeholder="ENTER SHOP NAME"
                      className="w-full px-5 py-3.5 bg-white/70 border border-white/80 rounded-full font-bold text-xs text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a] uppercase shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-[#0f172a] uppercase mb-1.5">
                      PHONE NUMBER *
                    </label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                      required
                      placeholder="ENTER PHONE NUMBER"
                      className="w-full px-5 py-3.5 bg-white/70 border border-white/80 rounded-full font-bold text-xs text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a] uppercase shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-[#0f172a] uppercase mb-1.5">
                      ADDRESS
                    </label>
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                      placeholder="ENTER SHOP ADDRESS"
                      className="w-full px-5 py-3.5 bg-white/70 border border-white/80 rounded-full font-bold text-xs text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a] uppercase shadow-xs"
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingShop(null)}
                      className="flex-1 py-4 bg-white/60 hover:bg-white text-[#0f172a] font-black text-xs uppercase rounded-full transition-all border border-white/60 cursor-pointer"
                    >
                      CANCEL
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdating || !editForm.name || !editForm.phone}
                      className="flex-1 py-4 bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase rounded-full transition-all shadow-lg disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isUpdating ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : (
                        'SAVE CHANGES'
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
