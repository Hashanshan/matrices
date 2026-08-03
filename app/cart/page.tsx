'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/contexts/cart-context';
import { useAuth } from '@/lib/contexts/auth-context';
import PinModal from '@/components/pin-modal';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ShoppingBag, Store, Plus, Minus, Check, ArrowLeft, RefreshCw, Save, XCircle, Search, X } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Header from '@/components/header';
import { formatPrice } from '@/lib/currency';
import Swal from 'sweetalert2';
import useSWR from 'swr';
import { resolveApiUrl, getAuthToken } from '@/lib/utils';
import { offlineDB } from '@/lib/offline/indexed-db';

interface ProductItem {
  id: string;
  productId: string;
  name: string;
  sellPrice: number;
  price: number;
  image?: string;
}

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

export default function CartPage() {
  const router = useRouter();
  const {
    cart,
    selectedShop,
    openShopModal,
    addToCart,
    removeFromCart,
    updateCartItem,
    clearCart,
    deselectShop,
    submitCartAsLocalOrder,
  } = useCart();
  const { user } = useAuth();

  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Security PIN modal for deselecting shop
  const [showDeselectPinModal, setShowDeselectPinModal] = useState(false);

  // Product Add Modal inside Cart Page
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductForAdd, setSelectedProductForAdd] = useState<ProductItem | null>(null);
  const [addQuantity, setAddQuantity] = useState<number>(1);
  const [addNote, setAddNote] = useState<string>('');

  const modalSearchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  // Fetch MTX- Products
  const productQuery = new URLSearchParams();
  productQuery.set('limit', '100');
  productQuery.set('mtxOnly', 'true');
  if (productSearch) productQuery.set('search', productSearch);

  const { data: productsData, isLoading: loadingProducts } = useSWR(
    isProductModalOpen ? `/api/products?${productQuery.toString()}` : null,
    productsFetcher
  );

  const rawProductsList: ProductItem[] = (productsData?.data || []).map((p: any) => ({
    id: p.id || p._id || p.productId,
    productId: p.productId || p.productCode || p.id,
    name: p.name || 'Product',
    sellPrice: Number(p.sellPrice || p.price || 0),
    price: Number(p.sellPrice || p.price || 0),
    image: p.image || p.imageUrl || p.variants?.colors?.[0]?.image || p.variants?.images?.[0] || '',
  }));

  const mtxFilteredProducts = rawProductsList.filter(p =>
    /^MTX-/i.test(p.productId) || /^MTX-/i.test(p.id)
  );

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

  const handleSelectProduct = (product: ProductItem) => {
    setSelectedProductForAdd(product);
    setAddQuantity(1);
    setAddNote('');
  };

  const handleConfirmAddProduct = () => {
    if (!selectedProductForAdd) return;

    const qty = Math.max(1, addQuantity);
    const unitPrice = selectedProductForAdd.sellPrice;
    const cleanNote = addNote.trim();
    const comboId = `${selectedProductForAdd.productId}_${cleanNote.toLowerCase()}`;

    const newItem = {
      id: comboId,
      productId: selectedProductForAdd.productId,
      name: selectedProductForAdd.name,
      quantity: qty,
      price: unitPrice,
      originalPrice: selectedProductForAdd.sellPrice,
      image: selectedProductForAdd.image || '',
      imageUrl: selectedProductForAdd.image || '',
      notes: cleanNote,
    };

    const success = addToCart(newItem);

    if (success) {
      // Reset view so user can search and add next item fast!
      setSelectedProductForAdd(null);
      setAddQuantity(1);
      setAddNote('');
      setProductSearch('');

      setTimeout(() => {
        modalSearchInputRef.current?.focus();
      }, 100);
    } else {
      // Shop selection required -> close modal
      setIsProductModalOpen(false);
    }
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    const qty = Math.max(1, newQuantity);
    updateCartItem(productId, { quantity: qty });
  };

  // Handle clicking "DESELECT SHOP"
  const handleDeselectShopClick = async () => {
    if (!selectedShop) return;

    if (cart.items.length > 0) {
      const confirmRes = await Swal.fire({
        title: 'Deselect Customer Shop?',
        text: `Deselecting "${selectedShop.name}" will clear all ${cart.items.length} product(s) currently in your cart. Are you sure you want to proceed?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Deselect & Clear Cart',
      });

      if (!confirmRes.isConfirmed) return;
    }

    setShowDeselectPinModal(true);
  };

  const handleDeselectPinSuccess = () => {
    setShowDeselectPinModal(false);
    deselectShop();
    Swal.fire({
      icon: 'success',
      title: 'Shop Deselected',
      text: 'The customer shop has been deselected and cart items cleared.',
      timer: 2000,
      showConfirmButton: false,
    });
  };

  const handleFinalSubmitOrder = async () => {
    if (!selectedShop) {
      Swal.fire({
        title: 'Customer Shop Required',
        text: 'Please select a customer shop before submitting the order.',
        icon: 'warning',
        confirmButtonColor: '#0f172a',
        confirmButtonText: 'Select Shop Now',
      }).then(() => openShopModal());
      return;
    }

    if (cart.items.length === 0) {
      Swal.fire('Cart Empty', 'Your cart is empty. Add products before submitting.', 'warning');
      return;
    }

    setIsSubmitting(true);
    const success = await submitCartAsLocalOrder(discount, notes);
    setIsSubmitting(false);

    if (success) {
      Swal.fire({
        icon: 'success',
        title: 'Order Saved to Local DB!',
        text: `Order for ${selectedShop.name} saved to local IndexedDB and queued for sync.`,
        timer: 2000,
        showConfirmButton: false,
      });

      router.push('/settings/orders');
    }
  };

  const subtotal = cart.total;
  const discountAmount = (subtotal * discount) / 100;
  const grandTotal = subtotal - discountAmount;

  return (
    <>
      <Header showSearch={false} />

      {/* Security PIN Gate Modal for Shop Deselection */}
      <PinModal
        isOpen={showDeselectPinModal}
        onClose={() => setShowDeselectPinModal(false)}
        onSuccess={handleDeselectPinSuccess}
      />

      <main className="min-h-screen bg-[#f8f9fc] pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xs">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#0f172a] uppercase tracking-tight">
                SHOPPING CART
              </h1>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Review & Submit Cart Order to Local Database
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedProductForAdd(null);
                  setProductSearch('');
                  setIsProductModalOpen(true);
                }}
                className="bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-black uppercase tracking-wider px-5 py-3 rounded-full shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Plus size={16} /> ADD PRODUCT
              </button>

              <Link
                href="/catalogue"
                className="text-xs font-black uppercase text-[#0f172a] bg-gray-100 hover:bg-gray-200 px-5 py-3 rounded-full transition-all"
              >
                ← CATALOGUE
              </Link>
            </div>
          </div>

          {/* Active Customer Shop Banner */}
          <div className="bg-white border-2 border-[#0f172a]/10 rounded-[2rem] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-[#0f172a] text-white rounded-2xl shadow-md">
                <Store size={24} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Target Customer Shop for Order
                </span>
                {selectedShop ? (
                  <h2 className="text-base sm:text-lg font-black text-[#0f172a] uppercase">
                    {selectedShop.name} <span className="text-xs font-mono font-bold text-blue-600">({selectedShop.shopId})</span>
                  </h2>
                ) : (
                  <h2 className="text-sm sm:text-base font-black text-amber-600 uppercase">
                    NO SHOP SELECTED YET
                  </h2>
                )}
                {selectedShop?.address && (
                  <p className="text-xs font-bold text-gray-500">{selectedShop.address}</p>
                )}
              </div>
            </div>

            {/* Shop Actions: DESELECT SHOP + CHANGE SHOP */}
            <div className="flex items-center gap-2 flex-wrap">
              {selectedShop && (
                <button
                  type="button"
                  onClick={handleDeselectShopClick}
                  className="px-5 py-3 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 text-xs font-black uppercase rounded-full border border-red-200 shadow-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 active:scale-95"
                >
                  <XCircle size={15} /> DESELECT SHOP
                </button>
              )}

              <button
                type="button"
                onClick={() => openShopModal()}
                className="px-5 py-3 bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-black uppercase rounded-full shadow-sm transition-all cursor-pointer whitespace-nowrap active:scale-95"
              >
                {selectedShop ? 'CHANGE SHOP' : 'SELECT CUSTOMER SHOP'}
              </button>
            </div>
          </div>

          {cart.items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8"
            >
              <ShoppingBag size={48} className="text-gray-300 mb-3" />
              <p className="text-lg text-[#0f172a] font-black uppercase mb-1">Your cart is empty</p>
              <p className="text-xs font-bold text-gray-400 uppercase max-w-sm mb-6">
                Add products using the "+ ADD PRODUCT" button above or from catalogue/gallery pages.
              </p>
              <div className="flex gap-3 flex-wrap justify-center">
                <button
                  onClick={() => {
                    setSelectedProductForAdd(null);
                    setProductSearch('');
                    setIsProductModalOpen(true);
                  }}
                  className="bg-[#0f172a] text-white px-6 py-3.5 rounded-full font-black text-xs uppercase shadow-md hover:bg-[#1e293b] transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus size={16} /> Search & Add Product
                </button>
                <Link href="/catalogue">
                  <Button className="bg-gray-100 hover:bg-gray-200 text-[#0f172a] px-6 py-3.5 rounded-full font-black text-xs uppercase">
                    Browse Catalogue
                  </Button>
                </Link>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Side: Cart Items List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">
                    CART ITEMS ({cart.items.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductForAdd(null);
                      setProductSearch('');
                      setIsProductModalOpen(true);
                    }}
                    className="text-xs font-black text-blue-600 hover:underline uppercase flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={14} /> Add Product to Cart
                  </button>
                </div>

                {cart.items.map((item, index) => {
                  const itemId = item.id || `${item.productId || ''}_${(item.notes || '').trim().toLowerCase()}`;
                  const itemImage = item.image || item.imageUrl || '';
                  const itemName = item.name || 'Product';
                  const itemPrice = item.price || 0;
                  const itemCode = item.productId || item.productCode || '';

                  return (
                    <motion.div
                      key={itemId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white border border-gray-100 shadow-xs rounded-[2rem] p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between"
                    >
                      {/* Left Product Details */}
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden bg-[#f8f9fc] p-2 border border-gray-100 flex items-center justify-center">
                          {itemImage ? (
                            <img
                              src={itemImage}
                              alt={itemName}
                              className="w-full h-full object-contain mix-blend-multiply"
                            />
                          ) : (
                            <ShoppingBag size={28} className="text-gray-300" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <h3 className="font-black text-[#0f172a] text-base uppercase">
                            {itemName}
                          </h3>
                          {itemCode && (
                            <p className="text-xs font-mono font-bold text-gray-400 uppercase">
                              ID: {itemCode}
                            </p>
                          )}
                          <p className="text-sm font-black text-slate-700">
                            {formatPrice(itemPrice)} each
                          </p>
                          {item.notes && (
                            <p className="text-xs text-blue-600 font-bold italic">
                              Note: {item.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right Quantity Controls */}
                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
                        <div className="flex items-center gap-2 border border-gray-200 rounded-full p-1 bg-gray-50">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(itemId, item.quantity - 1)}
                            className="h-8 w-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center font-black text-gray-700 shadow-xs cursor-pointer"
                          >
                            <Minus size={14} />
                          </button>

                          {/* Manually Typable Quantity Input */}
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(itemId, parseInt(e.target.value, 10) || 1)}
                            className="w-12 text-center text-sm font-black text-[#0f172a] bg-transparent focus:outline-none"
                          />

                          <button
                            type="button"
                            onClick={() => handleQuantityChange(itemId, item.quantity + 1)}
                            className="h-8 w-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center font-black text-gray-700 shadow-xs cursor-pointer"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <div className="text-right min-w-[90px]">
                          <p className="text-base font-black text-[#0f172a]">
                            {formatPrice(itemPrice * item.quantity)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(itemId)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                    </motion.div>
                  );
                })}
              </div>

              {/* Right Side: Order Summary & Local Submit */}
              <div className="lg:col-span-1">
                <div className="sticky top-24 bg-white border border-gray-100 shadow-sm rounded-[2rem] p-6 space-y-5">
                  <h2 className="text-lg font-black text-[#0f172a] uppercase border-b border-gray-100 pb-3">
                    CART ORDER SUMMARY
                  </h2>

                  <div className="space-y-3 text-xs font-bold text-gray-600 uppercase">
                    <div className="flex justify-between">
                      <span>Subtotal ({cart.items.length} items):</span>
                      <span className="font-black text-[#0f172a]">{formatPrice(subtotal)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Discount (%):</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={discount}
                        onChange={(e) => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                        className="w-20 bg-gray-50 border border-gray-300 rounded-xl px-2.5 py-1 text-right font-black text-[#0f172a]"
                      />
                    </div>

                    {discount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-extrabold">
                        <span>Discount Amount ({discount}%):</span>
                        <span>-{formatPrice(discountAmount)}</span>
                      </div>
                    )}
                  </div>

                  {/* Grand Total */}
                  <div className="pt-3 border-t border-gray-100 flex justify-between text-lg font-black text-[#0f172a] uppercase">
                    <span>Grand Total:</span>
                    <span className="text-emerald-700">{formatPrice(grandTotal)}</span>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <label className="text-[11px] font-black text-gray-400 uppercase">
                      Order Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any special instructions..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3 text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                    />
                  </div>

                  {/* Submit Order Button */}
                  <Button
                    onClick={handleFinalSubmitOrder}
                    disabled={isSubmitting || !selectedShop}
                    className="w-full bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-50 text-white font-black py-4 rounded-full shadow-md text-xs uppercase tracking-wider cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Save size={16} />
                    {isSubmitting ? 'SUBMITTING ORDER...' : 'SUBMIT ORDER (LOCAL DB)'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => clearCart()}
                    className="w-full rounded-full py-3 text-xs font-black uppercase text-red-500 hover:text-red-600 hover:bg-red-50 border-gray-200 cursor-pointer"
                  >
                    Clear Cart
                  </Button>
                </div>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* ───── ADD PRODUCT POPUP MODAL INSIDE CART (FAST KEYBOARD WORKFLOW) ───── */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-pointer"
            onClick={() => {
              setIsProductModalOpen(false);
              setSelectedProductForAdd(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()} // Prevent click inside modal from closing
              className="bg-white rounded-[2.5rem] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-4 max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 cursor-default"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-black text-[#0f172a] uppercase tracking-tight">ADD PRODUCT TO CART</h2>
                  <p className="text-xs font-bold text-gray-400">Search and add MTX product directly to cart</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsProductModalOpen(false); setSelectedProductForAdd(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
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
                      placeholder="Search MTX products..."
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 shadow-xs uppercase"
                    />
                  </div>

                  {/* Product Search Cards List */}
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
                          className="p-4 border border-slate-200 rounded-2xl hover:border-[#0f172a] hover:bg-slate-50/80 transition-all cursor-pointer group flex items-center justify-between bg-white shadow-xs"
                        >
                          <div className="space-y-1">
                            <h4 className="text-sm font-black text-[#0f172a] uppercase tracking-wide">
                              {product.name}
                            </h4>
                            <p className="text-sm font-black text-slate-700">
                              Rs.{product.sellPrice}
                            </p>
                            {/* ONLY ID: MTX-XXXX IS SHOWN */}
                            <p className="text-xs font-bold text-gray-400">
                              ID: <strong className="text-gray-600 font-mono">{product.productId}</strong>
                            </p>
                          </div>

                          <div className="w-9 h-9 bg-slate-100 group-hover:bg-[#0f172a] group-hover:text-white text-gray-700 rounded-xl flex items-center justify-center transition-colors">
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
                  <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-1">
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
                        className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3.5 text-sm font-black text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                      />
                    </div>

                    {/* Price Display */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-gray-500 uppercase">Unit Price</label>
                      <div className="w-full bg-slate-100 border border-slate-200 rounded-2xl p-3.5 text-sm font-black text-[#0f172a]">
                        Rs. {selectedProductForAdd.sellPrice}
                      </div>
                    </div>
                  </div>

                  {/* Note Input */}
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
                      className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3.5 text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setSelectedProductForAdd(null)}
                      className="w-1/2 py-3.5 bg-slate-100 text-slate-700 font-black text-xs uppercase rounded-full hover:bg-slate-200 transition-all cursor-pointer"
                    >
                      BACK TO SEARCH
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAddProduct}
                      className="w-1/2 py-3.5 bg-[#0f172a] text-white font-black text-xs uppercase rounded-full hover:bg-[#1e293b] shadow-md transition-all cursor-pointer active:scale-95"
                    >
                      ADD TO CART (ENTER)
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
