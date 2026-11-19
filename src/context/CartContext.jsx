import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);

const EMPTY_CART = {
  sellers: [],
  grand_total_amd: 0,
  total_items: 0,
  has_price_changes: false,
  has_stock_issues: false,
};

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(EMPTY_CART);
  const [loading, setLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!user) {
      setCart(EMPTY_CART);
      return EMPTY_CART;
    }
    setLoading(true);
    try {
      const data = await apiRequest('/cart');
      setCart(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const setItemQuantity = async (productId, quantity, options = {}) => {
    const data = await apiRequest(`/cart/items/${productId}`, {
      method: 'PUT',
      body: { quantity, ...options },
    });
    setCart(data);
    return data;
  };

  const removeItem = async (productId) => {
    const data = await apiRequest(`/cart/items/${productId}`, {
      method: 'DELETE',
    });
    setCart(data);
    return data;
  };

  const clearLocalCart = () => setCart(EMPTY_CART);

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        refreshCart,
        setItemQuantity,
        removeItem,
        clearLocalCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
