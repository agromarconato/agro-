import {
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Search,
  Star,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ProductImage } from '../components/ProductImage';
import { apiFetch } from '../lib/api';
import { buildWhatsappLink, formatCurrency } from '../lib/format';
import type { Product, StoreConfig, UnitMode } from '../types';

const DEFAULT_HERO_IMAGE = '/src/assets/images/hero_agro_store_1795537513577.jpg';

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
  onSelectProduct: (productId: string) => void;
  onAddToCart: (product: Product, unitMode: UnitMode, quantity: number) => void;
}

export function CatalogView({
  config,
  onSelectProduct,
  onAddToCart,
}: CatalogViewProps) {
  const heroImageUrl =
    (import.meta.env.VITE_HERO_IMAGE_URL as string | undefined)?.trim() ||
    DEFAULT_HERO_IMAGE;

  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [promoOnly, setPromoOnly] = useState(false);
  const [sort, setSort] = useState<'price_asc' | 'price_desc'>('price_asc');
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse>({
    products: [],
    categories: [],
    page: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 1,
    supabaseConfigured: true,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setAppliedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
  }, [appliedSearch, category, promoOnly, sort, page]);

  const scrollToCatalog = () => {
    const el = document.getElementById('catalogo-produtos');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Área de destaque (Hero) com imagem substituível */}
      <section className="grid grid-cols-1 items-stretch overflow-hidden rounded-2xl border border-emerald-950/10 bg-emerald-950 text-white lg:grid-cols-12">
        <div className="flex flex-col justify-center p-8 sm:p-12 lg:col-span-6">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {config.storeName}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-emerald-50/90">
            {config.storeDescription}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={scrollToCatalog}
              className="min-h-[44px] cursor-pointer rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-50 whitespace-nowrap"
            >
              Ver produtos
            </button>
            <a
              href={buildWhatsappLink(
                config.whatsappNumber,
                `Olá! Gostaria de tirar uma dúvida sobre os produtos da ${config.storeName}.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/25 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 whitespace-nowrap"
            >
              <MessageCircle className="h-4 w-4" />
              Atendimento no WhatsApp
            </a>
          </div>

          <p className="mt-6 text-xs text-emerald-100/75">
            Entrega em Irati-PR com frete fixo de{' '}
            <span className="font-mono tabular-nums font-semibold text-white">
              R$ 4,99
            </span>
            . Outras cidades sob consulta pelo WhatsApp.
          </p>
        </div>

        <div className="relative min-h-[240px] bg-emerald-900 lg:col-span-6 lg:min-h-[380px]">
          <img
            src={heroImageUrl}
            alt={`Fachada e interior da ${config.storeName}`}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
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

      {/* Catálogo de produtos logo abaixo da área de destaque */}
      <section id="catalogo-produtos" className="mt-10">
        <div className="flex flex-col gap-4 border-b border-neutral-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
              Catálogo de Produtos
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Consulte preços por unidade ou por quilo e veja a indicação de cada item.
            </p>
          </div>

          <span className="font-mono tabular-nums text-xs text-neutral-500">
            {catalog.totalCount}{' '}
            {catalog.totalCount === 1 ? 'produto encontrado' : 'produtos encontrados'}
          </span>
        </div>

        {/* Barra de busca, filtros e ordenação no servidor */}
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por nome, animal ou descrição..."
              aria-label="Buscar produtos"
              className="h-11 w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-800 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por categoria"
              className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-emerald-800 focus:outline-none"
            >
              <option value="">Todas as categorias</option>
              {catalog.categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => {
                setPromoOnly((prev) => !prev);
                setPage(1);
              }}
              className={`h-11 w-full cursor-pointer rounded-lg border px-3 text-sm font-medium transition-colors whitespace-nowrap ${
                promoOnly
                  ? 'border-emerald-900 bg-emerald-900 text-white'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              Em promoção
            </button>
          </div>

          <div className="md:col-span-2">
            <select
              value={sort}
              onChange={(e) => {
                setSort(
                  e.target.value === 'price_desc' ? 'price_desc' : 'price_asc'
                );
                setPage(1);
              }}
              aria-label="Ordenar produtos"
              className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-emerald-800 focus:outline-none"
            >
              <option value="price_asc">Menor preço</option>
              <option value="price_desc">Maior preço</option>
            </select>
          </div>
        </div>

        {/* Estado de carregamento e erro */}
        {loading && (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-80 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100"
              />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && catalog.products.length === 0 && (
          <div className="mt-8 rounded-xl border border-neutral-200 bg-neutral-50 p-10 text-center">
            <p className="text-base font-semibold text-neutral-800">
              Nenhum produto encontrado
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              {appliedSearch || category || promoOnly
                ? 'Tente limpar os filtros de busca para ver todos os itens.'
                : 'Ainda não há produtos cadastrados no catálogo.'}
            </p>
          </div>
        )}

        {!loading && !error && catalog.products.length > 0 && (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.products.map((product) => {
              const hasPromoUnit =
                product.promo_price_unit !== null &&
                product.price_unit !== null &&
                Number(product.promo_price_unit) < Number(product.price_unit);
              const hasPromoKg =
                product.promo_price_kg !== null &&
                product.price_kg !== null &&
                Number(product.promo_price_kg) < Number(product.price_kg);

              const defaultUnitMode: UnitMode =
                product.sale_type === 'kg' ? 'kg' : 'unit';

              const outOfStock =
                product.manage_stock && Number(product.stock_quantity ?? 0) <= 0;

              return (
                <article
                  key={product.id}
                  className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => onSelectProduct(product.id)}
                    className="relative aspect-[4/3] w-full cursor-pointer overflow-hidden bg-neutral-50 text-left"
                  >
                    <ProductImage
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                  </button>

                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        {product.category && <span>{product.category}</span>}
                        {product.category && product.is_promo && (
                          <span aria-hidden="true">·</span>
                        )}
                        {product.is_promo && (
                          <span className="font-semibold text-emerald-800">
                            Promoção
                          </span>
                        )}
                        {product.avg_rating !== null &&
                          product.avg_rating !== undefined && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 text-neutral-700">
                                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                                {product.avg_rating}
                              </span>
                            </>
                          )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectProduct(product.id)}
                        className="mt-1.5 cursor-pointer text-left text-base font-bold text-neutral-900 hover:text-emerald-900"
                      >
                        {product.name}
                      </button>

                      <p className="mt-1.5 line-clamp-2 text-sm text-neutral-600">
                        {product.description}
                      </p>
                    </div>

                    <div className="mt-4 border-t border-neutral-100 pt-4">
                      <div className="space-y-1">
                        {(product.sale_type === 'unit' ||
                          product.sale_type === 'both') &&
                          product.price_unit !== null && (
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs text-neutral-500">
                                Por unidade
                              </span>
                              <div className="flex items-baseline gap-2">
                                {hasPromoUnit && (
                                  <span className="font-mono tabular-nums text-xs text-neutral-400 line-through">
                                    {formatCurrency(product.price_unit)}
                                  </span>
                                )}
                                <span className="font-mono tabular-nums text-base font-bold text-emerald-900">
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
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs text-neutral-500">
                                Por quilo
                              </span>
                              <div className="flex items-baseline gap-2">
                                {hasPromoKg && (
                                  <span className="font-mono tabular-nums text-xs text-neutral-400 line-through">
                                    {formatCurrency(product.price_kg)}
                                  </span>
                                )}
                                <span className="font-mono tabular-nums text-base font-bold text-emerald-900">
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

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectProduct(product.id)}
                          className="min-h-[42px] cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 whitespace-nowrap"
                        >
                          Detalhes
                        </button>
                        <button
                          type="button"
                          disabled={outOfStock}
                          onClick={() =>
                            onAddToCart(product, defaultUnitMode, 1)
                          }
                          className="min-h-[42px] flex-1 cursor-pointer rounded-lg bg-emerald-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-950 disabled:cursor-not-allowed disabled:bg-neutral-300 whitespace-nowrap"
                        >
                          {outOfStock ? 'Sem estoque' : 'Adicionar ao carrinho'}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Paginação (20 produtos por página) */}
        {!loading && catalog.totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex min-h-[42px] cursor-pointer items-center gap-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <span className="font-mono tabular-nums text-sm text-neutral-700">
              Página {catalog.page} de {catalog.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= catalog.totalPages}
              onClick={() =>
                setPage((p) => Math.min(catalog.totalPages, p + 1))
              }
              className="inline-flex min-h-[42px] cursor-pointer items-center gap-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
