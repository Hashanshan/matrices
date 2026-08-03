'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/contexts/cart-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { motion } from 'framer-motion';
import { Trash2, ShoppingBag, Store, Plus, Minus, Check, ArrowLeft, RefreshCw, Save } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Header from '@/components/header';
import { formatPrice } from '@/lib/currency';
import Swal from 'sweetalert2';

export default function CartPage() {
  const router = useRouter();
  const {
    cart,
    selectedShop,
    openShopModal,
    removeFromCart,
    updateCartItem,
    clearCart,
    submitCartAsLocalOrder,
  } = useCart();
  const { user } = useAuth();

  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    const qty = Math.max(1, newQuantity);
    updateCartItem(productId, { quantity: qty });
  };

  const handleFinalSubmitOrder = async () => {
    if (!selectedShop) {
      Swal.fire({
        title: 'Customer Shop Required',
        text: 'Please select a customer shop before submitting the order.',
        icon: 'warning',
        confirmButtonColor: '#0f172a',
        confirmButtonText: 'Select Shop Now',
      }).then(() => openShopModal(true));
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

            <Link
              href="/catalogue"
              className="text-xs font-black uppercase text-[#0f172a] bg-gray-100 hover:bg-gray-200 px-5 py-3 rounded-full transition-all"
            >
              ← CONTINUE SHOPPING
            </Link>
          </div>

          {/* Active Customer Shop Banner (Crucial Requirement!) */}
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

            <button
              onClick={() => openShopModal(true)}
              className="px-5 py-3 bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-black uppercase rounded-full shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              {selectedShop ? 'CHANGE SHOP' : 'SELECT CUSTOMER SHOP'}
            </button>
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
                Add products from catalogue, gallery, or product pages to build an order.
              </p>
              <Link href="/catalogue">
                <Button className="bg-[#0f172a] hover:bg-[#1e293b] text-white px-8 py-6 rounded-full font-black text-xs uppercase tracking-wider shadow-md">
                  Browse Product Catalogue
                </Button>
              </Link>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Side: Cart Items List */}
              <div className="lg:col-span-2 space-y-4">
                {cart.items.map((item, index) => {
                  const itemId = item.id || item.productId || String(index);
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
                        {itemImage && (
                          <div className="flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden bg-[#f8f9fc] p-2 border border-gray-100">
                            <img
                              src={itemImage}
                              alt={itemName}
                              className="w-full h-full object-contain mix-blend-multiply"
                            />
                          </div>
                        )}

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

                      {/* Right Quantity Controls (MANUALLY TYPABLE INPUT AS REQUESTED!) */}
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
                      <span>Subtotal ({cart.items.reduce((s, i) => s + i.quantity, 0)} units):</span>
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

                  {/* Submit Order Button (Creates Local Draft Order!) */}
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
    </>
  );
}
