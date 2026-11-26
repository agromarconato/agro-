import {
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  ANIMAL_SUBCATEGORIES,
  CATALOG_DEPARTMENTS,
  getDepartmentSubcategories,
} from '../../shared/catalogTaxonomy';
import { DepartmentNav } from '../components/DepartmentNav';
import { ProductImage } from '../components/ProductImage';
import { apiFetch } from '../lib/api';
import { formatCurrency, formatProductCategories } from '../lib/format';
import type { Product, StoreConfig, UnitMode } from '../types';

const DEFAULT_HERO_IMAGE = '/assets/hero-agromarconato.png';

interface CatalogResponse {
  products: Product[];
  categories: string[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  supabaseConfigured: boolean;
}

interface CatalogViewProps {
  config: StoreConfig;
  searchInput: string;
  onSearchInputChange: (nextValue: string) => void;
  onSelectProduct: (productId: string) => void;
  onAddToCart: (product: Product, unitMode: UnitMode, quantity: number) => void;
}

function getVisiblePageNumbers(
  currentPage: number,
  totalPages: number
): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }
  const pages: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push('ellipsis');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < totalPages - 1) pages.push('ellipsis');
  pages.push(totalPages);
  return pages;
}

export function CatalogView({
  config,
  searchInput,
  onSearchInputChange,
  onSelectProduct,
  onAddToCart,
}: CatalogViewProps) {
  const heroImageUrl =
    (import.meta.env.VITE_HERO_IMAGE_URL as string | undefined)?.trim() ||
    DEFAULT_HERO_IMAGE;

  const [appliedSearch, setAppliedSearch] = useState(searchInput.trim());
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [appliedMinPrice, setAppliedMinPrice] = useState('');
  const [appliedMaxPrice, setAppliedMaxPrice] = useState('');
  const [promoOnly, setPromoOnly] = useState(false);
  const [sort, setSort] = useState<'price_asc' | 'price_desc'>('price_asc');
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse>({
    products: [],
    categories: [],
    page: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 1,
    supabaseConfigured: true,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== appliedSearch) {
        setPage(1);
        setAppliedSearch(next);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, appliedSearch]);

  useEffect(() => {
    let cancelled = false;
    const fetchCatalog = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          sort,
        });
        if (appliedSearch) params.set('search', appliedSearch);
        if (category) params.set('category', category);
        if (subcategory) params.set('subcategory', subcategory);
        if (appliedMinPrice) params.set('minPrice', appliedMinPrice);
        if (appliedMaxPrice) params.set('maxPrice', appliedMaxPrice);
        if (promoOnly) params.set('promoOnly', 'true');

        const data = await apiFetch<CatalogResponse>(
          `/api/products?${params.toString()}`
        );
        if (!cancelled) {
          setCatalog(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar os produtos.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCatalog();
    return () => {
      cancelled = true;
    };
  }, [
    appliedSearch,
    category,
    subcategory,
    appliedMinPrice,
    appliedMaxPrice,
    promoOnly,
    sort,
    page,
  ]);

  const scrollToCatalog = () => {
    const el = document.getElementById('catalogo-produtos');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDepartmentFilter = (
    nextCategory: string,
    nextSubcategory: string,
    nextPromo = false
  ) => {
    setCategory(nextCategory);
    setSubcategory(nextSubcategory);
    setPromoOnly(nextPromo);
    setPage(1);
    scrollToCatalog();
  };

  const handleApplyPriceFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedMinPrice(minPriceInput.trim());
    setAppliedMaxPrice(maxPriceInput.trim());
    setPage(1);
  };

  const handleClearFilters = () => {
    onSearchInputChange('');
    setAppliedSearch('');
    setCategory('');
    setSubcategory('');
    setMinPriceInput('');
    setMaxPriceInput('');
    setAppliedMinPrice('');
    setAppliedMaxPrice('');
    setPromoOnly(false);
    setSort('price_asc');
    setPage(1);
  };

  const activeDepartmentSubcategories = useMemo(() => {
    if (!category) return [];
    if (category === 'Animais') return ANIMAL_SUBCATEGORIES;
    return getDepartmentSubcategories(category);
  }, [category]);

  const availableCategories = useMemo(() => {
    const base = CATALOG_DEPARTMENTS.map((d) => d.name as string);
    const merged = [...base];
    for (const c of catalog.categories) {
      if (c && !merged.includes(c)) merged.push(c);
    }
    return merged;
  }, [catalog.categories]);

  const activeFilterCount =
    (appliedSearch ? 1 : 0) +
    (category ? 1 : 0) +
    (subcategory ? 1 : 0) +
    (appliedMinPrice || appliedMaxPrice ? 1 : 0) +
    (promoOnly ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const visiblePages = useMemo(
    () => getVisiblePageNumbers(catalog.page, catalog.totalPages),
    [catalog.page, catalog.totalPages]
  );

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    scrollToCatalog();
  };

  const filterPanelBody = (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
        <div>
          <h3 className="text-xl font-bold text-neutral-900">Filtros</h3>
          <p className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-emerald-900">
            {catalog.totalCount}{' '}
            {catalog.totalCount === 1
              ? 'produto encontrado'
              : 'produtos encontrados'}
          </p>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="cursor-pointer text-xs font-bold text-emerald-900 underline underline-offset-2 hover:text-emerald-950"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Ordenação */}
      <div>
        <label
          htmlFor="filter-sort"
          className="block text-sm font-bold text-neutral-900"
        >
          Ordenar por
        </label>
        <select
          id="filter-sort"
          value={sort}
          onChange={(e) => {
            setSort(
              e.target.value === 'price_desc' ? 'price_desc' : 'price_asc'
            );
            setPage(1);
          }}
          className="mt-2 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3.5 text-[15px] font-medium text-neutral-900 focus:border-emerald-800 focus:outline-none"
        >
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
        </select>
      </div>

      {/* Filtro de preço mínimo e máximo */}
      <form onSubmit={handleApplyPriceFilter} className="border-t border-neutral-200 pt-5">
        <span className="block text-sm font-bold text-neutral-900">
          Faixa de preço (R$)
        </span>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="filter-min-price" className="block text-xs text-neutral-600">
              Mínimo
            </label>
            <input
              id="filter-min-price"
              type="number"
              min="0"
              step="0.01"
              value={minPriceInput}
              onChange={(e) => setMinPriceInput(e.target.value)}
              placeholder="0,00"
              className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm text-neutral-900 focus:border-emerald-800 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="filter-max-price" className="block text-xs text-neutral-600">
              Máximo
            </label>
            <input
              id="filter-max-price"
              type="number"
              min="0"
              step="0.01"
              value={maxPriceInput}
              onChange={(e) => setMaxPriceInput(e.target.value)}
              placeholder="999,00"
              className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-mono text-sm text-neutral-900 focus:border-emerald-800 focus:outline-none"
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-3 min-h-[42px] w-full cursor-pointer rounded-lg border border-emerald-900 bg-white px-4 py-2 text-sm font-bold text-emerald-950 transition-colors hover:bg-emerald-900 hover:text-white"
        >
          Aplicar preço
        </button>
      </form>

      {/* Filtro por Categoria Principal */}
      <div className="border-t border-neutral-200 pt-5">
        <span className="block text-sm font-bold text-neutral-900">
          Categorias
        </span>
        <div className="mt-2.5 space-y-1.5">
          <button
            type="button"
            onClick={() => {
              setCategory('');
              setSubcategory('');
              setPage(1);
            }}
            className={`flex min-h-[42px] w-full cursor-pointer items-center justify-between rounded-lg px-3.5 py-2 text-left text-[15px] font-medium transition-colors ${
              !category
                ? 'bg-emerald-900 font-bold text-white'
                : 'text-neutral-800 hover:bg-emerald-50 hover:text-emerald-950'
            }`}
          >
            <span>Todas as categorias</span>
          </button>

          {availableCategories.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setCategory(cat);
                  setSubcategory('');
                  setPage(1);
                }}
                className={`flex min-h-[42px] w-full cursor-pointer items-center justify-between rounded-lg px-3.5 py-2 text-left text-[15px] font-medium transition-colors ${
                  active
                    ? 'bg-emerald-900 font-bold text-white'
                    : 'text-neutral-800 hover:bg-emerald-50 hover:text-emerald-950'
                }`}
              >
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtro por Subcategoria */}
      {activeDepartmentSubcategories.length > 0 && (
        <div className="border-t border-neutral-200 pt-5">
          <span className="block text-sm font-bold text-neutral-900">
            {category === 'Animais'
              ? 'Subcategorias de Animais'
              : `Subcategorias de ${category}`}
          </span>
          <div className="mt-2.5 space-y-1.5">
            <button
              type="button"
              onClick={() => {
                setSubcategory('');
                setPage(1);
              }}
              className={`flex min-h-[40px] w-full cursor-pointer items-center rounded-lg px-3.5 py-1.5 text-left text-[15px] font-medium transition-colors ${
                !subcategory
                  ? 'bg-emerald-50 font-bold text-emerald-950'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              Todos de {category}
            </button>
            {activeDepartmentSubcategories.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => {
                  setSubcategory(sub);
                  setPage(1);
                }}
                className={`flex min-h-[40px] w-full cursor-pointer items-center rounded-lg px-3.5 py-1.5 text-left text-[15px] font-medium transition-colors ${
                  subcategory === sub
                    ? 'bg-emerald-900 font-bold text-white'
                    : 'text-neutral-700 hover:bg-emerald-50 hover:text-emerald-950'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Limpar filtros */}
      <div className="border-t border-neutral-200 pt-5">
        <button
          type="button"
          onClick={handleClearFilters}
          disabled={!hasActiveFilters && sort === 'price_asc'}
          className="min-h-[44px] w-full cursor-pointer rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm font-bold text-neutral-800 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Limpar todos os filtros
        </button>
      </div>
    </div>
  );

  return (
    <>
      <DepartmentNav
        selectedCategory={category}
        selectedSubcategory={subcategory}
        promoOnly={promoOnly}
        onSelectFilter={handleDepartmentFilter}
      />

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Banner principal amplo logo abaixo do cabeçalho (sem botão Atendimento no WhatsApp) */}
        <section className="grid grid-cols-1 items-stretch overflow-hidden rounded-2xl border border-emerald-950/15 bg-emerald-950 text-white shadow-sm lg:grid-cols-12">
          <div className="flex flex-col justify-center p-8 sm:p-12 lg:col-span-6 lg:p-14">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {config.storeName}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-emerald-50/95 sm:text-lg">
              {config.storeDescription}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={scrollToCatalog}
                className="min-h-[48px] cursor-pointer rounded-xl bg-white px-7 py-3 text-[15px] font-bold text-emerald-950 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 whitespace-nowrap"
              >
                Ver produtos
              </button>
            </div>
          </div>

          <div className="relative flex min-h-[290px] items-center justify-center bg-[#142135] p-6 lg:col-span-6 lg:min-h-[440px]">
            <img
              src={heroImageUrl}
              alt={config.storeName}
              referrerPolicy="no-referrer"
              onError={(e) => {
                if (e.currentTarget.dataset.fallbackApplied) return;
                e.currentTarget.dataset.fallbackApplied = 'true';
                e.currentTarget.src = DEFAULT_HERO_IMAGE;
              }}
              className="max-h-[400px] w-full object-contain"
            />
          </div>
        </section>

        {/* Aviso se as chaves do Supabase ainda não foram preenchidas */}
        {!catalog.supabaseConfigured && (
          <section className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
            <h2 className="font-bold">Conexão com Supabase pendente</h2>
            <p className="mt-1 leading-relaxed">
              O servidor está funcionando, mas as variáveis{' '}
              <code className="font-mono text-xs">SUPABASE_URL</code>,{' '}
              <code className="font-mono text-xs">SUPABASE_ANON_KEY</code> e{' '}
              <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code>{' '}
              ainda não foram preenchidas neste ambiente. Assim que você configurar o{' '}
              <code className="font-mono text-xs">.env</code> ou as variáveis na
              Vercel e executar os scripts SQL, os produtos aparecerão aqui.
            </p>
          </section>
        )}

        {/* Área do Catálogo: Filtros na coluna esquerda + Grade 5 colunas à direita */}
        <section id="catalogo-produtos" className="mt-10">
          {/* Botão abrir/fechar filtros no celular */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              aria-expanded={mobileFiltersOpen}
              className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-xl border border-emerald-900 bg-white px-4 py-2.5 text-sm font-bold text-emerald-950 shadow-sm"
            >
              <SlidersHorizontal className="h-4 w-4 text-emerald-900" />
              <span>Filtros</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-900 px-1.5 font-mono text-xs font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <span className="font-mono tabular-nums text-sm font-semibold text-neutral-700">
              {catalog.totalCount}{' '}
              {catalog.totalCount === 1
                ? 'produto encontrado'
                : 'produtos encontrados'}
            </span>
          </div>

          {mobileFiltersOpen && (
            <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm lg:hidden">
              {filterPanelBody}
            </div>
          )}

          <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
            {/* Coluna esquerda: Painel de Filtros (Desktop) */}
            <aside
              aria-label="Filtros do catálogo"
              className="hidden lg:block w-[300px] xl:w-[320px] shrink-0 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
            >
              {filterPanelBody}
            </aside>

            {/* Coluna direita: Cabeçalho da lista + Grade de produtos (5 colunas no desktop) */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                    {category
                      ? subcategory
                        ? `${category} · ${subcategory}`
                        : category
                      : promoOnly
                        ? 'Produtos em Promoção'
                        : 'Catálogo Geral de Produtos'}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    {appliedSearch
                      ? `Resultados para "${appliedSearch}"`
                      : 'Confira os produtos reais cadastrados na Agro Marconato.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 py-1.5 text-xs font-bold text-neutral-800 hover:bg-neutral-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Limpar filtros
                    </button>
                  )}
                  <span className="font-mono tabular-nums text-sm font-bold text-emerald-950">
                    {catalog.totalCount}{' '}
                    {catalog.totalCount === 1
                      ? 'produto encontrado'
                      : 'produtos encontrados'}
                  </span>
                </div>
              </div>

              {/* Atalho visual de subcategorias dentro de Animais quando Animais estiver selecionado */}
              {category === 'Animais' && (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-900/15 bg-emerald-50/50 px-4 py-3">
                  <span className="mr-1 text-xs font-bold uppercase tracking-wider text-emerald-950">
                    Animais:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSubcategory('');
                      setPage(1);
                    }}
                    className={`min-h-[38px] cursor-pointer rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                      !subcategory
                        ? 'border-emerald-900 bg-emerald-900 text-white'
                        : 'border-neutral-300 bg-white text-neutral-800 hover:border-emerald-800'
                    }`}
                  >
                    Todos
                  </button>
                  {ANIMAL_SUBCATEGORIES.map((animal) => (
                    <button
                      key={animal}
                      type="button"
                      onClick={() => {
                        setSubcategory(animal);
                        setPage(1);
                      }}
                      className={`min-h-[38px] cursor-pointer rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                        subcategory === animal
                          ? 'border-emerald-900 bg-emerald-900 text-white'
                          : 'border-neutral-300 bg-white text-neutral-800 hover:border-emerald-800'
                      }`}
                    >
                      {animal}
                    </button>
                  ))}
                </div>
              )}

              {/* Estado de carregamento e erro */}
              {loading && (
                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-[400px] animate-pulse rounded-xl border border-neutral-200 bg-neutral-100"
                    />
                  ))}
                </div>
              )}

              {error && !loading && (
                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
                  {error}
                </div>
              )}

              {!loading && !error && catalog.products.length === 0 && (
                <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-12 text-center">
                  <p className="text-lg font-bold text-neutral-800">
                    Nenhum produto encontrado
                  </p>
                  <p className="mt-1.5 text-[15px] text-neutral-600">
                    {hasActiveFilters
                      ? 'Tente limpar os filtros ou ajustar o termo de busca.'
                      : 'Ainda não há produtos cadastrados no catálogo.'}
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="mt-5 min-h-[44px] cursor-pointer rounded-lg bg-emerald-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-950"
                    >
                      Ver Catálogo Geral
                    </button>
                  )}
                </div>
              )}

              {/* Grade de produtos: 5 colunas em desktop (xl:grid-cols-5), até 25 por página */}
              {!loading && !error && catalog.products.length > 0 && (
                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5">
                  {catalog.products.map((product) => {
                    const hasPromoUnit =
                      product.promo_price_unit !== null &&
                      product.price_unit !== null &&
                      Number(product.promo_price_unit) <
                        Number(product.price_unit);
                    const hasPromoKg =
                      product.promo_price_kg !== null &&
                      product.price_kg !== null &&
                      Number(product.promo_price_kg) < Number(product.price_kg);

                    const defaultUnitMode: UnitMode =
                      product.sale_type === 'kg' ? 'kg' : 'unit';

                    const outOfStock =
                      product.manage_stock &&
                      Number(product.stock_quantity ?? 0) <= 0;

                    const categoryLabels = formatProductCategories(product);

                    return (
                      <article
                        key={product.id}
                        className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-emerald-900/30 hover:shadow-lg"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectProduct(product.id)}
                          className="relative aspect-square w-full cursor-pointer overflow-hidden border-b border-neutral-100 bg-white text-left"
                        >
                          <ProductImage
                            src={product.image_url}
                            alt={product.name}
                            fit="contain"
                            className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                          />
                        </button>

                        <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                              {categoryLabels.length > 0 && (
                                <span className="font-medium text-neutral-600">
                                  {categoryLabels.join(' · ')}
                                </span>
                              )}
                              {categoryLabels.length > 0 && product.is_promo && (
                                <span aria-hidden="true">·</span>
                              )}
                              {product.is_promo && (
                                <span className="font-bold text-emerald-800">
                                  Promoção
                                </span>
                              )}
                              {product.avg_rating !== null &&
                                product.avg_rating !== undefined && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-1 font-medium text-neutral-700">
                                      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                                      {product.avg_rating}
                                    </span>
                                  </>
                                )}
                            </div>

                            <button
                              type="button"
                              onClick={() => onSelectProduct(product.id)}
                              className="mt-2 cursor-pointer text-left text-[16px] font-bold leading-snug text-neutral-900 line-clamp-2 hover:text-emerald-900"
                            >
                              {product.name}
                            </button>

                            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-neutral-600">
                              {product.description}
                            </p>
                          </div>

                          <div className="mt-4 border-t border-neutral-100 pt-4">
                            <p
                              className={`mb-2 text-xs font-semibold ${
                                outOfStock
                                  ? 'text-red-700'
                                  : 'text-emerald-800'
                              }`}
                            >
                              {outOfStock
                                ? 'Indisponível no estoque'
                                : product.manage_stock
                                  ? `Disponível (${product.stock_quantity} ${
                                      product.sale_type === 'kg' ? 'kg' : 'un'
                                    })`
                                  : 'Disponível'}
                            </p>

                            <div className="space-y-1.5">
                              {(product.sale_type === 'unit' ||
                                product.sale_type === 'both') &&
                                product.price_unit !== null && (
                                  <div className="flex flex-col">
                                    <span className="text-xs text-neutral-500">
                                      Por unidade
                                    </span>
                                    <div className="flex items-baseline gap-2">
                                      {hasPromoUnit && (
                                        <span className="font-mono tabular-nums text-xs text-neutral-400 line-through">
                                          {formatCurrency(product.price_unit)}
                                        </span>
                                      )}
                                      <span className="font-mono tabular-nums text-xl font-extrabold text-emerald-900">
                                        {formatCurrency(
                                          hasPromoUnit
                                            ? product.promo_price_unit
                                            : product.price_unit
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                )}

                              {(product.sale_type === 'kg' ||
                                product.sale_type === 'both') &&
                                product.price_kg !== null && (
                                  <div className="flex flex-col">
                                    <span className="text-xs text-neutral-500">
                                      Por quilo
                                    </span>
                                    <div className="flex items-baseline gap-2">
                                      {hasPromoKg && (
                                        <span className="font-mono tabular-nums text-xs text-neutral-400 line-through">
                                          {formatCurrency(product.price_kg)}
                                        </span>
                                      )}
                                      <span className="font-mono tabular-nums text-xl font-extrabold text-emerald-900">
                                        {formatCurrency(
                                          hasPromoKg
                                            ? product.promo_price_kg
                                            : product.price_kg
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                )}
                            </div>

                            <div className="mt-4 flex flex-col gap-2">
                              <button
                                type="button"
                                disabled={outOfStock}
                                onClick={() =>
                                  onAddToCart(product, defaultUnitMode, 1)
                                }
                                className="min-h-[44px] w-full cursor-pointer rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-950 disabled:cursor-not-allowed disabled:bg-neutral-300"
                              >
                                {outOfStock
                                  ? 'Sem estoque'
                                  : 'Adicionar ao carrinho'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onSelectProduct(product.id)}
                                className="min-h-[38px] w-full cursor-pointer rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                              >
                                Ver detalhes
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {/* Paginação numerada (25 produtos por página) */}
              {!loading && catalog.totalPages > 1 && (
                <nav
                  aria-label="Paginação do catálogo"
                  className="mt-10 flex flex-wrap items-center justify-center gap-2"
                >
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => changePage(Math.max(1, page - 1))}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </button>

                  {visiblePages.map((item, idx) =>
                    item === 'ellipsis' ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-2 font-mono text-sm text-neutral-400"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => changePage(item)}
                        aria-current={
                          item === catalog.page ? 'page' : undefined
                        }
                        className={`min-h-[44px] min-w-[44px] cursor-pointer rounded-lg border px-3 font-mono tabular-nums text-sm font-bold transition-colors ${
                          item === catalog.page
                            ? 'border-emerald-900 bg-emerald-900 text-white'
                            : 'border-neutral-300 bg-white text-neutral-800 hover:bg-emerald-50'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    disabled={page >= catalog.totalPages}
                    onClick={() =>
                      changePage(Math.min(catalog.totalPages, page + 1))
                    }
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </nav>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
