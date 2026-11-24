import { MessageCircle, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  buildWhatsappLink,
  formatCurrency,
  formatDateTime,
} from '../lib/format';
import type { OrderRecord, StoreConfig } from '../types';

interface OrdersViewProps {
  config: StoreConfig;
  onGoToCatalog: () => void;
}

export function OrdersView({ config, onGoToCatalog }: OrdersViewProps) {
  const { accessToken } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Avaliação em linha para itens entregues
  const [reviewTarget, setReviewTarget] = useState<{
    orderId: string;
    productId: string;
    productName: string;
  } | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ orders: OrderRecord[] }>('/api/orders', {
        token: accessToken,
      });
      setOrders(data.orders);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao carregar seus pedidos.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [accessToken]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    setReviewError(null);
    setReviewBusy(true);
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        token: accessToken,
        body: {
          orderId: reviewTarget.orderId,
          productId: reviewTarget.productId,
          rating,
          comment: comment.trim(),
        },
      });
      setReviewTarget(null);
      setComment('');
      setRating(5);
      await loadOrders();
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : 'Erro ao publicar avaliação.'
      );
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Meus Pedidos</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Acompanhe o andamento das suas compras e avalie os itens após a entrega.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToCatalog}
          className="min-h-[42px] cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          Voltar ao catálogo
        </button>
      </div>

      {loading && (
        <div className="py-12 text-center text-sm text-neutral-600">
          Carregando seus pedidos...
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="mt-8 rounded-xl border border-neutral-200 bg-neutral-50 p-10 text-center">
          <p className="text-base font-semibold text-neutral-800">
            Você ainda não possui pedidos
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            Explore o catálogo e adicione produtos ao carrinho para fazer seu primeiro pedido.
          </p>
          <button
            type="button"
            onClick={onGoToCatalog}
            className="mt-5 min-h-[44px] cursor-pointer rounded-lg bg-emerald-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-950"
          >
            Ver catálogo
          </button>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {orders.map((order) => {
          const payment = Array.isArray(order.payments)
            ? order.payments[0]
            : order.payments;

          return (
            <section
              key={order.id}
              className="rounded-xl border border-neutral-200 bg-white p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <span className="font-mono tabular-nums font-bold text-neutral-900">
                      Pedido #{order.order_number}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDateTime(order.created_at)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-emerald-900">
                      {ORDER_STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-neutral-600">
                    Entrega: {order.shipping_street}, {order.shipping_number}
                    {order.shipping_complement
                      ? ` (${order.shipping_complement})`
                      : ''}{' '}
                    — {order.shipping_neighborhood}, {order.shipping_city}/
                    {order.shipping_state} · CEP {order.shipping_cep}
                  </p>
                </div>

                <a
                  href={buildWhatsappLink(
                    config.whatsappNumber,
                    `Olá! Gostaria de falar sobre o pedido #${order.order_number} na ${config.storeName}.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-emerald-900/20 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Suporte do pedido
                </a>
              </div>

              <div className="mt-4 divide-y divide-neutral-100">
                {order.order_items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {item.product_name}
                      </p>
                      <p className="font-mono tabular-nums text-xs text-neutral-500">
                        {item.quantity} {item.unit_mode === 'kg' ? 'kg' : 'un'} ×{' '}
                        {formatCurrency(item.unit_price)}
                      </p>
                      {item.my_review && (
                        <p className="mt-1 text-xs text-emerald-900">
                          Sua avaliação: {item.my_review.rating}/5 — "
                          {item.my_review.comment}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      {order.status === 'delivered' && !item.my_review && (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewTarget({
                              orderId: order.id,
                              productId: item.product_id,
                              productName: item.product_name,
                            });
                            setReviewError(null);
                            setRating(5);
                            setComment('');
                          }}
                          className="min-h-[36px] cursor-pointer rounded-lg border border-emerald-900 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                        >
                          Avaliar produto
                        </button>
                      )}
                      <span className="font-mono tabular-nums text-sm font-bold text-neutral-900">
                        {formatCurrency(item.line_total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {reviewTarget && reviewTarget.orderId === order.id && (
                <form
                  onSubmit={handleSubmitReview}
                  className="mt-4 rounded-lg border border-emerald-900/20 bg-emerald-50/40 p-4"
                >
                  <p className="text-sm font-semibold text-neutral-900">
                    Avaliar: {reviewTarget.productName}
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="cursor-pointer p-1"
                        aria-label={`Nota ${star}`}
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
                  <textarea
                    required
                    maxLength={150}
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value.slice(0, 150))}
                    placeholder="Escreva sua avaliação em até 150 caracteres..."
                    className="mt-2 w-full rounded-lg border border-neutral-300 bg-white p-2.5 text-sm"
                  />
                  {reviewError && (
                    <p className="mt-1 text-xs text-red-700">{reviewError}</p>
                  )}
                  <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                    <span>{comment.length}/150 caracteres</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setReviewTarget(null)}
                        className="min-h-[36px] cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-700"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={reviewBusy}
                        className="min-h-[36px] cursor-pointer rounded-lg bg-emerald-900 px-4 text-xs font-semibold text-white"
                      >
                        {reviewBusy ? 'Enviando...' : 'Enviar avaliação'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-100 pt-4 text-sm">
                <div className="text-xs text-neutral-600">
                  {payment && (
                    <>
                      Pagamento:{' '}
                      <strong>
                        {PAYMENT_METHOD_LABELS[payment.method] || payment.method}
                      </strong>{' '}
                      — {PAYMENT_STATUS_LABELS[payment.status] || payment.status}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums text-xs text-neutral-700">
                  <span>Subtotal: {formatCurrency(order.subtotal)}</span>
                  <span>Frete: {formatCurrency(order.shipping_fee)}</span>
                  <span className="text-sm font-bold text-emerald-950">
                    Total: {formatCurrency(order.total)}
                  </span>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
