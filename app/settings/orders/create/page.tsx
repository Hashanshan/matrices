'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Header from '@/components/header';
import { useAuth } from '@/lib/contexts/auth-context';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Plus, Minus, Trash2, Search, X, Store, Calendar,
  ArrowLeft, User, Percent, Save, Clock
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Swal from 'sweetalert2';
import { formatPrice } from '@/lib/currency';
import { resolveApiUrl, getAuthToken } from '@/lib/utils';
import { offlineDB } from '@/lib/offline/indexed-db';
import { addToSyncQueue, getSyncQueue, updateSyncQueueItem } from '@/lib/offline/pending-sync';

interface ShopOption {
  shopId: string;
  name: string;
  phone?: string;
  address?: string;
}

interface ProductItem {
  id: string;
  productId: string;
  name: string;
  sellPrice: number;
  price: number;
  image?: string;
}

interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  originalPrice: number;
  note?: string;
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

const productsFetcher = async (url: string) => {
  const mode = typeof window !== 'undefined' ? (localStorage.getItem('matrices_data_mode') as string) : 'online';
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const getOfflineProducts = async () => {
    const rawProducts = await offlineDB.getAll<any>('products').catch(() => []);
    const mtxProducts = rawProducts.filter((p: any) =>
      /^MTX-/i.test(p.productId || p.id || '')
    );
    return { success: true, data: mtxProducts };
  };

  if (mode === 'offline' || isOffline) {
    return await getOfflineProducts();
  }

  const token = getAuthToken();
  const targetUrl = resolveApiUrl(url);
  try {
    const res = await fetch(targetUrl, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  } catch {
    return await getOfflineProducts();
  }
};

function CreateOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId');

  const { user } = useAuth();

  // State
  const [selectedShop, setSelectedShop] = useState<ShopOption | null>(null);
  const [orderDate, setOrderDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Product Selection Modal State & Refs
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductForAdd, setSelectedProductForAdd] = useState<ProductItem | null>(null);
  const [addQuantity, setAddQuantity] = useState<number>(1);
  const [addNote, setAddNote] = useState<string>('');

  const modalSearchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  // Fetch assigned shops (includes offline shops)
  const { data: shopsData, isLoading: loadingShops } = useSWR(
    '/api/shops?limit=100',
    shopsFetcher
  );

  const [allShops, setAllShops] = useState<ShopOption[]>([]);

  useEffect(() => {
    async function mergeShops() {
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

  // Fetch MTX- Products ONLY
  const productQuery = new URLSearchParams();
  productQuery.set('limit', '100');
  productQuery.set('mtxOnly', 'true');
  if (productSearch) productQuery.set('search', productSearch);

  const { data: productsData, isLoading: loadingProducts } = useSWR(
    `/api/products?${productQuery.toString()}`,
    productsFetcher
  );

  // Filter products matching /^MTX-/i
  const rawProductsList: ProductItem[] = (productsData?.data || []).map((p: any) => ({
    id: p.id || p._id || p.productId,
    productId: p.productId || p.productCode || p.id,
    name: p.name || 'Product',
    sellPrice: Number(p.sellPrice || p.price || 0),
    price: Number(p.sellPrice || p.price || 0),
    image: p.image || '',
  }));

  const mtxFilteredProducts = rawProductsList.filter(p =>
    /^MTX-/i.test(p.productId) || /^MTX-/i.test(p.id)
  );

  // Load order data if in Edit Mode
  useEffect(() => {
    if (editId) {
      offlineDB.getOne<any>('orders', editId).then((ord) => {
        if (ord && !ord.isSynced) {
          setSelectedShop(ord.shop || null);
          if (ord.orderDate) setOrderDate(new Date(ord.orderDate).toISOString().split('T')[0]);
          setOrderItems(ord.items || []);
          setDiscount(ord.discount || 0);
          setNotes(ord.notes || '');
        } else if (ord?.isSynced) {
          Swal.fire('Locked', 'This order has already been synced to live DB and cannot be edited.', 'info');
          router.replace('/settings/orders');
        }
      });
    }
  }, [editId, router]);

  // Focus modal search input on open
  useEffect(() => {
    if (isProductModalOpen && !selectedProductForAdd) {
      setTimeout(() => {
        modalSearchInputRef.current?.focus();
      }, 100);
    }
  }, [isProductModalOpen, selectedProductForAdd]);

  // Auto-focus quantity input after selecting a product
  useEffect(() => {
    if (selectedProductForAdd) {
      setTimeout(() => {
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
      }, 100);
    }
  }, [selectedProductForAdd]);

  // Calculations
  const calculateSubtotal = () =>
    orderItems.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const calculateDiscountAmount = () => (calculateSubtotal() * discount) / 100;
  const calculateTotal = () => calculateSubtotal() - calculateDiscountAmount();

  // Select Product (Hides search list and opens Quantity view)
  const handleSelectProduct = (product: ProductItem) => {
    setSelectedProductForAdd(product);
    setAddQuantity(1);
    setAddNote('');
  };

  // Confirm Add Product to Order using unique combo key (productId + note)
  const handleConfirmAddProduct = () => {
    if (!selectedProductForAdd) return;

    const qty = Math.max(1, addQuantity);
    const unitPrice = selectedProductForAdd.sellPrice;
    const cleanNote = addNote.trim();

    const newItem: OrderItem = {
      productId: selectedProductForAdd.productId,
      name: selectedProductForAdd.name,
      quantity: qty,
      price: unitPrice,
      originalPrice: selectedProductForAdd.sellPrice,
      note: cleanNote,
    };

    // Item combo matching: Check if exact same productId AND note combination exists
    const comboKey = (pId: string, n?: string) => `${pId}___${(n || '').trim().toLowerCase()}`;
    const targetKey = comboKey(newItem.productId, newItem.note);

    const existingIndex = orderItems.findIndex(
      it => comboKey(it.productId, it.note) === targetKey
    );

    if (existingIndex >= 0) {
      const updated = [...orderItems];
      updated[existingIndex].quantity += qty;
      setOrderItems(updated);
    } else {
      setOrderItems(prev => [...prev, newItem]);
    }

    // Reset product selection view so user can search & pick next product fast
    setSelectedProductForAdd(null);
    setAddQuantity(1);
    setAddNote('');
    setProductSearch('');

    setTimeout(() => {
      modalSearchInputRef.current?.focus();
    }, 100);
  };

  const handleUpdateItemQuantity = (index: number, delta: number) => {
    setOrderItems(prev =>
      prev.map((item, i) => {
        if (i === index) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index));
  };

  // Submit Save Order to Local DB
  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedShop) {
      Swal.fire('Shop Required', 'Please select a shop for this order.', 'warning');
      return;
    }

    if (orderItems.length === 0) {
      Swal.fire('Items Required', 'Please add at least one product to the order.', 'warning');
      return;
    }

    setIsSubmitting(true);

    try {
      const subtotalVal = calculateSubtotal();
      const discountAmountVal = calculateDiscountAmount();
      const totalVal = calculateTotal();

      const localOrderId = editId || `LOCAL_ORD_${Date.now()}`;
      const displayOrderId = editId ? editId : `DRAFT-${Math.floor(1000 + Math.random() * 9000)}`;

      const orderPayload = {
        id: localOrderId,
        orderId: displayOrderId,
        shop: {
          shopId: selectedShop.shopId,
          name: selectedShop.name,
          phone: selectedShop.phone || '',
          address: selectedShop.address || '',
        },
        salesrep: {
          id: user?.id || '',
          name: user?.name || 'Salesrep',
          email: user?.email || '',
        },
        items: orderItems,
        subtotal: subtotalVal,
        discount,
        discountAmount: discountAmountVal,
        total: totalVal,
        orderDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
        isSynced: false,
        notes,
      };

      // 1. Save to IndexedDB orders store
      await offlineDB.upsert('orders', orderPayload);

      // 2. Add or update queue item in sync_queue
      if (editId) {
        const queue = await getSyncQueue();
        const existingQueueItem = queue.find(q => q.entityId === editId);
        if (existingQueueItem) {
          existingQueueItem.payload = orderPayload;
          await updateSyncQueueItem(existingQueueItem);
        } else {
          await addToSyncQueue({
            operation: 'CREATE',
            entity: 'Order',
            entityId: localOrderId,
            endpoint: '/api/orders/create',
            method: 'POST',
            payload: orderPayload,
            title: `Create Order - ${selectedShop.name}`,
          });
        }
      } else {
        await addToSyncQueue({
          operation: 'CREATE',
          entity: 'Order',
          entityId: localOrderId,
          endpoint: '/api/orders/create',
          method: 'POST',
          payload: orderPayload,
          title: `Create Order - ${selectedShop.name}`,
        });
      }

      Swal.fire({
        icon: 'success',
        title: editId ? 'Order Updated Locally' : 'Order Saved to Local DB',
        text: 'Saved to local IndexedDB and queued in SyncQueue for live server push.',
        timer: 2000,
        showConfirmButton: false,
      });

      router.push('/settings/orders');
    } catch (err) {
      console.error('Failed to save order locally:', err);
      Swal.fire('Error', 'Failed to save order to local storage.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pb-16">
      <Header
        showSearch={false}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="bg-white/70 backdrop-blur-2xl border border-white/80 rounded-[2.5rem] p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08)]">

          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Link
                href="/settings/orders"
                className="p-2.5 bg-gray-100 hover:bg-gray-200 text-[#0f172a] rounded-full transition-all cursor-pointer"
              >
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-[#0f172a] uppercase tracking-tight">
                  {editId ? 'EDIT DRAFT ORDER' : 'CREATE NEW ORDER'}
                </h1>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Offline-First Local Order Creation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-900 bg-amber-100 border border-amber-300 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 uppercase">
                <Clock size={14} className="text-amber-600" /> Local Draft Mode
              </span>
            </div>
          </div>

          <form onSubmit={handleSaveOrder} className="space-y-6">

            {/* Salesrep & Order Date Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Auto-Assigned Salesrep Card */}
              <div className="bg-white/80 border border-white/90 rounded-3xl p-5 shadow-xs space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={14} className="text-blue-600" /> Sales Representative (Auto-Assigned)
                </label>
                <div className="flex items-center justify-between bg-gray-50/80 border border-gray-200 rounded-2xl p-3.5">
                  <div>
                    <p className="text-sm font-black text-[#0f172a] uppercase">{user?.name || 'Logged-in Salesrep'}</p>
                    <p className="text-xs font-bold text-gray-400">{user?.email || 'salesrep@matrices.com'}</p>
                  </div>
                  <span className="text-[10px] font-mono font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full uppercase">
                    Auto Assigned
                  </span>
                </div>
              </div>

              {/* Order Date */}
              <div className="bg-white/80 border border-white/90 rounded-3xl p-5 shadow-xs space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-600" /> Order Date
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={e => setOrderDate(e.target.value)}
                  className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl p-3.5 text-sm font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                />
              </div>

            </div>

            {/* Shop Selection Field (Styling matching user screenshot 1!) */}
            <div className="bg-white/80 border border-white/90 rounded-3xl p-5 shadow-xs space-y-3">
              <label className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Store size={14} className="text-blue-600" /> SELECT CUSTOMER SHOP *
              </label>

              {loadingShops ? (
                <div className="p-3 text-xs font-bold text-gray-400 uppercase animate-pulse">Loading shops...</div>
              ) : (
                <select
                  value={selectedShop?.shopId || ''}
                  onChange={e => {
                    const found = allShops.find(s => s.shopId === e.target.value);
                    setSelectedShop(found || null);
                  }}
                  className="w-full bg-gray-50/80 border border-gray-300 rounded-2xl p-4 text-sm font-black text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 uppercase shadow-xs cursor-pointer"
                >
                  <option value="">-- SELECT SHOP ASSIGNED TO YOU --</option>
                  {allShops.map(s => (
                    <option key={s.shopId} value={s.shopId}>
                      {s.name} ({s.shopId}) {s.address ? `- ${s.address}` : ''}
                    </option>
                  ))}
                </select>
              )}

              {selectedShop && (
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between text-xs text-blue-900 font-bold">
                  <span>Selected Shop: <strong className="uppercase font-black">{selectedShop.name}</strong> ({selectedShop.shopId})</span>
                  {selectedShop.phone && <span>Phone: {selectedShop.phone}</span>}
                </div>
              )}
            </div>

            {/* Order Items Table Section */}
            <div className="bg-white/80 border border-white/90 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-[#0f172a] uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag size={16} /> ORDER ITEMS ({orderItems.length})
                </h3>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedProductForAdd(null);
                    setProductSearch('');
                    setIsProductModalOpen(true);
                  }}
                  className="bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-black uppercase px-4 py-2.5 rounded-full shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Plus size={14} /> ADD PRODUCT
                </button>
              </div>

              {orderItems.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-2xl">
                  <ShoppingBag size={36} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-xs font-black text-gray-400 uppercase">No products added to order yet</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductForAdd(null);
                      setProductSearch('');
                      setIsProductModalOpen(true);
                    }}
                    className="mt-3 text-xs font-black text-blue-600 underline uppercase cursor-pointer"
                  >
                    Click "+ ADD PRODUCT" to search MTX products
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-400 uppercase font-black tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">MTX ID</th>
                        <th className="py-2.5 px-3">Price</th>
                        <th className="py-2.5 px-3">Quantity</th>
                        <th className="py-2.5 px-3">Subtotal</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-bold text-[#0f172a]">
                      {orderItems.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50/50">
                          <td className="py-3 px-3">
                            <p className="font-black uppercase">{item.name}</p>
                            {item.note && <p className="text-[10px] text-blue-600 font-bold mt-0.5">Note: {item.note}</p>}
                          </td>
                          <td className="py-3 px-3 font-mono text-gray-500 uppercase font-bold">
                            {item.productId}
                          </td>
                          <td className="py-3 px-3">{formatPrice(item.price)}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(index, -1)}
                                className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-700 font-black cursor-pointer"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="w-8 text-center font-black">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(index, 1)}
                                className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-700 font-black cursor-pointer"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-black">
                            {formatPrice(item.price * item.quantity)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pricing Summary & Discount Card */}
            <div className="bg-white/80 border border-white/90 rounded-3xl p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-[#0f172a] uppercase tracking-wider flex items-center gap-2">
                <Percent size={16} /> ORDER SUMMARY
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Notes Input */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-wider">
                    Special Notes / Instructions
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Enter order notes or special instructions..."
                    className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl p-3 text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                  />
                </div>

                {/* Totals Breakdown */}
                <div className="bg-gray-50/80 border border-gray-200 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between text-xs font-bold text-gray-600 uppercase">
                    <span>Subtotal ({orderItems.reduce((acc, i) => acc + i.quantity, 0)} units):</span>
                    <span className="font-black text-[#0f172a]">{formatPrice(calculateSubtotal())}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-gray-600 uppercase">
                    <span>Discount (%):</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discount}
                      onChange={e => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                      className="w-20 bg-white border border-gray-300 rounded-xl px-2.5 py-1 text-right font-black text-[#0f172a]"
                    />
                  </div>

                  {discount > 0 && (
                    <div className="flex justify-between text-xs font-extrabold text-emerald-600 uppercase">
                      <span>Discount Amount ({discount}%):</span>
                      <span>-{formatPrice(calculateDiscountAmount())}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-200 flex justify-between text-base font-black text-[#0f172a] uppercase">
                    <span>Grand Total:</span>
                    <span className="text-lg text-emerald-700">{formatPrice(calculateTotal())}</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                href="/settings/orders"
                className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs uppercase rounded-full transition-all"
              >
                CANCEL
              </Link>

              <button
                type="submit"
                disabled={isSubmitting || orderItems.length === 0 || !selectedShop}
                className="px-8 py-3.5 bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Save size={16} /> {editId ? 'UPDATE LOCAL ORDER' : 'SAVE ORDER (LOCAL DB)'}
              </button>
            </div>

          </form>

        </div>
      </main>

      {/* ───── ADD PRODUCT MODAL (Matching User Screenshot 2 & Project Fast-Add Workflow!) ───── */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col overflow-hidden border border-gray-200"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-black text-[#0f172a] uppercase tracking-tight">ADD PRODUCT</h2>
                  <p className="text-xs font-bold text-gray-400">Search and select an MTX product</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsProductModalOpen(false); setSelectedProductForAdd(null); }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* VIEW 1: SEARCH PRODUCT LIST (Shown when no product is selected yet) */}
              {!selectedProductForAdd ? (
                <>
                  {/* Product Search Input (With Enter Key Fast Selection!) */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      ref={modalSearchInputRef}
                      type="text"
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (mtxFilteredProducts.length > 0) {
                            handleSelectProduct(mtxFilteredProducts[0]);
                          }
                        }
                      }}
                      placeholder="Search products..."
                      className="w-full pl-11 pr-4 py-3.5 bg-gray-50/80 border border-gray-300 rounded-2xl text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 shadow-xs"
                    />
                  </div>

                  {/* Product Search Cards List (Matching Screenshot 2 exact design!) */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[360px]">
                    {loadingProducts ? (
                      <div className="py-12 text-center text-xs font-bold text-gray-400 uppercase animate-pulse">Loading MTX products...</div>
                    ) : mtxFilteredProducts.length === 0 ? (
                      <div className="py-12 text-center text-xs font-bold text-gray-400 uppercase">
                        No MTX products found
                      </div>
                    ) : (
                      mtxFilteredProducts.map((product) => (
                        <div
                          key={product.id}
                          onClick={() => handleSelectProduct(product)}
                          className="p-4 border border-gray-200 rounded-2xl hover:border-[#0f172a] hover:bg-gray-50/80 transition-all cursor-pointer group flex items-center justify-between bg-white"
                        >
                          <div className="space-y-1">
                            <h4 className="text-sm font-black text-[#0f172a] uppercase tracking-wide">
                              {product.name}
                            </h4>
                            <p className="text-sm font-black text-slate-700">
                              Rs.{product.sellPrice}
                            </p>
                            {/* ONLY ID: MTX-XXXX IS SHOWN (Code & buyPrice are removed!) */}
                            <p className="text-xs font-bold text-gray-400">
                              ID: <strong className="text-gray-600 font-mono">{product.productId}</strong>
                            </p>
                          </div>

                          <div className="w-9 h-9 bg-gray-100 group-hover:bg-[#0f172a] group-hover:text-white text-gray-700 rounded-xl flex items-center justify-center transition-colors">
                            <Plus size={18} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                /* VIEW 2: SELECTED PRODUCT QUANTITY & NOTE CONFIG VIEW (Search bar is hidden as requested!) */
                <div className="space-y-4 pt-2">
                  <div className="p-4 bg-gray-50/90 rounded-2xl border border-gray-200 space-y-1">
                    <h4 className="text-base font-black text-[#0f172a] uppercase">{selectedProductForAdd.name}</h4>
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-gray-500 font-mono">ID: {selectedProductForAdd.productId}</span>
                      <span className="text-emerald-700 font-black text-sm">Rs.{selectedProductForAdd.sellPrice}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Quantity Input (Auto-focused, Enter adds item, ArrowDown moves to note!) */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-gray-500 uppercase">Quantity *</label>
                      <input
                        ref={quantityInputRef}
                        type="number"
                        min="1"
                        value={addQuantity}
                        onChange={e => setAddQuantity(parseInt(e.target.value, 10) || 1)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleConfirmAddProduct();
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            noteInputRef.current?.focus();
                            noteInputRef.current?.select();
                          }
                        }}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-black text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                      />
                    </div>

                    {/* Price Display (Read-only, stylish, easy to use!) */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-gray-500 uppercase">Unit Price</label>
                      <div className="w-full bg-gray-100/90 border border-gray-200 rounded-xl p-3 text-sm font-black text-[#0f172a]">
                        Rs. {selectedProductForAdd.sellPrice}
                      </div>
                    </div>
                  </div>

                  {/* Note Input (ArrowUp moves back to quantity, Enter adds item!) */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-gray-500 uppercase">Item Note (Optional)</label>
                    <input
                      ref={noteInputRef}
                      type="text"
                      value={addNote}
                      onChange={e => setAddNote(e.target.value)}
                      placeholder="e.g. Special size or packaging note..."
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleConfirmAddProduct();
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          quantityInputRef.current?.focus();
                          quantityInputRef.current?.select();
                        }
                      }}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setSelectedProductForAdd(null)}
                      className="w-1/2 py-3.5 bg-gray-100 text-gray-700 font-black text-xs uppercase rounded-full hover:bg-gray-200 transition-all cursor-pointer"
                    >
                      BACK TO SEARCH
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAddProduct}
                      className="w-1/2 py-3.5 bg-[#0f172a] text-white font-black text-xs uppercase rounded-full hover:bg-[#1e293b] shadow-md transition-all cursor-pointer active:scale-95"
                    >
                      ADD TO ORDER (ENTER)
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CreateOrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[url(/bg.png)] bg-cover bg-center bg-no-repeat bg-fixed flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
      </div>
    }>
      <CreateOrderContent />
    </Suspense>
  );
}
