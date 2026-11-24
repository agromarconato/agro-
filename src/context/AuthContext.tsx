import React, { createContext, useCallback, useContext, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { CartState, PendingCartIntent, UserProfile } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  accessToken: string | null;
  cart: CartState;
  pendingCartIntent: PendingCartIntent | null;
  setPendingCartIntent: (intent: PendingCartIntent | null) => void;
  setSession: (token: string, profile: UserProfile) => void;
  updateProfileLocal: (patch: Partial<UserProfile>) => void;
  logout: () => void;
  refreshCart: (tokenOverride?: string | null) => Promise<void>;
  addToCart: (
    intent: PendingCartIntent,
    tokenOverride?: string | null
  ) => Promise<CartState>;
  updateCartItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeCartItem: (itemId: string) => Promise<void>;
}

const EMPTY_CART: CartState = { items: [], subtotal: 0, itemCount: 0 };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Token mantido apenas em memória React: isola completamente sessões entre abas/usuários
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [cart, setCart] = useState<CartState>(EMPTY_CART);
  const [pendingCartIntent, setPendingCartIntent] =
    useState<PendingCartIntent | null>(null);

  const refreshCart = useCallback(
    async (tokenOverride?: string | null) => {
      const token = tokenOverride !== undefined ? tokenOverride : accessToken;
      if (!token) {
        setCart(EMPTY_CART);
        return;
      }
      try {
        const data = await apiFetch<CartState>('/api/cart', { token });
        setCart(data);
      } catch {
        setCart(EMPTY_CART);
      }
    },
    [accessToken]
  );

  const setSession = useCallback((token: string, profile: UserProfile) => {
    setAccessToken(token);
    setUser(profile);
  }, []);

  const updateProfileLocal = useCallback((patch: Partial<UserProfile>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setCart(EMPTY_CART);
    setPendingCartIntent(null);
  }, []);

  const addToCart = useCallback(
    async (intent: PendingCartIntent, tokenOverride?: string | null) => {
      const token = tokenOverride !== undefined ? tokenOverride : accessToken;
      if (!token) {
        throw new Error('Autenticação necessária.');
      }
      const nextCart = await apiFetch<CartState>('/api/cart/items', {
        method: 'POST',
        token,
        body: {
          productId: intent.productId,
          unitMode: intent.unitMode,
          quantity: intent.quantity,
        },
      });
      setCart(nextCart);
      return nextCart;
    },
    [accessToken]
  );

  const updateCartItemQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (!accessToken) return;
      const nextCart = await apiFetch<CartState>(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        token: accessToken,
        body: { quantity },
      });
      setCart(nextCart);
    },
    [accessToken]
  );

  const removeCartItem = useCallback(
    async (itemId: string) => {
      if (!accessToken) return;
      const nextCart = await apiFetch<CartState>(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      setCart(nextCart);
    },
    [accessToken]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        cart,
        pendingCartIntent,
        setPendingCartIntent,
        setSession,
        updateProfileLocal,
        logout,
        refreshCart,
        addToCart,
        updateCartItemQuantity,
        removeCartItem,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return ctx;
}
