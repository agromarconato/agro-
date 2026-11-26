import { Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import {
  formatCurrency,
  formatDateTime,
  formatProductCategories,
  formatStockDisplay,
} from '../lib/format';
import type { Product, ProductReview, UnitMode } from '../types';
import { ProductImage } from './ProductImage';

interface ProductDetailModalProps {
  productId: string | null;
  onClose: () => void;
  onAddToCart: (product: Product, unitMode: UnitMode, quantity: number) => void;
}

interface ProductDetailResponse {
  product: Product;
  reviews: ProductReview[];
  eligibleOrderIds: string[];
}

export function ProductDetailModal({
  productId,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const { accessToken, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProductDetailResponse | null>(null);
  const [unitMode, setUnitMode] = useState<UnitMode>('unit');
  const [quantity, setQuantity] = useState<number>(1);

  // Avaliação
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadDetail = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ProductDetailResponse>(`/api/products/${id}`, {
        token: accessToken,
      });
      setDetail(data);
      const defaultMode: UnitMode =
        data.product.sale_type === 'kg' ? 'kg' : 'unit';
      setUnitMode(defaultMode);
      setQuantity(1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao carregar detalhes do produto.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!productId) {
      setDetail(null);
      return;
    }
    loadDetail(productId);
  }, [productId, accessToken]);

  if (!productId) return null;

  const product = detail?.product;
  const activePrice =
    product && unitMode === 'unit'
      ? product.promo_price_unit &&
        product.price_unit &&
        Number(product.promo_price_unit) < Number(product.price_unit)
        ? Number(product.promo_price_unit)
        : Number(product.price_unit || 0)
      : product
        ? product.promo_price_kg &&
          product.price_kg &&
          Number(product.promo_price_kg) < Number(product.price_kg)
          ? Number(product.promo_price_kg)
          : Number(product.price_kg || 0)
        : 0;

  const originalPrice =
    product && unitMode === 'unit'
      ? Number(product.price_unit || 0)
      : product
        ? Number(product.price_kg || 0)
        : 0;

  const hasPromo = activePrice > 0 && originalPrice > activePrice;

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !detail?.eligibleOrderIds[0]) return;
    setReviewError(null);
    setReviewSuccess(null);
    setSubmittingReview(true);

    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        token: accessToken,
        body: {
          productId: product.id,
          orderId: detail.eligibleOrderIds[0],
          rating,
          comment: comment.trim(),
        },
      });
      setComment('');
      setReviewSuccess('Avaliação publicada com sucesso.');
      await loadDetail(product.id);
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : 'Não foi possível enviar sua avaliação.'
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes do produto"
    >
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
          aria-label="Fechar detalhes"
        >
          <X className="h-5 w-5" />
        </button>

        {loading && (
          <div className="p-12 text-center text-sm text-neutral-600">
            Carregando informações do produto...
          </div>
        )}

        {error && !loading && (
          <div className="p-8 text-center text-sm text-red-700">{error}</div>
        )}

        {product && !loading && (
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 aspect-[4/3]">
                <ProductImage
                  src={product.image_url}
                  alt={product.name}
                  className="h-full w-full"
                />
              </div>

              <div className="flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    {formatProductCategories(product).length > 0 && (
                      <span>{formatProductCategories(product).join(' · ')}</span>
                    )}
                    {formatProductCategories(product).length > 0 &&
                      product.is_promo && <span aria-hidden="true">·</span>}
                    {product.is_promo && (
                      <span className="font-semibold text-emerald-800">
                        Em promoção
                      </span>
                    )}
                    {product.avg_rating !== null && product.avg_rating !== undefined && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-medium text-neutral-700">
                          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                          {product.avg_rating} ({product.review_count})
                        </span>
                      </>
                    )}
                  </div>

                  <h2 className="mt-2 text-2xl font-bold text-neutral-900">
                    {product.name}
                  </h2>

                  <div className="mt-4">
                    {hasPromo && (
                      <div className="font-mono tabular-nums text-sm text-neutral-400 line-through">
                        {formatCurrency(originalPrice)}
                      </div>
                    )}
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono tabular-nums text-2xl font-bold text-emerald-900">
                        {formatCurrency(activePrice)}
                      </span>
                      <span className="text-sm text-neutral-600">
                        / {unitMode === 'kg' ? 'quilo (kg)' : 'unidade'}
                      </span>
                    </div>
                  </div>

                  {product.sale_type === 'both' && (
                    <div className="mt-5">
                      <span className="block text-xs font-medium text-neutral-700">
                        Tipo de venda
                      </span>
                      <div className="mt-2 inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
                        <button
                          type="button"
                          onClick={() => {
                            setUnitMode('unit');
                            setQuantity(1);
                          }}
                          className={`min-h-[36px] cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                            unitMode === 'unit'
                              ? 'bg-emerald-900 text-white'
                              : 'text-neutral-700 hover:text-neutral-900'
                          }`}
                        >
                          Por unidade
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUnitMode('kg');
                            setQuantity(1);
                          }}
                          className={`min-h-[36px] cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                            unitMode === 'kg'
                              ? 'bg-emerald-900 text-white'
                              : 'text-neutral-700 hover:text-neutral-900'
                          }`}
                        >
                          Por quilo (kg)
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-5">
                    <label
                      htmlFor="detail-qty"
                      className="block text-xs font-medium text-neutral-700"
                    >
                      Quantidade ({unitMode === 'kg' ? 'kg' : 'un'})
                    </label>
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        id="detail-qty"
                        type="number"
                        min={unitMode === 'kg' ? 0.5 : 1}
                        step={unitMode === 'kg' ? 0.5 : 1}
                        value={quantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (Number.isFinite(val) && val > 0) {
                            setQuantity(
                              unitMode === 'unit' ? Math.max(1, Math.floor(val)) : val
                            );
                          }
                        }}
                        className="h-11 w-28 rounded-lg border border-neutral-300 px-3 font-mono tabular-nums text-sm text-neutral-900 focus:border-emerald-800 focus:outline-none"
                      />
                      {product.manage_stock && (
                        <span className="text-xs text-neutral-500">
                          Estoque disponível:{' '}
                          <strong className="font-mono tabular-nums text-neutral-800">
                            {formatStockDisplay(product.stock_quantity, unitMode)}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      disabled={
                        product.manage_stock &&
                        Number(product.stock_quantity ?? 0) <= 0
                      }
                      onClick={() => onAddToCart(product, unitMode, quantity)}
                      className="min-h-[46px] w-full cursor-pointer rounded-lg bg-emerald-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-950 disabled:cursor-not-allowed disabled:bg-neutral-300"
                    >
                      {product.manage_stock &&
                      Number(product.stock_quantity ?? 0) <= 0
                        ? 'Produto sem estoque'
                        : 'Adicionar ao carrinho'}
                    </button>
                  </div>
                </div>

                <div className="mt-6 border-t border-neutral-200 pt-5">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Descrição e indicações
                  </h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-700">
                    {product.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Avaliações */}
            <div className="mt-8 border-t border-neutral-200 pt-6">
              <h3 className="text-base font-bold text-neutral-900">
                Avaliações de clientes ({detail.reviews.length})
              </h3>

              {user && detail.eligibleOrderIds.length > 0 && (
                <form
                  onSubmit={handleSubmitReview}
                  className="mt-4 rounded-lg border border-emerald-900/15 bg-emerald-50/40 p-4"
                >
                  <p className="text-sm font-semibold text-emerald-950">
                    Avaliar produto entregue
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-700">
                      Sua nota:
                    </span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="cursor-pointer p-1"
                          aria-label={`Nota ${star} estrelas`}
                        >
                          <Star
                            className={`h-5 w-5 ${
                              star <= rating
                                ? 'fill-amber-500 text-amber-500'
                                : 'text-neutral-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value.slice(0, 150))}
                      maxLength={150}
                      rows={2}
                      required
                      placeholder="Conte o que achou do produto (máximo 150 caracteres)..."
                      className="w-full rounded-lg border border-neutral-300 bg-white p-3 text-sm text-neutral-900 focus:border-emerald-800 focus:outline-none"
                    />
                    <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                      <span>{comment.length}/150 caracteres</span>
                      <button
                        type="submit"
                        disabled={submittingReview}
                        className="min-h-[38px] cursor-pointer rounded-lg bg-emerald-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-950 disabled:opacity-50"
                      >
                        {submittingReview ? 'Enviando...' : 'Publicar avaliação'}
                      </button>
                    </div>
                  </div>
                  {reviewError && (
                    <p className="mt-2 text-xs text-red-700">{reviewError}</p>
                  )}
                  {reviewSuccess && (
                    <p className="mt-2 text-xs text-emerald-800">{reviewSuccess}</p>
                  )}
                </form>
              )}

              {detail.reviews.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-500">
                  Este produto ainda não possui avaliações. Apenas clientes com pedido entregue podem avaliar.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-neutral-200">
                  {detail.reviews.map((rev) => (
                    <div key={rev.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-neutral-900">
                            {rev.authorName}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-amber-500">
                            {Array.from({ length: rev.rating }).map((_, idx) => (
                              <Star
                                key={idx}
                                className="h-3.5 w-3.5 fill-amber-500"
                              />
                            ))}
                          </span>
                        </div>
                        <span className="text-xs text-neutral-500">
                          {formatDateTime(rev.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-700">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
