import { ArrowLeft, CheckCircle2, MessageCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import {
  buildWhatsappLink,
  formatCepInput,
  formatCurrency,
  isIratiPr,
} from '../lib/format';
import type { StoreConfig } from '../types';

interface CheckoutViewProps {
  config: StoreConfig;
  onBackToCatalog: () => void;
  onOrderCreated: () => void;
}

interface CepResponse {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  isIrati: boolean;
  shippingFee: number | null;
}

interface CreatedOrderResponse {
  order: {
    order_id: string;
    order_number: number;
    subtotal: number;
    shipping_fee: number;
    total: number;
  };
  paymentConfigured: boolean;
  paymentNotice: string;
}

export function CheckoutView({
  config,
  onBackToCatalog,
  onOrderCreated,
}: CheckoutViewProps) {
  const { accessToken, cart, refreshCart } = useAuth();

  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [stateUf, setStateUf] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');

  const [cepLoading, setCepLoading] = useState(false);
  const [cepFeedback, setCepFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] =
    useState<CreatedOrderResponse | null>(null);

  const addressEntered = city.trim().length >= 2 && stateUf.trim().length === 2;
  const iratiEligible = addressEntered && isIratiPr(city, stateUf);
  const outsideIrati = addressEntered && !iratiEligible;

  const shippingFee = iratiEligible ? 4.99 : 0;
  const estimatedTotal = Number((cart.subtotal + shippingFee).toFixed(2));

  const outsideIratiWhatsappUrl = useMemo(() => {
    const itemsSummary = cart.items
      .map(
        (i) =>
          `- ${i.quantity} ${i.unitMode === 'kg' ? 'kg' : 'un'} x ${i.productName}`
      )
      .join('\n');
    const text = `Olá! Gostaria de combinar o frete para entrega fora de Irati.\nCidade/UF: ${city}/${stateUf.toUpperCase()} (CEP ${cep})\nItens:\n${itemsSummary}`;
    return buildWhatsappLink(config.whatsappNumber, text);
  }, [cart.items, cep, city, stateUf, config.whatsappNumber]);

  const lookupCep = async (rawCep: string) => {
    const digits = rawCep.replace(/\D/g, '');
    if (digits.length !== 8) {
      setCepFeedback('Informe os 8 dígitos do CEP para buscar.');
      return;
    }

    setCepLoading(true);
    setCepFeedback(null);
    try {
      const data = await apiFetch<CepResponse>(`/api/cep/${digits}`);
      if (data.street) setStreet(data.street);
      if (data.neighborhood) setNeighborhood(data.neighborhood);
      if (data.city) setCity(data.city);
      if (data.state) setStateUf(data.state);
      setCepFeedback(
        data.isIrati
          ? 'CEP de Irati-PR identificado. Frete fixo de R$ 4,99 aplicável.'
          : `Endereço em ${data.city}/${data.state}. Complete ou ajuste se necessário.`
      );
    } catch (err) {
      setCepFeedback(
        err instanceof Error
          ? err.message
          : 'Não foi possível consultar o CEP. Preencha manualmente.'
      );
    } finally {
      setCepLoading(false);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!iratiEligible) {
      setError(
        'Entregas fora de Irati-PR exigem combinação de frete pelo WhatsApp.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiFetch<CreatedOrderResponse>('/api/orders', {
        method: 'POST',
        token: accessToken,
        body: {
          idempotencyKey,
          paymentMethod,
          shipping: {
            cep,
            street: street.trim(),
            number: number.trim(),
            complement: complement.trim() || null,
            neighborhood: neighborhood.trim(),
            city: city.trim(),
            state: stateUf.trim().toUpperCase(),
          },
          notes: notes.trim() || null,
          saveAddress: true,
        },
      });
      await refreshCart();
      setConfirmedOrder(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível finalizar o pedido.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmedOrder) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-emerald-900/20 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 text-emerald-900">
            <CheckCircle2 className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">
                Pedido #{confirmedOrder.order.order_number} registrado
              </h1>
              <p className="text-sm text-neutral-600">
                Valores conferidos e salvos com segurança no servidor.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-600">Subtotal dos produtos</span>
              <span className="font-mono tabular-nums font-medium">
                {formatCurrency(confirmedOrder.order.subtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Frete (Irati-PR)</span>
              <span className="font-mono tabular-nums font-medium">
                {formatCurrency(confirmedOrder.order.shipping_fee)}
              </span>
            </div>
            <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-emerald-950">
              <span>Total do pedido</span>
              <span className="font-mono tabular-nums">
                {formatCurrency(confirmedOrder.order.total)}
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Informação sobre pagamento</p>
            <p className="mt-1">{confirmedOrder.paymentNotice}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onOrderCreated}
              className="min-h-[44px] cursor-pointer rounded-lg bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-950"
            >
              Acompanhar meus pedidos
            </button>
            <a
              href={buildWhatsappLink(
                config.whatsappNumber,
                `Olá! Acabei de registrar o pedido #${confirmedOrder.order.order_number} na ${config.storeName} e gostaria de confirmar o pagamento.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-emerald-900 px-5 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
            >
              <MessageCircle className="h-4 w-4" />
              Falar sobre este pedido no WhatsApp
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (cart.items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-neutral-900">
          Seu carrinho está vazio
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Adicione produtos do catálogo antes de ir para a entrega e pagamento.
        </p>
        <button
          type="button"
          onClick={onBackToCatalog}
          className="mt-6 min-h-[44px] cursor-pointer rounded-lg bg-emerald-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-950"
        >
          Voltar ao catálogo
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={onBackToCatalog}
        className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-emerald-900 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para o catálogo
      </button>

      <h1 className="mt-4 text-2xl font-bold text-neutral-900">
        Entrega e Pagamento
      </h1>

      <form
        onSubmit={handleSubmitOrder}
        className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12"
      >
        <div className="space-y-6 lg:col-span-7">
          {/* Endereço de entrega */}
          <section className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-bold text-neutral-900">
              Endereço de entrega
            </h2>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="chk-cep"
                  className="block text-sm font-medium text-neutral-800"
                >
                  CEP
                </label>
                <input
                  id="chk-cep"
                  type="text"
                  required
                  inputMode="numeric"
                  value={cep}
                  onChange={(e) => {
                    const formatted = formatCepInput(e.target.value);
                    setCep(formatted);
                    if (formatted.replace(/\D/g, '').length === 8) {
                      lookupCep(formatted);
                    }
                  }}
                  placeholder="84500-000"
                  className="mt-1 h-11 w-full rounded-lg border border-neutral-300 px-3.5 font-mono tabular-nums text-sm"
                />
              </div>
              <button
                type="button"
                disabled={cepLoading}
                onClick={() => lookupCep(cep)}
                className="min-h-[44px] cursor-pointer rounded-lg border border-emerald-900 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50 whitespace-nowrap"
              >
                {cepLoading ? 'Buscando...' : 'Buscar CEP'}
              </button>
            </div>

            {cepFeedback && (
              <p className="mt-2 text-xs text-neutral-600">{cepFeedback}</p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-8">
                <label
                  htmlFor="chk-street"
                  className="block text-sm font-medium text-neutral-800"
                >
                  Rua / Avenida
                </label>
                <input
                  id="chk-street"
                  type="text"
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-neutral-300 px-3.5 text-sm"
                />
              </div>

              <div className="sm:col-span-4">
                <label
                  htmlFor="chk-number"
                  className="block text-sm font-medium text-neutral-800"
                >
                  Número
                </label>
                <input
                  id="chk-number"
                  type="text"
                  required
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-neutral-300 px-3.5 text-sm"
                />
              </div>

              <div className="sm:col-span-6">
                <label
                  htmlFor="chk-complement"
                  className="block text-sm font-medium text-neutral-800"
                >
                  Complemento (opcional)
                </label>
                <input
                  id="chk-complement"
                  type="text"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  placeholder="Casa, apto, referência..."
                  className="mt-1 h-11 w-full rounded-lg border border-neutral-300 px-3.5 text-sm"
                />
              </div>

              <div className="sm:col-span-6">
                <label
                  htmlFor="chk-neighborhood"
                  className="block text-sm font-medium text-neutral-800"
                >
                  Bairro
                </label>
                <input
                  id="chk-neighborhood"
                  type="text"
                  required
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-neutral-300 px-3.5 text-sm"
                />
              </div>

              <div className="sm:col-span-8">
                <label
                  htmlFor="chk-city"
                  className="block text-sm font-medium text-neutral-800"
                >
                  Cidade
                </label>
                <input
                  id="chk-city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Irati"
                  className="mt-1 h-11 w-full rounded-lg border border-neutral-300 px-3.5 text-sm"
                />
              </div>

              <div className="sm:col-span-4">
                <label
                  htmlFor="chk-state"
                  className="block text-sm font-medium text-neutral-800"
                >
                  Estado (UF)
                </label>
                <input
                  id="chk-state"
                  type="text"
                  required
                  maxLength={2}
                  value={stateUf}
                  onChange={(e) => setStateUf(e.target.value.toUpperCase())}
                  placeholder="PR"
                  className="mt-1 h-11 w-full rounded-lg border border-neutral-300 px-3.5 font-mono uppercase text-sm"
                />
              </div>
            </div>

            {iratiEligible && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-950">
                Entrega em <strong>Irati, Paraná</strong> confirmada — frete fixo de{' '}
                <strong className="font-mono tabular-nums">R$ 4,99</strong>.
              </div>
            )}

            {outsideIrati && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-semibold">
                  Entrega fora de Irati-PR sob combinação
                </p>
                <p className="mt-1">
                  Para entregas fora de Irati, o frete é combinado diretamente pelo
                  nosso WhatsApp ({config.whatsappNumber}). Não é possível
                  finalizar automaticamente com frete estimado.
                </p>
                <a
                  href={outsideIratiWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-950"
                >
                  <MessageCircle className="h-4 w-4" />
                  Combinar frete pelo WhatsApp
                </a>
              </div>
            )}
          </section>

          {/* Forma de pagamento */}
          <section className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-bold text-neutral-900">
              Forma de pagamento
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('pix')}
                className={`min-h-[54px] cursor-pointer rounded-lg border p-4 text-left transition-colors ${
                  paymentMethod === 'pix'
                    ? 'border-emerald-900 bg-emerald-50'
                    : 'border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <span className="block text-sm font-bold text-neutral-900">
                  Pix
                </span>
                <span className="mt-0.5 block text-xs text-neutral-600">
                  Pagamento instantâneo
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`min-h-[54px] cursor-pointer rounded-lg border p-4 text-left transition-colors ${
                  paymentMethod === 'card'
                    ? 'border-emerald-900 bg-emerald-50'
                    : 'border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <span className="block text-sm font-bold text-neutral-900">
                  Cartão
                </span>
                <span className="mt-0.5 block text-xs text-neutral-600">
                  Crédito ou débito
                </span>
              </button>
            </div>

            {!config.paymentConfigured && (
              <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3.5 text-xs leading-relaxed text-neutral-700">
                <strong>Aviso de pagamento:</strong> Nenhum provedor de pagamento
                online (<code className="font-mono">PAYMENT_PROVIDER_SECRET_KEY</code>)
                está configurado no momento. O pedido será registrado com o método
                selecionado e aguardando confirmação da loja.
              </div>
            )}

            <div className="mt-4">
              <label
                htmlFor="chk-notes"
                className="block text-sm font-medium text-neutral-800"
              >
                Observações do pedido (opcional)
              </label>
              <textarea
                id="chk-notes"
                rows={2}
                maxLength={400}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Entregar no portão lateral..."
                className="mt-1 w-full rounded-lg border border-neutral-300 p-3 text-sm"
              />
            </div>
          </section>
        </div>

        {/* Resumo do pedido */}
        <aside className="lg:col-span-5">
          <div className="sticky top-24 rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-bold text-neutral-900">
              Resumo da compra
            </h2>

            <div className="mt-4 divide-y divide-neutral-100">
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-neutral-900">
                      {item.productName}
                    </p>
                    <p className="font-mono tabular-nums text-xs text-neutral-500">
                      {item.quantity} {item.unitMode === 'kg' ? 'kg' : 'un'} ×{' '}
                      {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-neutral-900">
                    {formatCurrency(item.lineTotal)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">Subtotal</span>
                <span className="font-mono tabular-nums font-medium">
                  {formatCurrency(cart.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Frete</span>
                <span className="font-mono tabular-nums font-medium">
                  {iratiEligible
                    ? formatCurrency(4.99)
                    : outsideIrati
                      ? 'Combinar no WhatsApp'
                      : 'Informe o endereço'}
                </span>
              </div>
              <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-emerald-950">
                <span>Total</span>
                <span className="font-mono tabular-nums">
                  {iratiEligible
                    ? formatCurrency(estimatedTotal)
                    : formatCurrency(cart.subtotal)}
                </span>
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !iratiEligible}
              className="mt-5 min-h-[48px] w-full cursor-pointer rounded-lg bg-emerald-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-950 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {submitting ? 'Registrando pedido...' : 'Confirmar pedido'}
            </button>
          </div>
        </aside>
      </form>
    </main>
  );
}
