import {
  LayoutGrid,
  Menu,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export type AppView =
  | 'catalog'
  | 'auth'
  | 'orders'
  | 'profile'
  | 'checkout'
  | 'admin'
  | 'change-password';

interface HeaderProps {
  storeName: string;
  currentView: AppView;
  searchQuery: string;
  onSearchChange: (nextQuery: string) => void;
  onSearchSubmit: (query: string) => void;
  onNavigate: (view: AppView, authTab?: 'login' | 'register') => void;
  onOpenCart: () => void;
}

export function Header({
  storeName,
  currentView,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onNavigate,
  onOpenCart,
}: HeaderProps) {
  const { user, cart } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const totalUnitsInCart = cart.items.length;

  const handleNav = (view: AppView, authTab?: 'login' | 'register') => {
    setMobileMenuOpen(false);
    onNavigate(view, authTab);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit(searchQuery.trim());
  };

  return (
    <header className="sticky top-0 z-40 w-full overflow-x-clip border-b border-emerald-950/10 bg-white/95 backdrop-blur-md shadow-[0_2px_12px_rgba(2,44,34,0.05)]">
      {/* Faixa principal em largura total com logo à esquerda, busca ampla ao centro e atalhos à direita */}
      <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3 px-4 py-3.5 sm:px-5 lg:gap-5 lg:px-6">
        {/* Zona 1: Logo + Identidade Agro Marconato à esquerda */}
        <button
          type="button"
          onClick={() => handleNav('catalog')}
          className="group flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl py-1 pr-1 text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
        >
          <img
            src="/favicon.png"
            alt={storeName}
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-full border border-emerald-950/15 object-cover shadow-sm transition-transform duration-300 group-hover:scale-105"
          />
          <div className="flex flex-col leading-tight">
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-emerald-950 transition-colors group-hover:text-emerald-800 whitespace-nowrap">
              {storeName}
            </span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-emerald-800/80 xl:block whitespace-nowrap">
              Agropecuária &amp; Pet · Irati-PR
            </span>
          </div>
        </button>

        {/* Zona 2: Campo de pesquisa amplo aproveitando o espaço central (Desktop/Tablet) */}
        <form
          onSubmit={handleFormSubmit}
          className="hidden md:flex flex-1 min-w-0 items-center"
          role="search"
          aria-label="Buscar produtos no catálogo"
        >
          <div className="flex w-full min-w-0 items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-emerald-900/60" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="O que você procura? Ex.: ração, enxada, cerca elétrica..."
                aria-label="Pesquisar produtos"
                className="h-12 w-full min-w-0 rounded-l-xl border-2 border-r-0 border-emerald-900/20 bg-neutral-50/80 pl-12 pr-10 text-[15px] text-neutral-900 placeholder:text-neutral-500 transition-colors focus:border-emerald-800 focus:bg-white focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Limpar busca"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-200/70 hover:text-neutral-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="h-12 shrink-0 cursor-pointer rounded-r-xl bg-emerald-900 px-5 lg:px-6 text-sm font-bold text-white transition-all duration-200 hover:bg-emerald-950 whitespace-nowrap"
            >
              Buscar
            </button>
          </div>
        </form>

        {/* Zona 3: Links animados, Conta e Carrinho à direita */}
        <div className="flex shrink-0 items-center gap-1.5 lg:gap-2.5">
          {/* Links detalhados com animação no hover (Desktop) */}
          <nav
            aria-label="Navegação principal"
            className="hidden xl:flex items-center gap-0.5"
          >
            <button
              type="button"
              onClick={() => handleNav('catalog')}
              className={`group relative inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-emerald-950 whitespace-nowrap ${
                currentView === 'catalog'
                  ? 'bg-emerald-50/80 text-emerald-950'
                  : 'text-neutral-700'
              }`}
            >
              <LayoutGrid className="h-4 w-4 text-emerald-800 transition-transform duration-200 group-hover:scale-110" />
              <span>Catálogo</span>
              <span
                className={`absolute bottom-1 left-3 right-3 h-0.5 origin-left rounded-full bg-emerald-800 transition-transform duration-200 ${
                  currentView === 'catalog'
                    ? 'scale-x-100'
                    : 'scale-x-0 group-hover:scale-x-100'
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => handleNav(user ? 'orders' : 'auth', 'login')}
              className={`group relative inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-emerald-950 whitespace-nowrap ${
                currentView === 'orders'
                  ? 'bg-emerald-50/80 text-emerald-950'
                  : 'text-neutral-700'
              }`}
            >
              <PackageCheck className="h-4 w-4 text-emerald-800 transition-transform duration-200 group-hover:scale-110" />
              <span>Meus Pedidos</span>
              <span
                className={`absolute bottom-1 left-2.5 right-2.5 h-0.5 origin-left rounded-full bg-emerald-800 transition-transform duration-200 ${
                  currentView === 'orders'
                    ? 'scale-x-100'
                    : 'scale-x-0 group-hover:scale-x-100'
                }`}
              />
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => handleNav('admin')}
                className={`group relative inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-emerald-950 whitespace-nowrap ${
                  currentView === 'admin'
                    ? 'bg-emerald-50/80 text-emerald-950'
                    : 'text-neutral-700'
                }`}
              >
                <ShieldCheck className="h-4 w-4 text-emerald-800 transition-transform duration-200 group-hover:scale-110" />
                <span>Painel Admin</span>
                <span
                  className={`absolute bottom-1 left-3 right-3 h-0.5 origin-left rounded-full bg-emerald-800 transition-transform duration-200 ${
                    currentView === 'admin'
                      ? 'scale-x-100'
                      : 'scale-x-0 group-hover:scale-x-100'
                  }`}
                />
              </button>
            )}
          </nav>

          {/* Conta do cliente (abre Meu Perfil) */}
          {user ? (
            <div className="hidden md:flex items-center border-l border-neutral-200 pl-2">
              <button
                type="button"
                onClick={() => handleNav('profile')}
                className={`group inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 ${
                  currentView === 'profile' ? 'bg-emerald-50 text-emerald-950' : ''
                }`}
                title={`Meu Perfil — ${user.fullName}`}
                aria-label="Abrir Meu Perfil"
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    currentView === 'profile'
                      ? 'bg-emerald-900 text-white'
                      : 'bg-emerald-900/10 text-emerald-900 group-hover:bg-emerald-900 group-hover:text-white'
                  }`}
                >
                  <User className="h-4 w-4" />
                </span>
                <span className="max-w-[120px] truncate text-sm font-semibold text-neutral-800">
                  {user.fullName.split(' ')[0]}
                </span>
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2 border-l border-neutral-200 pl-3">
              <button
                type="button"
                onClick={() => handleNav('auth', 'register')}
                className="min-h-[42px] cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-emerald-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 whitespace-nowrap"
              >
                Cadastrar
              </button>
              <button
                type="button"
                onClick={() => handleNav('auth', 'login')}
                className="inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-950 hover:shadow whitespace-nowrap"
              >
                <User className="h-4 w-4" />
                <span>Entrar</span>
              </button>
            </div>
          )}

          {/* Carrinho em destaque */}
          <button
            type="button"
            onClick={onOpenCart}
            className="group inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-2 border-emerald-900/20 bg-white px-4 py-2 text-sm font-bold text-emerald-950 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-900 hover:bg-emerald-50 hover:shadow-sm whitespace-nowrap shrink-0"
            aria-label="Abrir carrinho"
          >
            <ShoppingBag className="h-4 w-4 text-emerald-900 transition-transform duration-200 group-hover:scale-110" />
            <span className="hidden sm:inline">Carrinho</span>
            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-emerald-900 px-1.5 font-mono tabular-nums text-xs font-bold text-white transition-transform duration-200 group-hover:scale-105">
              {totalUnitsInCart}
            </span>
          </button>

          {/* Botão menu mobile / tablet */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-emerald-950/15 text-emerald-950 transition-colors hover:bg-emerald-50 xl:hidden"
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Campo de pesquisa no mobile (sempre acessível logo no topo) */}
      <div className="border-t border-neutral-100 px-3 py-2.5 sm:px-4 md:hidden">
        <form
          onSubmit={handleFormSubmit}
          className="flex w-full min-w-0 items-center"
          role="search"
          aria-label="Buscar produtos no catálogo"
        >
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-emerald-900/60" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar produtos na Agro Marconato..."
              aria-label="Pesquisar produtos"
              className="h-11 w-full min-w-0 rounded-l-lg border border-r-0 border-neutral-300 bg-neutral-50 pl-10 pr-8 text-sm text-neutral-900 focus:border-emerald-800 focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Limpar busca"
                className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="h-11 shrink-0 cursor-pointer rounded-r-lg bg-emerald-900 px-4 text-xs font-bold text-white hover:bg-emerald-950 whitespace-nowrap"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Menu Mobile / Tablet */}
      {mobileMenuOpen && (
        <div className="border-t border-emerald-950/10 bg-white px-4 py-4 xl:hidden">
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => handleNav('catalog')}
              className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold text-neutral-800 hover:bg-emerald-50"
            >
              <LayoutGrid className="h-4 w-4 text-emerald-800" />
              <span>Catálogo</span>
            </button>
            <button
              type="button"
              onClick={() => handleNav(user ? 'orders' : 'auth', 'login')}
              className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold text-neutral-800 hover:bg-emerald-50"
            >
              <PackageCheck className="h-4 w-4 text-emerald-800" />
              <span>Meus Pedidos</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleNav('admin')}
                className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-800" />
                <span>Painel Admin</span>
              </button>
            )}
            {user && (
              <button
                type="button"
                onClick={() => handleNav('profile')}
                className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold text-neutral-800 hover:bg-emerald-50"
              >
                <User className="h-4 w-4 text-emerald-800" />
                <span>Meu Perfil</span>
              </button>
            )}
            <div className="mt-2 border-t border-neutral-200 pt-3 md:hidden">
              {user ? (
                <button
                  type="button"
                  onClick={() => handleNav('profile')}
                  className="flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-lg bg-emerald-50/70 px-3 text-left text-sm font-semibold text-emerald-950 hover:bg-emerald-100/70"
                >
                  <span className="truncate">{user.fullName}</span>
                  <span className="ml-2 shrink-0 text-xs font-bold text-emerald-800">
                    Ver perfil
                  </span>
                </button>
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
