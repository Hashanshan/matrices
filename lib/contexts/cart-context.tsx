'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Cart, CartItem, Order } from '../types';

interface CartContextType {
  cart: Cart;
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateCartItem: (productId: string, item: Partial<CartItem>) => void;
  clearCart: () => void;
  orders: Order[];
  placeOrder: (order: Order) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>({ items: [], total: 0, itemCount: 0 });
  const [orders, setOrders] = useState<Order[]>([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    const savedOrders = localStorage.getItem('orders');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (error) {
        console.error('Failed to parse cart from localStorage:', error);
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
      // items now include product data because we spread it in addToCart
      const price = (item as any).price || 0;
      total += price * item.quantity;
    });
    return total;
  };

  const addToCart = (newItem: CartItem) => {
    setCart((prevCart) => {
      const existingItem = prevCart.items.find(
        (item) =>
          item.productId === newItem.productId &&
          item.selectedColor === newItem.selectedColor &&
          item.selectedSize === newItem.selectedSize
      );

      let updatedItems;
      if (existingItem) {
        updatedItems = prevCart.items.map((item) =>
          item.productId === newItem.productId &&
          item.selectedColor === newItem.selectedColor &&
          item.selectedSize === newItem.selectedSize
            ? { ...item, quantity: item.quantity + newItem.quantity }
            : item
        );
      } else {
        updatedItems = [...prevCart.items, newItem];
      }

      const newCart = {
        items: updatedItems,
        total: calculateTotal(updatedItems),
        itemCount: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
      };

      localStorage.setItem('cart', JSON.stringify(newCart));
      return newCart;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => {
      const updatedItems = prevCart.items.filter((item) => item.productId !== productId);
      const newCart = {
        items: updatedItems,
        total: calculateTotal(updatedItems),
        itemCount: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
      };
      localStorage.setItem('cart', JSON.stringify(newCart));
      return newCart;
    });
  };

  const updateCartItem = (productId: string, updates: Partial<CartItem>) => {
    setCart((prevCart) => {
      const updatedItems = prevCart.items.map((item) =>
        item.productId === productId ? { ...item, ...updates } : item
      );
      const newCart = {
        items: updatedItems,
        total: calculateTotal(updatedItems),
        itemCount: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
      };
      localStorage.setItem('cart', JSON.stringify(newCart));
      return newCart;
    });
  };

  const clearCart = () => {
    const newCart = { items: [], total: 0, itemCount: 0 };
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  const placeOrder = (order: Order) => {
    setOrders((prevOrders) => {
      const updatedOrders = [...prevOrders, order];
      localStorage.setItem('orders', JSON.stringify(updatedOrders));
      return updatedOrders;
    });
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateCartItem, clearCart, orders, placeOrder }}>
      {children}
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
