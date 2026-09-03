'use client';

import { useState, useEffect, use } from 'react';
import Header from '@/components/header';
import BackButton from '@/components/back-button';
import { useAuth } from '@/lib/contexts/auth-context';
import PinModal from '@/components/pin-modal';
import Pagination from '@/components/pagination';
import InvoicePdfModal from '@/components/invoice-pdf-modal';
import { motion } from 'framer-motion';
import { Store, Phone, MapPin, ShieldCheck, Heart, Search, Lock, ArrowLeft, FileText, CheckCircle2, Clock, AlertCircle, XCircle, ShoppingBag, DollarSign, Calendar, RefreshCw, Eye, Navigation, ExternalLink, Mail } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { formatPrice } from '@/lib/currency';

interface Shop {
  shopId: string;
  name: string;
  email?: string;
  phone: string;
  phones?: string[];
  address: string;
  mapUrl?: string;
  imageUrl?: string;
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

import { resolveApiUrl, getAuthToken } from '@/lib/utils';
import { offlineDB } from '@/lib/offline/indexed-db';
import SmartImage from '@/components/smart-image';

const fetcher = async (url: string) => {
  const mode = typeof window !== 'undefined' ? (localStorage.getItem('matrices_data_mode') as string) : 'online';
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const extractShopId = () => {
    try {
      const match = url.match(/\/byid\/([^?]+)/);
      return match ? match[1] : '';
    } catch { return ''; }
  };

  const getOfflineShop = async () => {
    const rawShops = await offlineDB.getAll<any>('shops').catch(() => []);
    const rawOrders = await offlineDB.getAll<any>('orders').catch(() => []);
    const id = extractShopId();
    const shop = rawShops.find((s: any) =>
      String(s.shopId) === id || String(s.id) === id
    );
    const shopOrders = rawOrders.filter((o: any) =>
      String(o.shop?.shopId) === id || String(o.shopId) === id
    );
    return { hasShop: !!shop, response: { success: true, shop: shop || null, orders: shopOrders, totalOrders: shopOrders.length, totalPages: 1 } };
  };

  if (mode === 'offline' || isOffline) {
    const { hasShop, response } = await getOfflineShop();
    if (hasShop || isOffline) return response;
  }

  const token = getAuthToken();
  const targetUrl = resolveApiUrl(url);
  try {
    const res = await fetch(targetUrl, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error('Failed to fetch shop');
    return res.json();
  } catch {
    const { response } = await getOfflineShop();
    return response;
  }
};

import { useParams, useSearchParams, useRouter } from 'next/navigation';

export default function ShopClient({ params }: { params?: Promise<{ shopId: string }> }) {
  const router = useRouter();
  const routerParams = useParams();
  const searchParams = useSearchParams();

  let resolvedShopId = '';
  try {
    if (params) {
      const resolved = use(params);
      resolvedShopId = resolved?.shopId || '';
    }
  } catch (e) { }

  const rawParam = (routerParams?.shopId as string) || resolvedShopId;
  const queryParam = searchParams?.get('shopId') || '';

  const shopId = (rawParam && rawParam !== 'default' && rawParam !== '1')
    ? rawParam
    : (queryParam || rawParam || '1');

  const { user, isPinVerified, resetPinVerification } = useAuth();
  const [showPinModal, setShowPinModal] = useState(true);

  // If logged-in user is a shop account, block access and redirect to catalogue
  useEffect(() => {
    if (user?.role === 'shop') {
      router.replace('/catalogue');
    }
  }, [user, router]);

  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Order | null>(null);

  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set('searchQuery', searchQuery);
  if (activeTab && activeTab !== 'all') queryParams.set('status', activeTab);
  if (fromDate) queryParams.set('fromDate', fromDate);
  if (toDate) queryParams.set('toDate', toDate);
  queryParams.set('page', String(page));
  queryParams.set('limit', '10');
  queryParams.set('sortField', 'updatedAt');
  queryParams.set('sortOrder', '-1');

  const swrKey = `/api/shops/byid/${shopId}?${queryParams.toString()}`;
  const { data, error, isLoading } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
  });

