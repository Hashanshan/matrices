'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Cart, CartItem, Order } from '../types';
import { offlineDB } from '../offline/indexed-db';
import { addToSyncQueue } from '../offline/pending-sync';
import GlobalShopModal, { ShopOption } from '@/components/global-shop-modal';
import Swal from 'sweetalert2';

interface CartContextType {
  cart: Cart;
  selectedShop: ShopOption | null;
  setSelectedShop: (shop: ShopOption | null) => void;
  getAddToCartButtonLabel: (fallbackLabel?: string) => string;
  addToCart: (item: CartItem) => boolean;
  removeFromCart: (productId: string) => void;
  updateCartItem: (productId: string, item: Partial<CartItem>) => void;
  clearCart: () => void;
  deselectShop: () => void;
  submitCartAsLocalOrder: (discount?: number, notes?: string) => Promise<boolean>;
  orders: Order[];
  placeOrder: (order: Order) => void;
  isShopModalOpen: boolean;
  openShopModal: () => void;
  closeShopModal: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>({ items: [], total: 0, itemCount: 0 });
  const [selectedShop, setSelectedShopState] = useState<ShopOption | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  // Shop modal state
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);

  // Load saved cart & selectedShop from localStorage on mount (App Restart Memory Persistence!)
  useEffect(() => {
    const savedCart = localStorage.getItem('matrices_cart') || localStorage.getItem('cart');
    const savedShop = localStorage.getItem('matrices_cart_shop');
    const savedOrders = localStorage.getItem('orders');

    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (error) {
        console.error('Failed to parse cart from localStorage:', error);
      }
    }

    if (savedShop) {
      try {
        setSelectedShopState(JSON.parse(savedShop));
      } catch (error) {
        console.error('Failed to parse savedShop from localStorage:', error);
      }
    }

    if (savedOrders) {
      try {
        setOrders(JSON.parse(savedOrders));
      } catch (error) {
        console.error('Failed to parse orders from localStorage:', error);
      }
    }
  }, []);

  const calculateTotal = (items: CartItem[]) => {
    let total = 0;
    items.forEach((item) => {
      const price = (item as any).price || 0;
      total += price * item.quantity;
    });
    return total;
  };

  const closeAllOtherModals = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matrices-close-all-modals'));
    }
  };

  const openShopModal = () => {
    // Close all other open popups first!
    closeAllOtherModals();
    setIsShopModalOpen(true);
  };

  const closeShopModal = () => {
    setIsShopModalOpen(false);
  };

  // Set selected shop with warning if cart already contains items for a different shop
  const setSelectedShop = async (shop: ShopOption | null) => {
    if (shop && selectedShop && selectedShop.shopId !== shop.shopId && cart.items.length > 0) {
      const result = await Swal.fire({
        title: 'Switch Customer Shop?',
        text: `Your active cart currently contains items for "${selectedShop.name}". Switching to "${shop.name}" will start a new order. Would you like to clear the cart for ${selectedShop.name}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0f172a',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Start New Shop Cart',
      });

      if (!result.isConfirmed) return;
      clearCart();
    }

    setSelectedShopState(shop);
    if (shop) {
      localStorage.setItem('matrices_cart_shop', JSON.stringify(shop));
    } else {
      localStorage.removeItem('matrices_cart_shop');
    }
  };

  // Single-line responsive button text helper (e.g. "ADD TO ASOK'S..." or "ADD TO NEW SHOP...")
  const getAddToCartButtonLabel = (fallbackLabel = 'ADD TO CART') => {
    if (!selectedShop) return fallbackLabel;
    const name = selectedShop.name || 'SHOP';
    const truncatedName = name.length > 10 ? `${name.substring(0, 8)}...` : name;
    return `ADD TO ${truncatedName.toUpperCase()}`;
  };

  // Add to cart with Shop Selection Enforcement
  const addToCart = (newItem: CartItem): boolean => {
    if (!selectedShop) {
      // Close all other product popups before opening PIN shop modal
      closeAllOtherModals();

      Swal.fire({
        title: 'Select Customer Shop',
        text: 'Please select a customer shop before adding items to cart.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0f172a',
        confirmButtonText: 'Select Shop Now',
        cancelButtonText: 'Cancel',
      }).then((res) => {
        if (res.isConfirmed) {
          openShopModal();
        }
      });
      return false;
    }

    setCart((prevCart) => {
      const getComboKey = (it: any) => {
        if (it.id && typeof it.id === 'string' && it.id.includes('_')) return it.id;
        const pId = it.productId || it.id || '';
        const color = it.selectedColor ? it.selectedColor.trim().toLowerCase() : '';
        const size = it.selectedSize ? it.selectedSize.trim().toLowerCase() : '';
        const note = it.notes ? it.notes.trim().toLowerCase() : '';
        return `${pId}_${color}_${size}_${note}`;
      };

      const targetKey = getComboKey(newItem);
      const itemWithId = { ...newItem, id: targetKey };

      const existingIndex = prevCart.items.findIndex((item) => getComboKey(item) === targetKey);

      let updatedItems;
      if (existingIndex > -1) {
        updatedItems = prevCart.items.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: item.quantity + newItem.quantity }
            : item
        );
      } else {
        updatedItems = [...prevCart.items, itemWithId];
      }

      const newCart = {
        items: updatedItems,
        total: calculateTotal(updatedItems),
        itemCount: updatedItems.length,
      };

      localStorage.setItem('matrices_cart', JSON.stringify(newCart));
      localStorage.setItem('cart', JSON.stringify(newCart));
      return newCart;
    });

    return true;
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prevCart) => {
      const getComboKey = (it: any) => {
        if (it.id && typeof it.id === 'string' && it.id.includes('_')) return it.id;
        const pId = it.productId || it.id || '';
        const color = it.selectedColor ? it.selectedColor.trim().toLowerCase() : '';
        const size = it.selectedSize ? it.selectedSize.trim().toLowerCase() : '';
        const note = it.notes ? it.notes.trim().toLowerCase() : '';
        return `${pId}_${color}_${size}_${note}`;
      };

      const updatedItems = prevCart.items.filter(
        (item) => item.id !== cartItemId && getComboKey(item) !== cartItemId && (item.productId || item.id) !== cartItemId
      );
      const newCart = {
        items: updatedItems,
        total: calculateTotal(updatedItems),
        itemCount: updatedItems.length,
      };
      localStorage.setItem('matrices_cart', JSON.stringify(newCart));
      localStorage.setItem('cart', JSON.stringify(newCart));
      return newCart;
    });
  };

  const updateCartItem = (cartItemId: string, updates: Partial<CartItem>) => {
    setCart((prevCart) => {
      const getComboKey = (it: any) => {
        if (it.id && typeof it.id === 'string' && it.id.includes('_')) return it.id;
        const pId = it.productId || it.id || '';
        const color = it.selectedColor ? it.selectedColor.trim().toLowerCase() : '';
        const size = it.selectedSize ? it.selectedSize.trim().toLowerCase() : '';
        const note = it.notes ? it.notes.trim().toLowerCase() : '';
        return `${pId}_${color}_${size}_${note}`;
      };

      const updatedItems = prevCart.items.map((item) => {
        const matches = item.id === cartItemId || getComboKey(item) === cartItemId;
        return matches ? { ...item, ...updates } : item;
      });
      const newCart = {
        items: updatedItems,
        total: calculateTotal(updatedItems),
        itemCount: updatedItems.length,
      };
      localStorage.setItem('matrices_cart', JSON.stringify(newCart));
      localStorage.setItem('cart', JSON.stringify(newCart));
      return newCart;
    });
  };

  const clearCart = () => {
    const newCart = { items: [], total: 0, itemCount: 0 };
    setCart(newCart);
    localStorage.removeItem('matrices_cart');
    localStorage.removeItem('cart');
  };

  const deselectShop = () => {
    clearCart();
    setSelectedShopState(null);
    localStorage.removeItem('matrices_cart_shop');
  };

  // Submit active Cart directly to Local IndexedDB Orders & SyncQueue
  const submitCartAsLocalOrder = async (discount = 0, notes = ''): Promise<boolean> => {
    if (!selectedShop) {
      Swal.fire('Shop Required', 'Please select a customer shop for this cart order.', 'warning');
      return false;
    }

    if (cart.items.length === 0) {
      Swal.fire('Cart Empty', 'Your cart is empty. Add products before submitting.', 'warning');
      return false;
    }

    try {
      const subtotalVal = cart.total;
      const discountAmountVal = (subtotalVal * discount) / 100;
      const totalVal = subtotalVal - discountAmountVal;

      const localOrderId = `LOCAL_ORD_${Date.now()}`;
      const displayOrderId = `DRAFT-${Math.floor(1000 + Math.random() * 9000)}`;

      const orderPayload = {
        id: localOrderId,
        orderId: displayOrderId,
        shop: {
          shopId: selectedShop.shopId,
          name: selectedShop.name,
          phone: selectedShop.phone || '',
          address: selectedShop.address || '',
        },
        items: cart.items.map((it: any) => ({
          productId: it.productId || it.id,
          name: it.name || 'Product',
          quantity: it.quantity,
          price: it.price || 0,
          originalPrice: it.price || 0,
          note: it.notes || it.note || '',
        })),
        subtotal: subtotalVal,
        discount,
        discountAmount: discountAmountVal,
        total: totalVal,
        orderDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
        isSynced: false,
        isLocallyCreated: true,
        notes,
      };

      // 1. Save to IndexedDB orders store
      await offlineDB.upsert('orders', orderPayload);

      // 2. Queue in SyncQueue for server push
      await addToSyncQueue({
        operation: 'CREATE',
        entity: 'Order',
        entityId: localOrderId,
        endpoint: '/api/orders/create',
        method: 'POST',
        payload: orderPayload,
        title: `Create Order - ${selectedShop.name}`,
      });

      // Clear current cart and selected shop
      clearCart();
      setSelectedShop(null);

      return true;
    } catch (err) {
      console.error('Failed to submit cart as local order:', err);
      Swal.fire('Error', 'Failed to submit cart order to local storage.', 'error');
      return false;
    }
  };

  const placeOrder = (order: Order) => {
    setOrders((prevOrders) => {
      const updatedOrders = [...prevOrders, order];
      localStorage.setItem('orders', JSON.stringify(updatedOrders));
      return updatedOrders;
    });

    const orderId = String(order.id || `ORD_${Date.now()}`);
    offlineDB.getAll<any>('orders').then((existing) => {
      const updated = [...existing, { id: orderId, orderId, ...order }];
      return offlineDB.saveBatch('orders', updated);
    }).catch(console.error);

    addToSyncQueue({
      operation: 'CREATE',
      entity: 'Order',
      entityId: orderId,
      endpoint: '/api/orders',
      method: 'POST',
      payload: order,
      title: `Placed Order #${orderId}`,
    }).catch(console.error);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        selectedShop,
        setSelectedShop,
        getAddToCartButtonLabel,
        addToCart,
        removeFromCart,
        updateCartItem,
        clearCart,
        deselectShop,
        submitCartAsLocalOrder,
        orders,
        placeOrder,
        isShopModalOpen,
        openShopModal,
        closeShopModal,
      }}
    >
      {children}
      {/* Global Shop Selector Modal */}
      <GlobalShopModal
        isOpen={isShopModalOpen}
        onClose={closeShopModal}
        onSelectShop={(s) => setSelectedShop(s)}
        currentShop={selectedShop}
      />
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
