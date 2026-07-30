'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { useAuth } from '@/lib/contexts/auth-context';
import PinModal from '@/components/pin-modal';
import Pagination from '@/components/pagination';
import InvoicePdfModal from '@/components/invoice-pdf-modal';
import { motion } from 'framer-motion';
import { FileText, Search, Lock, Calendar, CheckCircle2, Clock, AlertCircle, XCircle, ShoppingBag, Store, Heart, ShieldCheck, RefreshCw, Eye } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { formatPrice } from '@/lib/currency';

interface Item {
  productID: string;
  name: string;
  quantity: number;
  price: number;
  note?: string;
}

interface Payment {
  id: string;
  date: string;
  amount: number;
  paymentMethod: string;
  notes?: string;
}

interface Order {
  orderId: string;
  date: string;
  shop: {
    shopId: string;
    name: string;
    address: string;
    phone: string;
  };
  items: Item[];
  subtotal: number;
  discount: number;
  discountAmount: number;
  total: number;
  status: string;
  totalPaid: number;
  remainingAmount: number;
  payments: Payment[];
}

const fetcher = async (url: string) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ msg: 'Failed to load orders' }));
    throw new Error(error.msg || 'Failed to fetch');
  }
  return res.json();
};

export default function SettingsOrdersPage() {
  const { isPinVerified, resetPinVerification } = useAuth();
  const [showPinModal, setShowPinModal] = useState(true);

  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Order | null>(null);

  // Build SWR query key for overall orders API
  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set('searchQuery', searchQuery);
  if (activeTab && activeTab !== 'all') queryParams.set('status', activeTab);
  if (fromDate) queryParams.set('fromDate', fromDate);
  if (toDate) queryParams.set('toDate', toDate);
  queryParams.set('page', String(page));
  queryParams.set('limit', '10');
  queryParams.set('sortField', 'updatedAt');
  queryParams.set('sortOrder', '-1'); // Default: recently updated orders on top

  const swrKey = `/api/orders?${queryParams.toString()}`;
  const { data, error, isLoading } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
  });

  const orders: Order[] = data?.orders || [];
  const totalOrders: number = data?.totalOrders || orders.length;
  const totalPages: number = data?.totalPages || 1;

  // Require Security PIN verification on visit
  useEffect(() => {
    resetPinVerification();
  }, []);

  useEffect(() => {
    setShowPinModal(!isPinVerified);
  }, [isPinVerified]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleFromDateChange = (val: string) => {
    setFromDate(val);
    setPage(1);
  };

  const handleToDateChange = (val: string) => {
    setToDate(val);
    setPage(1);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setActiveTab('all');
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
      case 'completed':
        return (
          <span className="px-3 py-1 bg-green-100/90 text-green-800 border border-green-200/80 rounded-full text-[0.65rem] font-black uppercase flex items-center gap-1 shadow-xs">
            <CheckCircle2 size={12} /> DELIVERED
          </span>
        );
      case 'pending':
        return (
          <span className="px-3 py-1 bg-amber-100/90 text-amber-800 border border-amber-200/80 rounded-full text-[0.65rem] font-black uppercase flex items-center gap-1 shadow-xs">
            <Clock size={12} /> PENDING
          </span>
        );
      case 'loaded':
        return (
          <span className="px-3 py-1 bg-blue-100/90 text-blue-800 border border-blue-200/80 rounded-full text-[0.65rem] font-black uppercase flex items-center gap-1 shadow-xs">
            <ShoppingBag size={12} /> LOADED
          </span>
        );
      case 'cancelled':
      case 'failed':
        return (
          <span className="px-3 py-1 bg-rose-100/90 text-rose-800 border border-rose-200/80 rounded-full text-[0.65rem] font-black uppercase flex items-center gap-1 shadow-xs">
            <XCircle size={12} /> CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-gray-100/90 text-gray-800 border border-gray-200/80 rounded-full text-[0.65rem] font-black uppercase flex items-center gap-1 shadow-xs">
            <AlertCircle size={12} /> {status}
          </span>
        );
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
              <h2 className="text-2xl font-black text-[#0f172a] uppercase mb-2">ORDERS PAGE IS LOCKED</h2>
              <p className="text-gray-500 font-bold max-w-sm mb-6 uppercase text-xs">
                PLEASE ENTER YOUR 4-DIGIT SECURITY PIN TO ACCESS YOUR ASSIGNED ORDERS & INVOICES.
              </p>
              <button
                onClick={() => setShowPinModal(true)}
                className="bg-[#0f172a] text-white px-8 py-4 rounded-full font-black text-sm uppercase tracking-wider hover:bg-[#1e293b] shadow-xl transition-all cursor-pointer"
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
                    <FileText size={32} />
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-[#0f172a] uppercase tracking-wide">
                      SHOP INVOICES & ORDERS
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 font-bold tracking-wide mt-1 uppercase">
                      VIEW ALL ORDERS AND INVOICES ACROSS YOUR ASSIGNED SHOPS
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href="/settings/shops"
                    className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-4 py-3 rounded-full shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Store size={16} /> SHOPS
                  </Link>
                  <Link
                    href="/settings/wishlist"
                    className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-4 py-3 rounded-full shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Heart size={16} fill="#ef4444" className="text-red-500" /> WISHLIST
                  </Link>
                  <Link
                    href="/settings/security"
                    className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-4 py-3 rounded-full shadow-md transition-all flex items-center gap-1.5"
                  >
                    <ShieldCheck size={16} /> SECURITY
                  </Link>
                  <span className="text-xs font-black text-white bg-[#0f172a] px-5 py-3 rounded-full shadow-lg uppercase">
                    {totalOrders} {totalOrders === 1 ? 'ORDER' : 'ORDERS'}
                  </span>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="mb-8 space-y-4 bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[2rem] p-5 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="relative max-w-md w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => handleSearchChange(e.target.value)}
                      placeholder="SEARCH ORDER ID OR ITEM..."
                      className="w-full pl-10 pr-4 py-3.5 bg-white/70 border border-white/80 rounded-full text-xs font-bold text-[#0f172a] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/30 uppercase shadow-xs"
                    />
                  </div>

                  {/* Date Range Inputs */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-500" />
                      <span className="text-[0.65rem] font-black text-[#0f172a] uppercase">FROM:</span>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={e => handleFromDateChange(e.target.value)}
                        className="px-3.5 py-2 bg-white/70 border border-white/80 rounded-xl text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/30 uppercase"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[0.65rem] font-black text-[#0f172a] uppercase">TO:</span>
                      <input
                        type="date"
                        value={toDate}
                        onChange={e => handleToDateChange(e.target.value)}
                        className="px-3.5 py-2 bg-white/70 border border-white/80 rounded-xl text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/30 uppercase"
                      />
                    </div>

                    {(fromDate || toDate || searchQuery || activeTab !== 'all') && (
                      <button
                        onClick={resetFilters}
                        className="px-3.5 py-2 bg-white/60 hover:bg-white text-rose-700 border border-rose-200 rounded-xl text-[0.65rem] font-black uppercase flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <RefreshCw size={12} /> CLEAR
                      </button>
                    )}
                  </div>
                </div>

                {/* Separated Status Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pt-2 scrollbar-none">
                  {[
                    { id: 'all', label: 'ALL INVOICES' },
                    { id: 'delivered', label: 'DELIVERED' },
                    { id: 'pending', label: 'PENDING' },
                    { id: 'loaded', label: 'LOADED' },
                    { id: 'cancelled', label: 'CANCELLED' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`px-5 py-3 rounded-full font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap border cursor-pointer ${
                        activeTab === tab.id
                          ? 'bg-[#0f172a] text-white border-[#0f172a] shadow-md scale-105'
                          : 'bg-white/50 hover:bg-white text-[#0f172a] border-white/60'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Invoices / Orders List */}
              {isLoading ? (
                <div className="flex justify-center items-center py-32">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-20 bg-white/20 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 shadow-md">
                  <FileText size={36} className="text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-black text-[#0f172a] uppercase mb-1">NO MATCHING ORDERS FOUND</h3>
                  <p className="text-xs text-gray-500 font-bold uppercase max-w-md mx-auto">
                    NO INVOICES MATCHING YOUR SEARCH QUERY, DATE RANGE, OR SELECTED STATUS TAB.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-8">
                    {orders.map((order) => (
                      <motion.div
                        key={order.orderId}
                        layout
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2rem] p-5 sm:p-6 shadow-[0_10px_35px_rgba(0,0,0,0.04)] hover:border-white/90 transition-all"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-200/60">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-sm font-black text-[#0f172a] uppercase bg-white/80 border border-white/80 px-3.5 py-1 rounded-full shadow-xs">
                                {order.orderId}
                              </span>
                              {getStatusBadge(order.status)}
                            </div>

                            <p className="text-xs text-[#0f172a] font-black uppercase mt-1">
                              SHOP: {order.shop.name} ({order.shop.shopId})
                            </p>

                            <p className="text-[0.7rem] text-gray-500 font-bold uppercase mt-0.5">
                              DATE: {new Date(order.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                            <div>
                              <span className="text-gray-500 uppercase block text-[0.65rem]">SUBTOTAL</span>
                              <span className="text-[#0f172a] font-black">{formatPrice(order.subtotal)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 uppercase block text-[0.65rem]">TOTAL AMOUNT</span>
                              <span className="text-[#0f172a] font-black text-sm">{formatPrice(order.total)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 uppercase block text-[0.65rem]">PAID</span>
                              <span className="text-green-700 font-black">{formatPrice(order.totalPaid)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 uppercase block text-[0.65rem]">REMAINING</span>
                              <span className="text-rose-700 font-black">{formatPrice(order.remainingAmount)}</span>
                            </div>

                            {/* View Clear PDF Popup Modal Button */}
                            <button
                              onClick={() => setSelectedInvoice(order)}
                              className="px-5 py-3 bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase tracking-wider rounded-full shadow-md transition-all flex items-center gap-2 ml-auto cursor-pointer"
                            >
                              <Eye size={14} /> VIEW CLEAR PDF
                            </button>
                          </div>
                        </div>

                        {/* Items Preview Table */}
                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full text-left text-xs font-bold">
                            <thead>
                              <tr className="text-[0.65rem] text-gray-500 uppercase border-b border-gray-200/40 pb-2">
                                <th className="pb-2">PRODUCT ID</th>
                                <th className="pb-2">ITEM NAME</th>
                                <th className="pb-2 text-center">QTY</th>
                                <th className="pb-2 text-right">UNIT PRICE</th>
                                <th className="pb-2 text-right">SUBTOTAL</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100/50">
                              {order.items.map((item, idx) => (
                                <tr key={idx} className="text-[#0f172a] uppercase">
                                  <td className="py-2.5 font-black">{item.productID}</td>
                                  <td className="py-2.5">{item.name}</td>
                                  <td className="py-2.5 text-center">{item.quantity}</td>
                                  <td className="py-2.5 text-right">{formatPrice(item.price)}</td>
                                  <td className="py-2.5 text-right font-black">{formatPrice(item.quantity * item.price)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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

          {/* PDF Invoice Popup Modal with Click-Outside Close & Download PDF options */}
          <InvoicePdfModal
            order={selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
          />

        </div>
      </main>
    </>
  );
}
