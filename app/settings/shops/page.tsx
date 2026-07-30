'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { useAuth } from '@/lib/contexts/auth-context';
import PinModal from '@/components/pin-modal';
import Pagination from '@/components/pagination';
import { motion } from 'framer-motion';
import { Store, Phone, MapPin, Edit, ShieldCheck, Heart, Search, Lock, X, Check, FileText } from 'lucide-react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import Swal from 'sweetalert2';
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
    const error = await res.json().catch(() => ({ msg: 'Failed to load shops' }));
    throw new Error(error.msg || 'Failed to fetch');
  }
  return res.json();
};

export default function ShopsSettingsPage() {
  const { isPinVerified, resetPinVerification } = useAuth();
  const [showPinModal, setShowPinModal] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Edit Modal State
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Build SWR query key
  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set('searchQuery', searchQuery);
  queryParams.set('page', String(page));
  queryParams.set('limit', '9');
  queryParams.set('sortField', 'updatedAt');
  queryParams.set('sortOrder', '-1'); // Default: recently updated shops on top

  const swrKey = `/api/shops?${queryParams.toString()}`;
  const { data, error, isLoading } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
  });

  const shops: Shop[] = data?.shops || [];
  const totalRecords: number = data?.totalRecords || shops.length;
  const totalPages: number = data?.totalPages || 1;

  // Require Security PIN verification on visit
  useEffect(() => {
    resetPinVerification();
  }, []);

  useEffect(() => {
    setShowPinModal(!isPinVerified);
  }, [isPinVerified]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleEditClick = (shop: Shop) => {
    setEditingShop(shop);
    setEditName(shop.name || '');
    setEditPhone(shop.phone || '');
    setEditAddress(shop.address || '');
  };

  const handleCloseEditModal = () => {
    setEditingShop(null);
    setEditName('');
    setEditPhone('');
    setEditAddress('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/shops/${editingShop.shopId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          address: editAddress,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.msg || 'Failed to update shop details');
      }

      Swal.fire({
        icon: 'success',
        title: 'Shop Updated',
        text: 'Shop details updated successfully',
        timer: 2000,
        showConfirmButton: false,
      });

      handleCloseEditModal();
      mutate(swrKey);
    } catch (err: any) {
      console.error('Error saving shop edit:', err);
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: err.message || 'Error updating shop',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-[url('/bg.png')] bg-cover bg-center bg-no-repeat bg-fixed py-4 sm:py-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">

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
            <div className="flex flex-col items-center justify-center py-24 sm:py-32 text-center px-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#0f172a] text-white rounded-full flex items-center justify-center mb-4 shadow-xl border border-white/20">
                <Lock size={32} />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0f172a] uppercase mb-2">SHOPS PAGE IS LOCKED</h2>
              <p className="text-gray-500 font-bold max-w-sm mb-6 uppercase text-xs">
                PLEASE ENTER YOUR 4-DIGIT SECURITY PIN TO ACCESS YOUR ASSIGNED SHOPS.
              </p>
              <button
                onClick={() => setShowPinModal(true)}
                className="bg-[#0f172a] text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-wider hover:bg-[#1e293b] shadow-xl transition-all cursor-pointer"
              >
                ENTER SECURITY PIN
              </button>
            </div>
          ) : (
            <>
              {/* Header Title Section */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 sm:p-3.5 bg-[#0f172a]/10 border border-[#0f172a]/20 rounded-full text-[#0f172a] shadow-sm flex items-center justify-center shrink-0">
                    <Store size={28} />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-4xl font-black text-[#0f172a] uppercase tracking-wide">
                      MY SHOPS
                    </h1>
                    <p className="text-[0.7rem] sm:text-xs text-gray-500 font-bold tracking-wide mt-0.5 uppercase">
                      VIEW AND MANAGE DETAILS FOR YOUR ASSIGNED SHOPS
                    </p>
                  </div>
                </div>

                {/* Top Mobile Scrollable Navigation */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none w-full sm:w-auto max-w-full shrink-0">
                  <Link
                    href="/settings/orders"
                    className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-3.5 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <FileText size={14} /> ORDERS
                  </Link>
                  <Link
                    href="/settings/wishlist"
                    className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-3.5 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Heart size={14} fill="#ef4444" className="text-red-500" /> WISHLIST
                  </Link>
                  <Link
                    href="/settings/security"
                    className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-3.5 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <ShieldCheck size={14} /> SECURITY
                  </Link>
                  <span className="text-xs font-black text-white bg-[#0f172a] px-4 py-2.5 rounded-full shadow-xs uppercase whitespace-nowrap shrink-0">
                    {totalRecords} {totalRecords === 1 ? 'SHOP' : 'SHOPS'}
                  </span>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="relative max-w-md w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    placeholder="SEARCH SHOPS BY NAME, ID, PHONE, ADDRESS..."
                    className="w-full pl-11 pr-4 py-3 bg-white/50 backdrop-blur-xl border border-white/60 rounded-full text-xs font-bold text-[#0f172a] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/30 shadow-sm uppercase"
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0f172a]"></div>
                </div>
              ) : shops.length === 0 ? (
                <div className="text-center py-16 bg-white/20 backdrop-blur-2xl rounded-[2rem] border border-white/60 shadow-lg px-4">
                  <div className="w-16 h-16 bg-gray-100/50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-600">
                    <Store size={32} />
                  </div>
                  <h2 className="text-xl font-black text-[#0f172a] uppercase mb-2">
                    NO ASSIGNED SHOPS FOUND
                  </h2>
                  <p className="text-gray-500 font-semibold mb-6 max-w-md mx-auto uppercase text-xs">
                    {searchQuery
                      ? 'TRY A DIFFERENT SEARCH TERM TO FIND ASSIGNED SHOPS.'
                      : 'YOU CURRENTLY DO NOT HAVE ANY ACTIVE SHOPS ASSIGNED TO YOUR SALESREP ACCOUNT.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Shop Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
                    {shops.map((shop) => (
                      <motion.div
                        key={shop.shopId}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-6 shadow-[0_15px_45px_rgba(0,0,0,0.06)] flex flex-col justify-between group hover:border-white/90 transition-all"
                      >
                        <div>
                          {/* Header Badge & Title */}
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="min-w-0">
                              <span className="text-[0.65rem] font-black text-[#0f172a] tracking-widest uppercase bg-white/60 border border-white/80 px-3 py-1 rounded-full inline-block mb-2 shadow-xs">
                                {shop.shopId}
                              </span>
                              <h3 className="font-extrabold text-[#0f172a] text-lg sm:text-xl uppercase leading-tight truncate">
                                {shop.name}
                              </h3>
                            </div>
                            <button
                              onClick={() => handleEditClick(shop)}
                              className="p-2.5 sm:p-3 bg-white/70 hover:bg-white text-[#0f172a] rounded-full transition-all border border-white/60 shadow-sm flex-shrink-0 cursor-pointer"
                              title="Edit Shop Details"
                            >
                              <Edit size={16} />
                            </button>
                          </div>

                          {/* Contact & Location Info */}
                          <div className="space-y-2 mb-5">
                            <a
                              href={`tel:${shop.phone}`}
                              className="flex items-center gap-2 text-xs font-bold text-[#0f172a] hover:text-blue-600 transition-colors uppercase"
                            >
                              <Phone size={14} className="text-gray-500 shrink-0" />
                              <span>{shop.phone || 'NO PHONE'}</span>
                            </a>
                            <div className="flex items-start gap-2 text-xs font-bold text-gray-600 uppercase">
                              <MapPin size={14} className="text-gray-500 mt-0.5 shrink-0" />
                              <span className="line-clamp-2">{shop.address || 'NO ADDRESS'}</span>
                            </div>
                          </div>

                          {/* Metrics Projected Fields Grid */}
                          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-gray-200/50 mb-5">
                            <div className="bg-white/50 rounded-2xl p-2.5 sm:p-3 border border-white/60">
                              <span className="text-[0.65rem] text-gray-500 font-bold uppercase block">TOTAL SALES</span>
                              <span className="text-xs sm:text-sm font-black text-[#0f172a]">{formatPrice(shop.totalSales)}</span>
                            </div>
                            <div className="bg-white/50 rounded-2xl p-2.5 sm:p-3 border border-white/60">
                              <span className="text-[0.65rem] text-gray-500 font-bold uppercase block">CREDIT</span>
                              <span className="text-xs sm:text-sm font-black text-[#0f172a]">{formatPrice(shop.currentCredit)}</span>
                            </div>
                            <div className="bg-white/50 rounded-2xl p-2.5 sm:p-3 border border-white/60">
                              <span className="text-[0.65rem] text-gray-500 font-bold uppercase block">DELIVERED</span>
                              <span className="text-xs sm:text-sm font-black text-green-700">{shop.deliveredOrders}</span>
                            </div>
                            <div className="bg-white/50 rounded-2xl p-2.5 sm:p-3 border border-white/60">
                              <span className="text-[0.65rem] text-gray-500 font-bold uppercase block">PENDING</span>
                              <span className="text-xs sm:text-sm font-black text-amber-700">{shop.pendingOrders}</span>
                            </div>
                          </div>
                        </div>

                        {/* View Invoices / Single View Action Button */}
                        <Link
                          href={`/settings/shops/${shop.shopId}`}
                          className="w-full py-3 bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase tracking-wider rounded-full shadow-md transition-all text-center block"
                        >
                          VIEW SHOP INVOICES
                        </Link>
                      </motion.div>
                    ))}
                  </div>

                  {/* API Pagination */}
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

        </div>
      </main>

      {/* Edit Shop Modal (Can Edit, Cannot Delete) */}
      {editingShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-100"
          >
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Store size={22} className="text-[#0f172a]" />
                <h3 className="font-black text-lg text-[#0f172a] uppercase">EDIT SHOP INFO</h3>
              </div>
              <button
                onClick={handleCloseEditModal}
                className="p-2 text-gray-400 hover:text-black rounded-full transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-[#0f172a] uppercase mb-1">SHOP ID</label>
                <input
                  type="text"
                  disabled
                  value={editingShop.shopId}
                  className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-2xl text-xs font-bold text-gray-500 cursor-not-allowed uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#0f172a] uppercase mb-1">SHOP NAME</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a] uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#0f172a] uppercase mb-1">PHONE NUMBER</label>
                <input
                  type="text"
                  required
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a] uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#0f172a] uppercase mb-1">ADDRESS</label>
                <textarea
                  required
                  rows={3}
                  value={editAddress}
                  onChange={e => setEditAddress(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a] uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-[#0f172a] font-black text-xs uppercase rounded-full transition-all cursor-pointer"
                >
                  CANCEL
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase rounded-full shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Check size={16} />
                  )}
                  SAVE CHANGES
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </>
  );
}
