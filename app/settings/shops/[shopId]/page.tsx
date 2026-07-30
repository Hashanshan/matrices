'use client';

import { useState, useEffect, use } from 'react';
import Header from '@/components/header';
import { useAuth } from '@/lib/contexts/auth-context';
import PinModal from '@/components/pin-modal';
import Pagination from '@/components/pagination';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Phone, MapPin, ShieldCheck, Heart, Search, Lock, ArrowLeft, Printer, FileText, CheckCircle2, Clock, AlertCircle, XCircle, ShoppingBag, DollarSign, CreditCard, Calendar, Filter, X, RefreshCw } from 'lucide-react';
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
    const error = await res.json().catch(() => ({ msg: 'Failed to load shop details' }));
    throw new Error(error.msg || 'Failed to fetch');
  }
  return res.json();
};

export default function ShopSingleViewPage({ params }: { params: Promise<{ shopId: string }> }) {
  const resolvedParams = use(params);
  const shopId = resolvedParams.shopId;

  const { isPinVerified, resetPinVerification } = useAuth();
  const [showPinModal, setShowPinModal] = useState(true);

  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Order | null>(null);

  // Build SWR query key for API searching, date filtering, and pagination
  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set('searchQuery', searchQuery);
  if (activeTab && activeTab !== 'all') queryParams.set('status', activeTab);
  if (fromDate) queryParams.set('fromDate', fromDate);
  if (toDate) queryParams.set('toDate', toDate);
  queryParams.set('page', String(page));
  queryParams.set('limit', '10');
  queryParams.set('sortField', 'updatedAt');
  queryParams.set('sortOrder', '-1'); // Default: recently updated orders on top

  const swrKey = `/api/shops/${shopId}?${queryParams.toString()}`;
  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
  });

  const shop: Shop | null = data?.shop || null;
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
                window.location.href = '/settings/shops';
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
              <h2 className="text-2xl font-black text-[#0f172a] uppercase mb-2">SHOP DETAILS ARE LOCKED</h2>
              <p className="text-gray-500 font-bold max-w-sm mb-6 uppercase text-xs">
                PLEASE ENTER YOUR 4-DIGIT SECURITY PIN TO ACCESS SHOP INVOICES AND DETAILS.
              </p>
              <button
                onClick={() => setShowPinModal(true)}
                className="bg-[#0f172a] text-white px-8 py-4 rounded-full font-black text-sm uppercase tracking-wider hover:bg-[#1e293b] shadow-xl transition-all cursor-pointer"
              >
                ENTER SECURITY PIN
              </button>
            </div>
          ) : isLoading && !data ? (
            <div className="flex justify-center items-center py-32">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
            </div>
          ) : !shop ? (
            <div className="text-center py-20 bg-white/20 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 shadow-lg">
              <h2 className="text-2xl font-black text-[#0f172a] uppercase mb-2">SHOP NOT FOUND</h2>
              <p className="text-gray-500 font-semibold mb-6 text-xs uppercase">
                THE REQUESTED SHOP DOES NOT EXIST OR IS NOT ACCESSIBLE.
              </p>
              <Link
                href="/settings/shops"
                className="bg-[#0f172a] text-white px-8 py-4 rounded-full font-black text-xs uppercase tracking-wider shadow-lg"
              >
                BACK TO SHOPS
              </Link>
            </div>
          ) : (
            <>
              {/* Back Button & Top Navigation */}
              <div className="flex items-center justify-between gap-4 mb-6">
                <Link
                  href="/settings/shops"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/60 hover:bg-white text-[#0f172a] font-black text-xs uppercase rounded-full border border-white/60 shadow-sm transition-all"
                >
                  <ArrowLeft size={16} /> BACK TO SHOPS
                </Link>

                <div className="flex items-center gap-3">
                  <Link
                    href="/settings/wishlist"
                    className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-4 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <Heart size={14} fill="#ef4444" className="text-red-500" /> WISHLIST
                  </Link>
                  <Link
                    href="/settings/security"
                    className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-4 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <ShieldCheck size={14} /> SECURITY
                  </Link>
                </div>
              </div>

              {/* Shop Single View Hero Card */}
              <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)] mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-200/60">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[0.65rem] font-black text-white bg-[#0f172a] px-3.5 py-1 rounded-full uppercase tracking-widest shadow-xs">
                        {shop.shopId}
                      </span>
                      <span className="text-[0.65rem] font-black text-green-800 bg-green-100/90 border border-green-200 px-3 py-1 rounded-full uppercase">
                        ACTIVE SHOP
                      </span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-[#0f172a] uppercase tracking-wide">
                      {shop.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-bold text-gray-600 uppercase">
                      <a href={`tel:${shop.phone}`} className="flex items-center gap-1.5 hover:text-[#0f172a]">
                        <Phone size={14} className="text-gray-500" /> {shop.phone}
                      </a>
                      <span className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-gray-500" /> {shop.address}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-4 bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl text-center shadow-xs">
                      <p className="text-[0.65rem] text-gray-500 font-bold uppercase">MATCHING INVOICES</p>
                      <p className="text-2xl font-black text-[#0f172a]">{totalOrders}</p>
                    </div>
                  </div>
                </div>

                {/* Summary Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6">
                  <div className="p-4 bg-white/50 rounded-2xl border border-white/60">
                    <p className="text-[0.65rem] text-gray-500 font-bold uppercase flex items-center gap-1">
                      <ShoppingBag size={12} /> Total Sales
                    </p>
                    <p className="font-black text-[#0f172a] text-base sm:text-lg mt-0.5">{formatPrice(shop.totalSales)}</p>
                  </div>
                  <div className="p-4 bg-white/50 rounded-2xl border border-white/60">
                    <p className="text-[0.65rem] text-gray-500 font-bold uppercase flex items-center gap-1">
                      <DollarSign size={12} /> Outstanding Credit
                    </p>
                    <p className="font-black text-[#0f172a] text-base sm:text-lg mt-0.5">{formatPrice(shop.currentCredit)}</p>
                  </div>
                  <div className="p-4 bg-white/50 rounded-2xl border border-white/60">
                    <p className="text-[0.65rem] text-gray-500 font-bold uppercase flex items-center gap-1">
                      <CheckCircle2 size={12} /> Delivered Orders
                    </p>
                    <p className="font-black text-[#0f172a] text-base sm:text-lg mt-0.5">{shop.deliveredOrders}</p>
                  </div>
                  <div className="p-4 bg-white/50 rounded-2xl border border-white/60">
                    <p className="text-[0.65rem] text-gray-500 font-bold uppercase flex items-center gap-1">
                      <Clock size={12} /> Pending Orders
                    </p>
                    <p className="font-black text-[#0f172a] text-base sm:text-lg mt-0.5">{shop.pendingOrders}</p>
                  </div>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="mb-6 space-y-4 bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[2rem] p-5 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <h2 className="text-xl font-black text-[#0f172a] uppercase tracking-wide flex items-center gap-2">
                    <FileText size={22} /> SHOP INVOICES & ORDERS
                  </h2>

                  {/* Search bar inside shop orders */}
                  <div className="relative max-w-sm w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => handleSearchChange(e.target.value)}
                      placeholder="SEARCH ORDER ID OR ITEM..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white/70 border border-white/80 rounded-full text-xs font-bold text-[#0f172a] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/30 uppercase shadow-xs"
                    />
                  </div>
                </div>

                {/* API Date Filter Inputs & Reset */}
                <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200/50">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-gray-500" />
                    <span className="text-[0.65rem] font-black text-[#0f172a] uppercase">FROM:</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={e => handleFromDateChange(e.target.value)}
                      className="px-3 py-1.5 bg-white/70 border border-white/80 rounded-xl text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/30 uppercase"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[0.65rem] font-black text-[#0f172a] uppercase">TO:</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={e => handleToDateChange(e.target.value)}
                      className="px-3 py-1.5 bg-white/70 border border-white/80 rounded-xl text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/30 uppercase"
                    />
                  </div>

                  {(fromDate || toDate || searchQuery || activeTab !== 'all') && (
                    <button
                      onClick={resetFilters}
                      className="px-3 py-1.5 bg-white/60 hover:bg-white text-rose-700 border border-rose-200 rounded-xl text-[0.65rem] font-black uppercase flex items-center gap-1 transition-all ml-auto cursor-pointer"
                    >
                      <RefreshCw size={12} /> CLEAR FILTERS
                    </button>
                  )}
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
                      className={`px-4 py-2.5 rounded-full font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap border cursor-pointer ${activeTab === tab.id
                          ? 'bg-[#0f172a] text-white border-[#0f172a] shadow-md scale-105'
                          : 'bg-white/50 hover:bg-white text-[#0f172a] border-white/60'
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Invoices List */}
              {isLoading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0f172a]"></div>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-16 bg-white/20 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 shadow-md">
                  <FileText size={36} className="text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-black text-[#0f172a] uppercase mb-1">NO MATCHING INVOICES FOUND</h3>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    TRY ADJUSTING YOUR DATE RANGE, STATUS FILTER, OR SEARCH QUERY
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
                            <p className="text-xs text-gray-500 font-bold uppercase mt-1">
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

                            <button
                              onClick={() => setSelectedInvoice(order)}
                              className="px-5 py-3 bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase tracking-wider rounded-full shadow-md transition-all flex items-center gap-2 ml-auto cursor-pointer"
                            >
                              <FileText size={14} /> VIEW CLEAR PDF
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

          {/* High-Definition Clear PDF Invoice Modal */}
          {selectedInvoice && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-3xl bg-white rounded-3xl p-6 sm:p-10 text-gray-900 shadow-2xl my-8"
              >
                {/* Modal Controls */}
                <div className="flex items-center justify-between pb-6 mb-6 border-b border-gray-200 print:hidden">
                  <div className="flex items-center gap-2">
                    <FileText className="text-[#0f172a]" size={24} />
                    <h3 className="font-black text-xl text-[#0f172a] uppercase">INVOICE PREVIEW</h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => window.print()}
                      className="px-5 py-2.5 bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase rounded-full shadow-md flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Printer size={14} /> PRINT / SAVE PDF
                    </button>
                    <button
                      onClick={() => setSelectedInvoice(null)}
                      className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-full transition-all cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Printable Invoice Document Body */}
                <div id="printable-invoice" className="space-y-6">
                  {/* Header Logo & Order ID */}
                  <div className="flex items-start justify-between pb-6 border-b-2 border-gray-900">
                    <div>
                      <h1 className="text-3xl font-black text-[#0f172a] tracking-wider uppercase">MATRICES</h1>
                      <p className="text-xs text-gray-500 font-bold uppercase mt-1">COMMERCIAL & DISTRIBUTION SERVICES</p>
                      <p className="text-xs text-gray-600 font-semibold uppercase mt-0.5">COLOMBO, SRI LANKA</p>
                    </div>

                    <div className="text-right">
                      <span className="inline-block px-4 py-1.5 bg-[#0f172a] text-white font-black text-sm uppercase rounded-lg mb-2">
                        INVOICE #{selectedInvoice.orderId}
                      </span>
                      <p className="text-xs text-gray-500 font-bold uppercase">
                        DATE: {new Date(selectedInvoice.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      <p className="text-xs text-gray-500 font-bold uppercase mt-0.5">
                        STATUS: <span className="font-black text-[#0f172a] uppercase">{selectedInvoice.status}</span>
                      </p>
                    </div>
                  </div>

                  {/* Customer / Shop Information */}
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                    <p className="text-[0.65rem] font-black text-gray-400 uppercase tracking-wider mb-1">INVOICED TO</p>
                    <h2 className="text-lg font-black text-[#0f172a] uppercase">{selectedInvoice.shop.name}</h2>
                    <p className="text-xs text-gray-600 font-semibold uppercase mt-0.5">SHOP ID: {selectedInvoice.shop.shopId}</p>
                    <p className="text-xs text-gray-600 font-semibold uppercase">{selectedInvoice.shop.address}</p>
                    <p className="text-xs text-gray-600 font-semibold uppercase">PHONE: {selectedInvoice.shop.phone}</p>
                  </div>

                  {/* Itemized Table */}
                  <div>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[#0f172a] text-white uppercase font-black">
                          <th className="p-3 rounded-l-lg">PRODUCT ID</th>
                          <th className="p-3">ITEM DESCRIPTION</th>
                          <th className="p-3 text-center">QTY</th>
                          <th className="p-3 text-right">UNIT PRICE</th>
                          <th className="p-3 text-right rounded-r-lg">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedInvoice.items.map((item, idx) => (
                          <tr key={idx} className="font-semibold text-gray-800 uppercase">
                            <td className="p-3 font-black text-[#0f172a]">{item.productID}</td>
                            <td className="p-3">{item.name}</td>
                            <td className="p-3 text-center">{item.quantity}</td>
                            <td className="p-3 text-right">{formatPrice(item.price)}</td>
                            <td className="p-3 text-right font-black text-[#0f172a]">{formatPrice(item.quantity * item.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Summary Table */}
                  <div className="flex justify-end pt-4">
                    <div className="w-full max-w-xs space-y-2 text-xs font-bold border-t-2 border-gray-900 pt-4">
                      <div className="flex justify-between text-gray-600 uppercase">
                        <span>SUBTOTAL:</span>
                        <span className="font-black text-[#0f172a]">{formatPrice(selectedInvoice.subtotal)}</span>
                      </div>
                      {selectedInvoice.discount > 0 && (
                        <div className="flex justify-between text-gray-600 uppercase">
                          <span>DISCOUNT ({selectedInvoice.discount}%):</span>
                          <span className="font-black text-rose-600">-{formatPrice(selectedInvoice.discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-[#0f172a] uppercase border-t pt-2">
                        <span>GRAND TOTAL:</span>
                        <span>{formatPrice(selectedInvoice.total)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-green-700 uppercase">
                        <span>TOTAL PAID:</span>
                        <span>{formatPrice(selectedInvoice.totalPaid)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-black text-rose-700 uppercase border-t border-dashed pt-2">
                        <span>BALANCE DUE:</span>
                        <span>{formatPrice(selectedInvoice.remainingAmount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Record Section */}
                  {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-[0.65rem] font-black text-gray-400 uppercase tracking-wider mb-2">PAYMENT HISTORY</p>
                      <div className="space-y-1.5 text-xs font-semibold">
                        {selectedInvoice.payments.map((p, idx) => (
                          <div key={idx} className="flex justify-between p-2 bg-gray-50 rounded-lg uppercase">
                            <span>{new Date(p.date).toLocaleDateString()} - METHOD: {p.paymentMethod}</span>
                            <span className="font-black text-green-700">{formatPrice(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer Terms & Signature */}
                  <div className="pt-8 text-center text-[0.65rem] text-gray-400 font-bold uppercase border-t border-gray-200">
                    <p>THANK YOU FOR YOUR BUSINESS! FOR ENQUIRIES, CONTACT SUPPORT AT matricespvtltd@gmail.com</p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
