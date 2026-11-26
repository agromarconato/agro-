import type {
  OrderPayment,
  OrderRecord,
  Product,
  SaleType,
  UnitMode,
} from '../types';

export const PICKUP_NOTICE_TEXT =
  'Você tem até 7 dias para retirar seu pedido na loja.';

export function formatStockQuantity(
  value: number | string | null | undefined
): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num <= 0) return '0';
  return Math.trunc(num).toLocaleString('pt-BR', {
    maximumFractionDigits: 0,
  });
}

export function formatStockDisplay(
  value: number | string | null | undefined,
  saleType?: SaleType | UnitMode | null
): string {
  const num = Number(value ?? 0);
  const intVal = Number.isFinite(num) && num > 0 ? Math.trunc(num) : 0;
  const formatted = intVal.toLocaleString('pt-BR', {
    maximumFractionDigits: 0,
  });
  if (saleType === 'kg') {
    return `${formatted} kg`;
  }
  return `${formatted} ${intVal === 1 ? 'unidade' : 'unidades'}`;
}

export function formatCurrency(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatCpfInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatCpfDisplay(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatCepInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function normalizeCity(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function isIratiPr(city: string, state: string): boolean {
  return normalizeCity(city) === 'irati' && state.trim().toUpperCase() === 'PR';
}

export function buildWhatsappLink(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, '');
  const base = `https://wa.me/${digits}`;
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Aguardando pagamento',
  awaiting_confirmation: 'Aguardando confirmação',
  paid: 'Pago',
  preparing: 'Em separação',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending_configuration: 'Aguardando confirmação da loja',
  pending: 'Pendente',
  authorized: 'Autorizado (aguardando webhook)',
  paid: 'Confirmado',
  failed: 'Recusado / Não aprovado',
  refunded: 'Estornado',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  card: 'Cartão',
  credit_card: 'Cartão de crédito online',
  debit_card: 'Cartão de débito online',
  cash_on_delivery: 'Pagamento na entrega',
};

export function formatPaymentSummary(
  payment: OrderPayment | null | undefined
): {
  primary: string;
  statusLabel: string;
  extras: string[];
  note: string | null;
} | null {
  if (!payment) return null;
  const details = payment.details || {};
  const primary =
    details.label ||
    PAYMENT_METHOD_LABELS[details.selectedMethod || payment.method] ||
    PAYMENT_METHOD_LABELS[payment.method] ||
    payment.method;

  const statusLabel = PAYMENT_STATUS_LABELS[payment.status] || payment.status;
  const extras: string[] = [];

  if (details.channel === 'on_delivery') {
    extras.push('Receber pagamento na entrega');
  } else if (details.channel === 'online') {
    extras.push('Pagamento online');
  }

  if (details.changeFor) {
    extras.push(`Troco para: ${details.changeFor}`);
  }

  if (details.installments && Number(details.installments) > 0) {
    extras.push(
      Number(details.installments) === 1
        ? 'À vista (1x)'
        : `Parcelado em ${details.installments}x`
    );
  }

  if (details.cardBrand || details.cardLastFour) {
    const brand = details.cardBrand
      ? String(details.cardBrand).toUpperCase()
      : 'Cartão';
    const last4 = details.cardLastFour ? ` final ${details.cardLastFour}` : '';
    extras.push(`${brand}${last4}`);
  }

  return {
    primary,
    statusLabel,
    extras,
    note: details.note || null,
  };
}

export function formatDeliveryModeInfo(order: OrderRecord): {
  isPickup: boolean;
  label: string;
  detail: string;
} {
  const payment = Array.isArray(order.payments)
    ? order.payments[0]
    : order.payments;
  const isPickup =
    order.delivery_mode === 'pickup' ||
    payment?.details?.deliveryMode === 'pickup';

  if (isPickup) {
    return {
      isPickup: true,
      label: 'Retirar na loja',
      detail:
        payment?.details?.pickupNotice ||
        PICKUP_NOTICE_TEXT,
    };
  }

  const addressLine = `${order.shipping_street}, ${order.shipping_number}${
    order.shipping_complement ? ` (${order.shipping_complement})` : ''
  } — ${order.shipping_neighborhood}, ${order.shipping_city}/${order.shipping_state} · CEP ${order.shipping_cep}`;

  return {
    isPickup: false,
    label: 'Entrega no endereço',
    detail: addressLine,
  };
}

export function formatProductCategories(
  product: Pick<Product, 'category' | 'additional_categories' | 'subcategory'>
): string[] {
  const labels: string[] = [];
  const pushUnique = (val: string | null | undefined) => {
    const clean = (val || '').trim();
    if (clean && !labels.includes(clean)) {
      labels.push(clean);
    }
  };
  pushUnique(product.category);
  if (Array.isArray(product.additional_categories)) {
    for (const extra of product.additional_categories) {
      pushUnique(extra);
    }
  }
  pushUnique(product.subcategory);
  return labels;
}

export function isValidCpfClient(raw: string): boolean {
  const cpf = raw.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  if (rem !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  return rem === Number(cpf[10]);
}

export function getProductDiscountBadge(
  product: Pick<
    Product,
    'sale_type' | 'price_unit' | 'promo_price_unit' | 'price_kg' | 'promo_price_kg'
  >
): { hasDiscount: boolean; percent: number | null; label: string | null } {
  const unitOriginal =
    product.price_unit !== null ? Number(product.price_unit) : null;
  const unitPromo =
    product.promo_price_unit !== null ? Number(product.promo_price_unit) : null;
  const hasPromoUnit =
    (product.sale_type === 'unit' || product.sale_type === 'both') &&
    unitOriginal !== null &&
    unitPromo !== null &&
    unitOriginal > 0 &&
    unitPromo > 0 &&
    unitPromo < unitOriginal;

  const kgOriginal =
    product.price_kg !== null ? Number(product.price_kg) : null;
  const kgPromo =
    product.promo_price_kg !== null ? Number(product.promo_price_kg) : null;
  const hasPromoKg =
    (product.sale_type === 'kg' || product.sale_type === 'both') &&
    kgOriginal !== null &&
    kgPromo !== null &&
    kgOriginal > 0 &&
    kgPromo > 0 &&
    kgPromo < kgOriginal;

  if (!hasPromoUnit && !hasPromoKg) {
    return { hasDiscount: false, percent: null, label: null };
  }

  const orig = hasPromoUnit ? unitOriginal! : kgOriginal!;
  const promo = hasPromoUnit ? unitPromo! : kgPromo!;
  const rawPct = Math.round(((orig - promo) / orig) * 100);
  if (rawPct >= 1) {
    return { hasDiscount: true, percent: rawPct, label: `-${rawPct}%` };
  }
  return { hasDiscount: true, percent: 0, label: 'Oferta' };
}

export function getProductReviewDisplay(
  product: Pick<Product, 'avg_rating' | 'review_count'>
): { show: boolean; avgRating: number | null; reviewCount: number } {
  const count = Number(product.review_count ?? 0);
  const rating =
    product.avg_rating !== null && product.avg_rating !== undefined
      ? Number(product.avg_rating)
      : null;

  if (rating === null || !Number.isFinite(rating) || rating <= 0 || count <= 0) {
    return { show: false, avgRating: null, reviewCount: 0 };
  }

  return {
    show: true,
    avgRating: rating,
    reviewCount: count,
  };
}

