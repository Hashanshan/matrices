'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/header';
import { useAuth } from '@/lib/contexts/auth-context';
import Pagination from '@/components/pagination';
import { motion } from 'framer-motion';
import {
  ShoppingBag, Search, Plus, Trash2, Edit3, Clock,
  RefreshCw, Store, FileText, Heart, ShieldCheck, Calendar, MapPin, Phone
} from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { formatPrice } from '@/lib/currency';
import { offlineDB } from '@/lib/offline/indexed-db';
import { deleteSyncQueueItem, getSyncQueue } from '@/lib/offline/pending-sync';

export interface LocalOrderItem {
  productId?: string;
  productID?: string;
  productCode?: string;
  name: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  note?: string;
}

export interface LocalOrder {
  id: string;
  orderId: string;
  shop: {
    shopId: string;
    name: string;
    phone?: string;
    address?: string;
  };
  items: LocalOrderItem[];
  subtotal: number;
  discount: number;
  discountAmount: number;
  total: number;
  orderDate: string;
  createdAt: string;
  updatedAt?: string;
  status: string;
  isSynced: boolean;
  liveOrderId?: string;
  queueId?: string;
  notes?: string;
}

export default function SettingsOrdersPage() {
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [localOrders, setLocalOrders] = useState<LocalOrder[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);

  // Fetch local IndexedDB orders (ONLY unsynced / local draft orders!)
  const loadLocalOrders = useCallback(async () => {
    setLoadingLocal(true);
    try {
      const rawOrders = await offlineDB.getAll<LocalOrder>('orders').catch(() => []);
      // Filter strictly for local draft / unsynced orders
      const unsyncedOnly = (rawOrders || []).filter(o => !o.isSynced);

      // Sort newest first
      const sorted = unsyncedOnly.sort((a, b) =>
        new Date(b.createdAt || b.orderDate || 0).getTime() - new Date(a.createdAt || a.orderDate || 0).getTime()
      );
      setLocalOrders(sorted);
    } catch (err) {
      console.error('Failed to load local orders:', err);
    } finally {
      setLoadingLocal(false);
    }
  }, []);

  useEffect(() => {
    loadLocalOrders();
  }, [loadLocalOrders]);

  // Listen to sync queue events to refresh local orders automatically
  useEffect(() => {
    const handleSyncEvent = () => {
      loadLocalOrders();
    };
    window.addEventListener('matrices-sync-queue-updated', handleSyncEvent);
    return () => window.removeEventListener('matrices-sync-queue-updated', handleSyncEvent);
  }, [loadLocalOrders]);

  let allOrdersList = [...localOrders];

  // Apply search query filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    allOrdersList = allOrdersList.filter(o =>
      (o.orderId || '').toLowerCase().includes(q) ||
      (o.shop?.name || '').toLowerCase().includes(q) ||
      (o.shop?.shopId || '').toLowerCase().includes(q) ||
      (o.items || []).some(it => (it.name || '').toLowerCase().includes(q))
    );
  }

  const limit = 10;
  const totalRecords = allOrdersList.length;
  const totalPages = Math.ceil(totalRecords / limit) || 1;
  const paginatedOrders = allOrdersList.slice((page - 1) * limit, page * limit);

  // Handle Order Deletion (Local / Unsynced ONLY)
  const handleDeleteOrder = async (order: LocalOrder) => {
    const result = await Swal.fire({
      title: 'Delete Unsynced Order?',
      text: `Are you sure you want to delete local order ${order.orderId || order.id}? This will remove it from IndexedDB and cancel its pending push to live DB.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete Order',
    });

    if (result.isConfirmed) {
      try {
        // 1. Delete from IndexedDB
        await offlineDB.deleteById('orders', order.id);

        // 2. Remove matching item from sync_queue
        const queue = await getSyncQueue();
        const matchingItem = queue.find(q => q.entityId === order.id || (q.payload && q.payload.id === order.id));
        if (matchingItem) {
          await deleteSyncQueueItem(matchingItem.id);
        }

        // 3. Refresh list
        await loadLocalOrders();

        Swal.fire({
          icon: 'success',
          title: 'Order Deleted',
          text: 'The local draft order has been removed.',
          timer: 2000,
          showConfirmButton: false,
        });
      } catch (err) {
        console.error('Failed to delete local order:', err);
        Swal.fire('Error', 'Failed to delete order from local database.', 'error');
      }
    }
  };

  return (
    <div className="min-h-screen pb-16">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[2.5rem] p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
          
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#0f172a] text-white rounded-2xl shadow-md">
                  <ShoppingBag size={24} />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-[#0f172a] tracking-tight uppercase">
                    MY LOCAL ORDERS
                  </h1>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Unsynced Local Draft Orders (Synced orders are listed under Invoices)
                  </p>
                </div>
              </div>
            </div>

            {/* Actions & Settings Nav Links */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/settings/orders/create"
                className="bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase tracking-wider px-5 py-3 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Plus size={16} /> ADD NEW ORDER
              </Link>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none max-w-full shrink-0">
                <Link
                  href="/settings/sync"
                  className="text-xs font-black uppercase bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3.5 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RefreshCw size={14} className="text-emerald-600" /> SYNC
                </Link>
                <Link
                  href="/settings/shops"
                  className="text-xs font-black uppercase bg-white/60 hover:bg-white border border-white/60 text-[#0f172a] px-3.5 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Store size={14} /> SHOPS
                </Link>
                <span className="text-xs font-black uppercase bg-[#0f172a] text-white border border-[#0f172a] px-3.5 py-2.5 rounded-full shadow-xs flex items-center gap-1.5 whitespace-nowrap shrink-0">
                  <ShoppingBag size={14} /> ORDERS ({allOrdersList.length})
                </span>
                <Link
                  href="/settings/invoices"
                  className="text-xs font-black uppercase bg-white/60 hover:bg-white border border-white/60 text-[#0f172a] px-3.5 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <FileText size={14} /> INVOICES
                </Link>
                <Link
                  href="/settings/wishlist"
                  className="text-xs font-black uppercase bg-white/60 hover:bg-white border border-white/60 text-[#0f172a] px-3.5 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Heart size={14} fill="#ef4444" className="text-red-500" /> WISHLIST
                </Link>
                <Link
                  href="/settings/security"
                  className="text-xs font-black uppercase bg-white/60 hover:bg-white border border-white/60 text-[#0f172a] px-3.5 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <ShieldCheck size={14} /> SECURITY
                </Link>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="SEARCH LOCAL ORDERS BY ID, SHOP, PRODUCT..."
                className="w-full pl-11 pr-4 py-3 bg-white/50 backdrop-blur-xl border border-white/60 rounded-full text-xs font-bold text-[#0f172a] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/30 shadow-sm uppercase"
              />
            </div>
          </div>

          {/* Orders List */}
          {loadingLocal ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#0f172a] border-t-transparent"></div>
              <p className="mt-4 text-xs font-black uppercase text-gray-500">Loading Local Draft Orders...</p>
            </div>
          ) : paginatedOrders.length === 0 ? (
            <div className="py-20 text-center bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 p-8">
              <ShoppingBag size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-base font-black text-[#0f172a] uppercase">No Local Draft Orders Found</p>
              <p className="text-xs font-bold text-gray-400 mt-1 uppercase max-w-sm mx-auto">
                {searchQuery ? 'No draft orders match your search criteria.' : 'No unsynced orders in local DB. Click "+ ADD NEW ORDER" to create one.'}
              </p>
              <Link
                href="/settings/orders/create"
                className="mt-5 inline-flex items-center gap-2 bg-[#0f172a] text-white font-black text-xs uppercase px-6 py-3 rounded-full shadow-md hover:bg-[#1e293b] transition-all"
              >
                <Plus size={16} /> Create New Order
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedOrders.map((ord) => (
                <motion.div
                  key={ord.id || ord.orderId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/80 backdrop-blur-xl border border-white/90 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Left Details */}
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-sm font-black text-[#0f172a] font-mono uppercase bg-gray-100 px-3 py-1 rounded-xl">
                          {ord.orderId || ord.id}
                        </span>

                        <span className="text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                          <Clock size={13} className="text-amber-600" /> Local Draft (Unsynced)
                        </span>

                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                          <Calendar size={13} />
                          {new Date(ord.orderDate || ord.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Shop Information */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 font-bold">
                        <span className="font-black text-[#0f172a] text-sm uppercase flex items-center gap-1.5">
                          <Store size={16} className="text-blue-600" />
                          {ord.shop?.name || 'Customer Shop'}
                          {ord.shop?.shopId && (
                            <span className="text-[11px] font-mono text-gray-400">({ord.shop.shopId})</span>
                          )}
                        </span>
                        {ord.shop?.phone && (
                          <span className="flex items-center gap-1 text-gray-500">
                            <Phone size={12} /> {ord.shop.phone}
                          </span>
                        )}
                        {ord.shop?.address && (
                          <span className="flex items-center gap-1 text-gray-500 truncate max-w-xs">
                            <MapPin size={12} /> {ord.shop.address}
                          </span>
                        )}
                      </div>

                      {/* Items Summary */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs font-extrabold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200/60">
                          {(ord.items || []).length} {ord.items?.length === 1 ? 'ITEM' : 'ITEMS'}
                        </span>
                        {(ord.items || []).slice(0, 3).map((it, idx) => (
                          <span key={idx} className="text-[11px] font-bold text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
                            {it.name} ({it.quantity}x)
                          </span>
                        ))}
                        {(ord.items || []).length > 3 && (
                          <span className="text-[11px] font-extrabold text-gray-400">
                            +{(ord.items || []).length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Totals & Actions */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                      <div className="text-left sm:text-right">
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">Total Amount</p>
                        <p className="text-xl font-black text-[#0f172a]">{formatPrice(ord.total || 0)}</p>
                        {ord.discount > 0 && (
                          <p className="text-[10px] font-black text-emerald-600 uppercase">
                            Includes {ord.discount}% Discount (-{formatPrice(ord.discountAmount)})
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/settings/orders/create?editId=${encodeURIComponent(ord.id)}`}
                          className="px-4 py-2 bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-black uppercase rounded-full shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                        >
                          <Edit3 size={14} /> EDIT
                        </Link>

                        <button
                          onClick={() => handleDeleteOrder(ord)}
                          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 text-xs font-black uppercase rounded-full border border-red-200 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                        >
                          <Trash2 size={14} /> DELETE
                        </button>
                      </div>
                    </div>

                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