  const shop: Shop | null = data?.shop || null;
  const orders: Order[] = data?.orders || [];
  const totalOrders: number = data?.totalOrders || orders.length;
  const totalPages: number = data?.totalPages || 1;

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
          <span className="px-3 py-1 bg-green-100/90 text-green-800 border border-green-200/80 rounded-full text-[0.65rem] font-black uppercase flex items-center gap-1 shadow-xs shrink-0">
            <CheckCircle2 size={12} /> DELIVERED
          </span>
        );
      case 'pending':
        return (
          <span className="px-3 py-1 bg-amber-100/90 text-amber-800 border border-amber-200/80 rounded-full text-[0.65rem] font-black uppercase flex items-center gap-1 shadow-xs shrink-0">
            <Clock size={12} /> PENDING
          </span>
        );
      case 'loaded':
        return (
          <span className="px-3 py-1 bg-blue-100/90 text-blue-800 border border-blue-200/80 rounded-full text-[0.65rem] font-black uppercase flex items-center gap-1 shadow-xs shrink-0">
            <ShoppingBag size={12} /> LOADED
          </span>
        );
      case 'cancelled':
      case 'failed':
        return (
          <span className="px-3 py-1 bg-rose-100/90 text-rose-800 border border-rose-200/80 rounded-full text-[0.65rem] font-black uppercase flex items-center gap-1 shadow-xs shrink-0">
            <XCircle size={12} /> CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-gray-100/90 text-gray-800 border border-gray-200/80 rounded-full text-[0.65rem] font-black uppercase flex items-center gap-1 shadow-xs shrink-0">
            <AlertCircle size={12} /> {status}
          </span>
        );
    }
  };

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-[url(/bg.png)] bg-cover bg-center bg-no-repeat bg-fixed py-4 sm:py-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">

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
            <div className="flex flex-col items-center justify-center py-24 sm:py-32 text-center px-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#0f172a] text-white rounded-full flex items-center justify-center mb-4 shadow-xl border border-white/20">
                <Lock size={32} />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0f172a] uppercase mb-2">SHOP DETAILS ARE LOCKED</h2>
              <p className="text-gray-500 font-bold max-w-sm mb-6 uppercase text-xs">
                PLEASE ENTER YOUR 4-DIGIT SECURITY PIN TO ACCESS SHOP INVOICES AND DETAILS.
              </p>
              <button
                onClick={() => setShowPinModal(true)}
                className="bg-[#0f172a] text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-wider hover:bg-[#1e293b] shadow-xl transition-all cursor-pointer"
              >
                ENTER SECURITY PIN
              </button>
            </div>
          ) : isLoading && !data ? (
            <div className="flex justify-center items-center py-32">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0f172a]"></div>
            </div>
          ) : !shop ? (
            <div className="text-center py-16 bg-white/20 backdrop-blur-2xl rounded-[2rem] border border-white/60 shadow-lg px-4">
              <h2 className="text-xl font-black text-[#0f172a] uppercase mb-2">SHOP NOT FOUND</h2>
              <p className="text-gray-500 font-semibold mb-6 text-xs uppercase">
                THE REQUESTED SHOP DOES NOT EXIST OR IS NOT ACCESSIBLE.
              </p>
              <Link
                href="/settings/shops"
                className="bg-[#0f172a] text-white px-6 py-3 rounded-full font-black text-xs uppercase tracking-wider shadow-lg"
              >
                BACK TO SHOPS
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                {/* <BackButton label="Shops" /> */}

                {/* <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none w-full sm:w-auto max-w-full shrink-0">
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
                </div> */}
              </div>

              <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)] mb-6 overflow-hidden">
                {shop.imageUrl && (
                  <div className="relative w-full h-48 sm:h-56 rounded-2xl sm:rounded-3xl overflow-hidden mb-6 border border-white/80 shadow-sm">
                    <SmartImage src={shop.imageUrl} alt={shop.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-200/60">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[0.65rem] font-black text-white bg-[#0f172a] px-3.5 py-1 rounded-full uppercase tracking-widest shadow-xs">
                        {shop.shopId}
                      </span>
                      <span className="text-[0.65rem] font-black text-green-800 bg-green-100/90 border border-green-200 px-3 py-1 rounded-full uppercase">
                        ACTIVE SHOP
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-black text-[#0f172a] uppercase tracking-wide">
                      {shop.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 text-xs font-bold text-gray-600 uppercase">
                      {/* Phone Numbers List */}
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {(shop.phones && shop.phones.length > 0 ? shop.phones : (shop.phone ? [shop.phone] : [])).map((ph, idx) => (
                          <a
                            key={idx}
                            href={`tel:${ph}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/70 hover:bg-[#0f172a] text-[#0f172a] hover:text-white rounded-full text-xs font-bold transition-all border border-white/80 shadow-2xs group/ph"
                            title={`Call ${ph}`}
                          >
                            <Phone size={12} className="text-emerald-600 group-hover/ph:text-emerald-300 shrink-0" />
                            <span>{ph}</span>
                          </a>
                        ))}
                      </div>

                      {/* Shop Email */}
                      {shop.email && (
                        <a
                          href={`mailto:${shop.email}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/70 hover:bg-[#0f172a] text-[#0f172a] hover:text-white rounded-full text-xs font-bold transition-all border border-white/80 shadow-2xs group/em"
                          title={`Email ${shop.email}`}
                        >
                          <Mail size={12} className="text-blue-600 group-hover/em:text-blue-300 shrink-0" />
                          <span>{shop.email}</span>
                        </a>
                      )}

                      <span className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-gray-500 shrink-0" /> {shop.address}
                      </span>
                      {shop.mapUrl && (
                        <a
                          href={shop.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 bg-[#0f172a] text-white rounded-full text-[0.65rem] font-black uppercase transition-all shadow-xs hover:bg-[#1e293b]"
                        >
                          <Navigation size={11} className="text-blue-400 shrink-0" /> VIEW MAP LOCATION <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-3.5 sm:p-4 bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl text-center shadow-xs w-full sm:w-auto">
                      <p className="text-[0.65rem] text-gray-500 font-bold uppercase">MATCHING INVOICES</p>
                      <p className="text-xl sm:text-2xl font-black text-[#0f172a]">{totalOrders}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-5">
                  <div className="p-3.5 sm:p-4 bg-white/50 rounded-2xl border border-white/60">
                    <p className="text-[0.65rem] text-gray-500 font-bold uppercase flex items-center gap-1">
                      <ShoppingBag size={12} className="shrink-0" /> Total Sales
                    </p>
                    <p className="font-black text-[#0f172a] text-sm sm:text-lg mt-0.5">{formatPrice(shop.totalSales)}</p>
                  </div>
                  <div className="p-4 bg-white/50 rounded-2xl border border-white/60">
                    <p className="text-[0.65rem] text-gray-500 font-bold uppercase flex items-center gap-1">
                      <DollarSign size={12} className="shrink-0" /> Credit
                    </p>
                    <p className="font-black text-[#0f172a] text-sm sm:text-lg mt-0.5">{formatPrice(shop.currentCredit)}</p>
                  </div>
                  <div className="p-4 bg-white/50 rounded-2xl border border-white/60">
                    <p className="text-[0.65rem] text-gray-500 font-bold uppercase flex items-center gap-1">
                      <CheckCircle2 size={12} className="shrink-0" /> Delivered
                    </p>
                    <p className="font-black text-[#0f172a] text-sm sm:text-lg mt-0.5">{shop.deliveredOrders}</p>
                  </div>
                  <div className="p-4 bg-white/50 rounded-2xl border border-white/60">
                    <p className="text-[0.65rem] text-gray-500 font-bold uppercase flex items-center gap-1">
                      <Clock size={12} className="shrink-0" /> Pending
                    </p>
                    <p className="font-black text-[#0f172a] text-sm sm:text-lg mt-0.5">{shop.pendingOrders}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6 space-y-4 bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[2rem] p-4 sm:p-5 shadow-sm max-w-full overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <h2 className="text-lg sm:text-xl font-black text-[#0f172a] uppercase tracking-wide flex items-center gap-2">
                    <FileText size={20} className="shrink-0" /> SHOP INVOICES
                  </h2>

                  <div className="relative max-w-full lg:max-w-sm w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => handleSearchChange(e.target.value)}
                      placeholder="SEARCH ORDER ID OR ITEM..."
                      className="w-full pl-10 pr-4 py-3 bg-white/70 border border-white/80 rounded-full text-xs font-bold text-[#0f172a] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/30 uppercase shadow-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-gray-200/50">
                  <div className="flex items-center gap-1.5 bg-white/70 border border-white/80 rounded-xl px-3 py-1.5 text-xs font-bold text-[#0f172a]">
                    <Calendar size={14} className="text-gray-500 shrink-0" />
                    <span className="text-[0.65rem] font-black uppercase shrink-0">FROM:</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={e => handleFromDateChange(e.target.value)}
                      className="bg-transparent focus:outline-none uppercase text-xs font-bold max-w-[130px]"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 bg-white/70 border border-white/80 rounded-xl px-3 py-1.5 text-xs font-bold text-[#0f172a]">
                    <span className="text-[0.65rem] font-black uppercase shrink-0">TO:</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={e => handleToDateChange(e.target.value)}
                      className="bg-transparent focus:outline-none uppercase text-xs font-bold max-w-[130px]"
                    />
                  </div>

                  {(fromDate || toDate || searchQuery || activeTab !== 'all') && (
                    <button
                      onClick={resetFilters}
                      className="px-3 py-1.5 bg-white/60 hover:bg-white text-rose-700 border border-rose-200 rounded-xl text-[0.65rem] font-black uppercase flex items-center gap-1 transition-all cursor-pointer shrink-0"
                    >
                      <RefreshCw size={12} /> CLEAR
                    </button>
                  )}
                </div>

                <div className="w-full max-w-full overflow-x-auto pt-2 pb-1 scrollbar-none flex items-center gap-2 shrink-0">
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
                      className={`px-4 py-2.5 rounded-full font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap border shrink-0 cursor-pointer ${activeTab === tab.id
                        ? 'bg-[#0f172a] text-white border-[#0f172a] shadow-md scale-105'
                        : 'bg-white/50 hover:bg-white text-[#0f172a] border-white/60'
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0f172a]"></div>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-16 bg-white/20 backdrop-blur-2xl rounded-[2rem] border border-white/60 shadow-md px-4">
                  <FileText size={36} className="text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-black text-[#0f172a] uppercase mb-1">NO MATCHING INVOICES FOUND</h3>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    TRY ADJUSTING YOUR DATE RANGE, STATUS FILTER, OR SEARCH QUERY
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-8">
                    {orders.map((order) => {
                      const items = order.items || [];
                      const subtotal = order.subtotal || items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
                      const discountAmount = order.discountAmount || (order.discount > 0 ? (subtotal * order.discount / 100) : 0);
                      const discountPercent = order.discount || (subtotal > 0 && discountAmount > 0 ? Math.round((discountAmount / subtotal) * 100) : 0);
                      const total = order.total || (subtotal - discountAmount);
                      const totalPaid = order.totalPaid || 0;
                      const remainingAmount = Math.max(0, total - totalPaid);

                      return (
                        <motion.div
                          key={order.orderId}
                          layout
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 shadow-[0_10px_35px_rgba(0,0,0,0.04)] hover:border-white/90 transition-all max-w-full overflow-hidden"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs sm:text-sm font-black text-[#0f172a] uppercase bg-white/80 border border-white/80 px-3 py-1 rounded-full shadow-xs">
                                  {order.orderId}
                                </span>
                                {getStatusBadge(order.status)}
                                <span className="px-3 py-1 bg-slate-100/90 text-slate-700 border border-slate-200/80 rounded-full text-[0.65rem] font-black uppercase shadow-xs shrink-0">
                                  {items.length} {items.length === 1 ? 'ITEM' : 'ITEMS'}
                                </span>
                              </div>
                              <p className="text-[0.7rem] text-gray-500 font-bold uppercase mt-1">
                                DATE: {new Date(order.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 sm:gap-5 text-xs font-bold pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-200/60">
                              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                                <div>
                                  <span className="text-gray-500 uppercase block text-[0.65rem]">SUBTOTAL</span>
                                  <span className="text-[#0f172a] font-black">{formatPrice(subtotal)}</span>
                                </div>
                                {(discountAmount > 0 || discountPercent > 0) && (
                                  <div>
                                    <span className="text-gray-500 uppercase block text-[0.65rem]">DISCOUNT ({discountPercent}%)</span>
                                    <span className="text-rose-600 font-black">-{formatPrice(discountAmount)}</span>
                                  </div>
                                )}
                                <div>
                                  <span className="text-gray-500 uppercase block text-[0.65rem]">TOTAL</span>
                                  <span className="text-[#0f172a] font-black text-sm">{formatPrice(total)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 uppercase block text-[0.65rem]">PAID</span>
                                  <span className="text-green-700 font-black">{formatPrice(totalPaid)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 uppercase block text-[0.65rem]">REMAINING</span>
                                  <span className="text-rose-700 font-black">{formatPrice(remainingAmount)}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 w-full sm:w-auto mt-2 lg:mt-0 shrink-0">
                                <Link
                                  href={`/settings/invoices/default?orderId=${order.orderId}`}
                                  className="px-4 py-2.5 bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase tracking-wider rounded-full shadow-md transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
                                >
                                  <ExternalLink size={14} /> VIEW DETAILS
                                </Link>
                                <button
                                  onClick={() => setSelectedInvoice(order)}
                                  className="px-4 py-2.5 bg-white hover:bg-gray-100 text-[#0f172a] font-black text-xs uppercase tracking-wider rounded-full border border-gray-300 shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-1 sm:flex-initial"
                                >
                                  <Eye size={14} /> PREVIEW PDF
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

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

          <InvoicePdfModal
            order={selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
          />

        </div>
      </main>
    </>
  );
}
