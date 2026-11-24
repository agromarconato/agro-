import { Menu, ShoppingBag, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { buildWhatsappLink } from '../lib/format';

export type AppView =
  | 'catalog'
  | 'auth'
  | 'orders'
  | 'checkout'
  | 'admin'
  | 'change-password';

interface HeaderProps {
  storeName: string;
  whatsappNumber: string;
  currentView: AppView;
  onNavigate: (view: AppView, authTab?: 'login' | 'register') => void;
  onOpenCart: () => void;
}

export function Header({
  storeName,
  whatsappNumber,
  currentView,
  onNavigate,
  onOpenCart,
}: HeaderProps) {
  const { user, cart, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const totalUnitsInCart = cart.items.length;

  const handleNav = (view: AppView, authTab?: 'login' | 'register') => {
    setMobileMenuOpen(false);
    onNavigate(view, authTab);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-950/10 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zona 1: Marca (elemento único em uma linha) */}
        <button
          type="button"
          onClick={() => handleNav('catalog')}
          className="cursor-pointer whitespace-nowrap shrink-0 text-left text-lg font-bold tracking-tight text-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
        >
          {storeName}
        </button>

        {/* Zona 2: Links de navegação concisos em uma linha */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-600">
          <button
            type="button"
            onClick={() => handleNav('catalog')}
            className={`cursor-pointer whitespace-nowrap shrink-0 transition-colors hover:text-emerald-900 ${
              currentView === 'catalog'
                ? 'text-emerald-950 underline underline-offset-4'
                : ''
            }`}
          >
            Catálogo
          </button>
          <button
            type="button"
            onClick={() => handleNav(user ? 'orders' : 'auth', 'login')}
            className={`cursor-pointer whitespace-nowrap shrink-0 transition-colors hover:text-emerald-900 ${
              currentView === 'orders'
                ? 'text-emerald-950 underline underline-offset-4'
                : ''
            }`}
          >
            Meus Pedidos
          </button>
          <a
            href={buildWhatsappLink(
              whatsappNumber,
              `Olá! Gostaria de falar com a ${storeName}.`
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-emerald-900"
          >
            WhatsApp
          </a>
          {isAdmin && (
            <button
              type="button"
              onClick={() => handleNav('admin')}
              className={`cursor-pointer whitespace-nowrap shrink-0 transition-colors hover:text-emerald-900 ${
                currentView === 'admin'
                  ? 'text-emerald-950 underline underline-offset-4'
                  : ''
              }`}
            >
              Painel Admin
            </button>
          )}
        </nav>

        {/* Zona 3: Ação principal + conta */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg border border-emerald-950/15 bg-white px-3.5 py-2 text-sm font-medium text-emerald-950 transition-colors hover:bg-emerald-50 whitespace-nowrap shrink-0"
            aria-label="Abrir carrinho"
          >
            <ShoppingBag className="h-4 w-4 text-emerald-900" />
            <span>Carrinho</span>
            <span className="font-mono tabular-nums text-xs font-semibold text-emerald-900">
              ({totalUnitsInCart})
            </span>
          </button>

          {user ? (
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <span className="max-w-[140px] truncate text-sm font-medium text-neutral-700">
                {user.fullName.split(' ')[0]}
              </span>
              <button
                type="button"
                onClick={() => {
                  logout();
                  handleNav('catalog');
                }}
                className="min-h-[40px] cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 whitespace-nowrap shrink-0"
              >
                Sair
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleNav('auth', 'register')}
                className="min-h-[40px] cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-emerald-950 transition-colors hover:bg-emerald-50 whitespace-nowrap shrink-0"
              >
                Cadastrar
              </button>
              <button
                type="button"
                onClick={() => handleNav('auth', 'login')}
                className="min-h-[40px] cursor-pointer rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-950 whitespace-nowrap shrink-0"
              >
                Entrar
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-emerald-950/15 text-emerald-950 md:hidden"
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menu Mobile */}
      {mobileMenuOpen && (
        <div className="border-t border-emerald-950/10 bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleNav('catalog')}
              className="min-h-[44px] cursor-pointer rounded-lg px-3 text-left text-sm font-medium text-neutral-800 hover:bg-emerald-50"
            >
              Catálogo
            </button>
            <button
              type="button"
              onClick={() => handleNav(user ? 'orders' : 'auth', 'login')}
              className="min-h-[44px] cursor-pointer rounded-lg px-3 text-left text-sm font-medium text-neutral-800 hover:bg-emerald-50"
            >
              Meus Pedidos
            </button>
            <a
              href={buildWhatsappLink(
                whatsappNumber,
                `Olá! Gostaria de falar com a ${storeName}.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-neutral-800 hover:bg-emerald-50"
            >
              WhatsApp
            </a>
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleNav('admin')}
                className="min-h-[44px] cursor-pointer rounded-lg px-3 text-left text-sm font-medium text-emerald-900 hover:bg-emerald-50"
              >
                Painel Admin
              </button>
            )}
            <div className="mt-2 border-t border-neutral-200 pt-3">
              {user ? (
                <div className="flex items-center justify-between px-3">
                  <span className="text-sm font-medium text-neutral-700">
                    {user.fullName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      handleNav('catalog');
                    }}
                    className="min-h-[40px] cursor-pointer rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Sair
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleNav('auth', 'login')}
                    className="min-h-[44px] flex-1 cursor-pointer rounded-lg bg-emerald-900 px-4 text-sm font-semibold text-white"
                  >
                    Entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNav('auth', 'register')}
                    className="min-h-[44px] flex-1 cursor-pointer rounded-lg border border-emerald-900 px-4 text-sm font-semibold text-emerald-900"
                  >
                    Criar conta
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
