import { useEffect, useState } from 'react';
import { CartDrawer } from './components/CartDrawer';
import { type AppView, Header } from './components/Header';
import { LoginPromptModal } from './components/LoginPromptModal';
import { ProductDetailModal } from './components/ProductDetailModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { apiFetch } from './lib/api';
import type { Product, StoreConfig, UnitMode, UserProfile } from './types';
import { AdminView } from './views/AdminView';
import { AuthView, ChangePasswordView } from './views/AuthView';
import { CatalogView } from './views/CatalogView';
import { CheckoutView } from './views/CheckoutView';
import { OrdersView } from './views/OrdersView';

const DEFAULT_CONFIG: StoreConfig = {
  storeName:
    (import.meta.env.VITE_STORE_NAME as string | undefined)?.trim() ||
    'AgroMarconato',
  storeDescription:
    (import.meta.env.VITE_STORE_DESCRIPTION as string | undefined)?.trim() ||
    'Nutrição animal, rações selecionadas e itens agropecuários com atendimento próximo e entrega rápida em Irati e região.',
  whatsappNumber:
    (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined)?.trim() ||
    '+55 42 98809-3611',
  paymentConfigured: false,
  supabaseConfigured: true,
};

function StorefrontApp() {
  const {
    user,
    pendingCartIntent,
    setPendingCartIntent,
    setSession,
    refreshCart,
    addToCart,
  } = useAuth();

  const [config, setConfig] = useState<StoreConfig>(DEFAULT_CONFIG);
  const [view, setView] = useState<AppView>('catalog');
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{
      storeName: string;
      storeDescription: string;
      whatsappNumber: string;
      paymentConfigured: boolean;
      supabaseConfigured: boolean;
    }>('/api/health')
      .then((res) =>
        setConfig({
          storeName: res.storeName || DEFAULT_CONFIG.storeName,
          storeDescription:
            res.storeDescription || DEFAULT_CONFIG.storeDescription,
          whatsappNumber: res.whatsappNumber || DEFAULT_CONFIG.whatsappNumber,
          paymentConfigured: res.paymentConfigured,
          supabaseConfigured: res.supabaseConfigured,
        })
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const navigate = (nextView: AppView, nextAuthTab?: 'login' | 'register') => {
    if (nextAuthTab) setAuthTab(nextAuthTab);
    if (user?.mustChangePassword && nextView !== 'change-password') {
      setView('change-password');
      return;
    }
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddToCart = async (
    product: Product,
    unitMode: UnitMode,
    quantity: number
  ) => {
    const intent = {
      productId: product.id,
      productName: product.name,
      unitMode,
      quantity,
    };

    if (!user) {
      setPendingCartIntent(intent);
      setSelectedProductId(null);
      setLoginPromptOpen(true);
      return;
    }

    try {
      await addToCart(intent);
      setSelectedProductId(null);
      setCartOpen(true);
      setToast(`${product.name} adicionado ao carrinho.`);
    } catch (err) {
      setToast(
        err instanceof Error
          ? err.message
          : 'Não foi possível adicionar ao carrinho.'
      );
    }
  };

  const handleAuthComplete = async (
    profile: UserProfile,
    token: string
  ): Promise<void> => {
    setSession(token, profile);

    if (profile.mustChangePassword) {
      setView('change-password');
      return;
    }

    if (pendingCartIntent) {
      try {
        await addToCart(pendingCartIntent, token);
        setToast(
          `${pendingCartIntent.productName} foi adicionado ao seu carrinho.`
        );
        setPendingCartIntent(null);
        setView('catalog');
        setCartOpen(true);
        return;
      } catch (err) {
        setToast(
          err instanceof Error
            ? err.message
            : 'Não foi possível adicionar o item pendente.'
        );
        setPendingCartIntent(null);
      }
    } else {
      await refreshCart(token);
    }

    if (profile.role === 'admin' || profile.role === 'super_admin') {
      setView('admin');
    } else {
      setView('catalog');
    }
  };

  const handlePasswordUpdated = async () => {
    if (pendingCartIntent) {
      try {
        await addToCart(pendingCartIntent);
        setPendingCartIntent(null);
        setView('catalog');
        setCartOpen(true);
        return;
      } catch {
        setPendingCartIntent(null);
      }
    }
    await refreshCart();
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      setView('admin');
    } else {
      setView('catalog');
    }
  };

  useEffect(() => {
    if (user?.mustChangePassword) {
      setView('change-password');
    }
  }, [user?.mustChangePassword]);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Header
        storeName={config.storeName}
        whatsappNumber={config.whatsappNumber}
        currentView={view}
        onNavigate={navigate}
        onOpenCart={() => setCartOpen(true)}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-emerald-950 px-4 py-3 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}

      {view === 'catalog' && (
        <CatalogView
          config={config}
          onSelectProduct={(id) => setSelectedProductId(id)}
          onAddToCart={handleAddToCart}
        />
      )}

      {view === 'auth' && (
        <AuthView initialTab={authTab} onAuthComplete={handleAuthComplete} />
      )}

      {view === 'change-password' && user && (
        <ChangePasswordView onPasswordUpdated={handlePasswordUpdated} />
      )}

      {view === 'checkout' && user && (
        <CheckoutView
          config={config}
          onBackToCatalog={() => navigate('catalog')}
          onOrderCreated={() => navigate('orders')}
        />
      )}

      {view === 'orders' && user && (
        <OrdersView
          config={config}
          onGoToCatalog={() => navigate('catalog')}
        />
      )}

      {view === 'admin' &&
        (isAdmin ? (
          <AdminView />
        ) : (
          <main className="mx-auto max-w-xl px-4 py-12 text-center">
            <h1 className="text-xl font-bold text-neutral-900">
              Acesso restrito a administradores
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Sua conta não possui permissão para acessar o painel administrativo.
            </p>
            <button
              type="button"
              onClick={() => navigate('catalog')}
              className="mt-5 min-h-[42px] cursor-pointer rounded-lg bg-emerald-900 px-5 py-2 text-sm font-semibold text-white"
            >
              Voltar ao catálogo
            </button>
          </main>
        ))}

      <ProductDetailModal
        productId={selectedProductId}
        onClose={() => setSelectedProductId(null)}
        onAddToCart={handleAddToCart}
      />

      <LoginPromptModal
        open={loginPromptOpen}
        productName={pendingCartIntent?.productName}
        onClose={() => setLoginPromptOpen(false)}
        onGoToLogin={() => {
          setLoginPromptOpen(false);
          navigate('auth', 'login');
        }}
        onGoToRegister={() => {
          setLoginPromptOpen(false);
          navigate('auth', 'register');
        }}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onProceedToCheckout={() => navigate('checkout')}
        onRequireLogin={() => navigate('auth', 'login')}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StorefrontApp />
    </AuthProvider>
  );
}
