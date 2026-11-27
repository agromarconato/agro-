import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  MessageCircle,
  Package,
  RefreshCw,
  ShoppingBag,
  Star,
  Store,
  Truck,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ProductImage } from '../components/ProductImage';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import {
  ORDER_STATUS_LABELS,
  PICKUP_NOTICE_TEXT,
  buildWhatsappLink,
  formatCurrency,
  formatDateTime,
  formatDeliveryModeInfo,
  formatPaymentSummary,
  formatUnitShort,
} from '../lib/format';
import type { OrderRecord, OrderStatus, StoreConfig } from '../types';

interface OrdersViewProps {
  config: StoreConfig;
  onGoToCatalog: () => void;
}

function getOrderStatusStyle(status: OrderStatus | string) {
  switch (status) {
    case 'delivered':
      return {
        badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-900',
        Icon: CheckCircle2,
      };
    case 'paid':
      return {
        badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        Icon: CheckCircle2,
      };
    case 'preparing':
      return {
        badgeClass: 'border-teal-200 bg-teal-50 text-teal-900',
        Icon: Package,
      };
    case 'out_for_delivery':
      return {
        badgeClass: 'border-sky-200 bg-sky-50 text-sky-900',
        Icon: Truck,
      };
    case 'cancelled':
      return {
        badgeClass: 'border-red-200 bg-red-50 text-red-800',
        Icon: XCircle,
      };
    case 'awaiting_confirmation':
    case 'pending_payment':
    default:
      return {
        badgeClass: 'border-amber-200 bg-amber-50 text-amber-900',
        Icon: Clock,
      };
  }
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
      {/* Cabeçalho da página Meus Pedidos */}
      <div className="flex flex-col gap-4 border-b border-neutral-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onGoToCatalog}
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-emerald-900 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao catálogo
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
              Meus Pedidos
            </h1>
            {!loading && orders.length > 0 && (
              <span className="inline-flex items-center rounded-lg bg-emerald-900/10 px-2.5 py-1 font-mono tabular-nums text-xs font-bold text-emerald-950">
                {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            Acompanhe o andamento das suas compras, entrega ou retirada na loja e avalie os produtos entregues.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-xs transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-emerald-900 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {loading && (
        <div className="mt-6 space-y-4">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={idx}
              className="h-52 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-100"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-900/10 text-emerald-900">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <p className="mt-3 text-base font-bold text-neutral-900">
            Você ainda não possui pedidos
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            Explore o catálogo e adicione produtos ao carrinho para fazer seu primeiro pedido.
          </p>
          <button
            type="button"
            onClick={onGoToCatalog}
            className="mt-5 min-h-[44px] cursor-pointer rounded-xl bg-emerald-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-950"
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
          const paymentSummary = formatPaymentSummary(payment);
          const deliveryInfo = formatDeliveryModeInfo(order);
          const statusStyle = getOrderStatusStyle(order.status);
          const StatusIcon = statusStyle.Icon;

          return (
            <section
              key={order.id}
              className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
            >
              {/* Barra superior de destaque: Pedido #, Data, Status e Valor Total */}
              <div className="flex flex-col gap-4 border-b border-neutral-200/80 bg-emerald-950/[0.025] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono tabular-nums text-base font-extrabold text-neutral-900 sm:text-lg">
                      Pedido #{order.order_number}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${statusStyle.badgeClass}`}
                    >
                      <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                      <span>{ORDER_STATUS_LABELS[order.status] || order.status}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-600">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    <span>Realizado em {formatDateTime(order.created_at)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1.5">
                  <div className="text-left sm:text-right">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      Valor total
                    </span>
                    <span className="font-mono tabular-nums text-lg font-extrabold text-emerald-950 sm:text-xl">
                      {formatCurrency(order.total)}
                    </span>
                  </div>
                  <a
                    href={buildWhatsappLink(
                      config.whatsappNumber,
                      `Olá! Gostaria de falar sobre o pedido #${order.order_number} na ${config.storeName}.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-emerald-900/25 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-50"
                  >
                    <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Falar no WhatsApp</span>
                  </a>
                </div>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                {/* Bloco da modalidade de entrega ou retirada na loja */}
                <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-900/10 text-emerald-900">
                      {deliveryInfo.isPickup ? (
                        <Store className="h-4 w-4" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold uppercase tracking-wide text-emerald-900">
                        {deliveryInfo.label}
                      </span>
                      <p className="mt-0.5 text-sm text-neutral-800 break-words">
                        {deliveryInfo.isPickup
                          ? 'Retirada presencial na loja Agro Marconato — Irati/PR (sem taxa de frete).'
                          : deliveryInfo.detail}
                      </p>
                    </div>
                  </div>

                  {deliveryInfo.isPickup && (
                    <div
                      role="note"
                      className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-950"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      <span>
                        {deliveryInfo.detail || PICKUP_NOTICE_TEXT}
                      </span>
                    </div>
                  )}
                </div>

                {/* Lista detalhada dos itens comprados */}
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                    Itens do pedido ({order.order_items.length})
                  </h2>

                  <div className="mt-2.5 divide-y divide-neutral-100 rounded-xl border border-neutral-200/80 bg-white">
                    {order.order_items.map((item) => {
                      const unitShort = formatUnitShort(item.unit_mode);
                      return (
                        <div
                          key={item.id}
                          className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-center gap-3.5">
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white p-1">
                              <ProductImage
                                src={item.product_image_url}
                                alt={item.product_name}
                                fit="contain"
                                className="h-full w-full"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-neutral-900 break-words">
                                {item.product_name}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 font-mono tabular-nums text-xs text-neutral-600">
                                <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-semibold text-neutral-800">
                                  {item.quantity} {unitShort}
                                </span>
                                <span>×</span>
                                <span>
                                  {formatCurrency(item.unit_price)} / {unitShort}
                                </span>
                              </div>
                              {item.my_review && (
                                <p className="mt-1.5 text-xs font-medium text-emerald-900">
                                  Sua avaliação ({item.my_review.rating}/5): &ldquo;
                                  {item.my_review.comment}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-2 sm:border-t-0 sm:pt-0 sm:justify-end">
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
                            <span className="font-mono tabular-nums text-sm font-extrabold text-neutral-900">
                              {formatCurrency(item.line_total)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Formulário inline de avaliação */}
                {reviewTarget && reviewTarget.orderId === order.id && (
                  <form
                    onSubmit={handleSubmitReview}
                    className="rounded-xl border border-emerald-900/20 bg-emerald-50/40 p-4"
                  >
                    <p className="text-sm font-bold text-neutral-900">
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
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
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

                {/* Rodapé: Forma de pagamento + Resumo financeiro */}
                <div className="grid grid-cols-1 gap-4 border-t border-neutral-100 pt-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-3.5 text-xs text-neutral-700">
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-neutral-500">
                      <CreditCard className="h-3.5 w-3.5 text-emerald-800" />
                      <span>Pagamento</span>
                    </div>
                    {paymentSummary ? (
                      <div className="mt-1.5 space-y-1">
                        <p className="text-sm font-bold text-neutral-900">
                          {paymentSummary.primary}
                        </p>
                        <p className="font-medium text-emerald-900">
                          Situação: {paymentSummary.statusLabel}
                        </p>
                        {paymentSummary.extras.length > 0 && (
                          <p className="text-neutral-600">
                            {paymentSummary.extras.join(' · ')}
                          </p>
                        )}
                        {paymentSummary.note && (
                          <p className="text-neutral-500">{paymentSummary.note}</p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-neutral-500">
                        Informações de pagamento registradas no pedido.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col justify-center rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-3.5 text-xs">
                    <div className="flex items-center justify-between py-1 text-neutral-600">
                      <span>Subtotal dos itens</span>
                      <span className="font-mono tabular-nums font-semibold text-neutral-900">
                        {formatCurrency(order.subtotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 text-neutral-600">
                      <span>
                        {deliveryInfo.isPickup
                          ? 'Frete (Retirar na loja)'
                          : 'Frete'}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-neutral-900">
                        {deliveryInfo.isPickup && Number(order.shipping_fee) === 0
                          ? 'Grátis (R$ 0,00)'
                          : formatCurrency(order.shipping_fee)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between border-t border-neutral-200 pt-2 text-sm font-extrabold text-emerald-950">
                      <span>Total do pedido</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
