import { z } from 'zod';

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCpf(rawCpf: string): boolean {
  const cpf = digitsOnly(rawCpf);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(cpf[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(cpf[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === Number(cpf[10]);
}

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function normalizeCityName(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function isIratiParana(city: string, state: string): boolean {
  return (
    normalizeCityName(city) === 'irati' &&
    state.trim().toUpperCase() === 'PR'
  );
}

export const IRATI_SHIPPING_FEE = 4.99;

export function buildWhatsappUrl(phoneRaw: string, message?: string): string {
  const digits = digitsOnly(phoneRaw);
  const base = `https://wa.me/${digits}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

export const registerSchema = z.object({
  fullName: z.string().trim().min(3, 'Informe seu nome completo.').max(120),
  email: z.string().trim().email('E-mail inválido.').max(180),
  cpf: z
    .string()
    .transform((v) => digitsOnly(v))
    .refine(isValidCpf, 'CPF inválido.'),
  phone: z
    .string()
    .transform((v) => digitsOnly(v))
    .refine((v) => v.length >= 10 && v.length <= 13, 'Telefone inválido.'),
  password: z
    .string()
    .refine(
      isStrongPassword,
      'A senha deve ter no mínimo 8 caracteres, com letra maiúscula, minúscula, número e símbolo.'
    ),
});

export const loginSchema = z.object({
  cpf: z
    .string()
    .transform((v) => digitsOnly(v))
    .refine(isValidCpf, 'CPF inválido. Informe os 11 dígitos do seu CPF.'),
  password: z.string().min(1, 'Informe a senha.'),
});

export const changePasswordSchema = z.object({
  newPassword: z
    .string()
    .refine(
      isStrongPassword,
      'A nova senha deve ter no mínimo 8 caracteres, com letra maiúscula, minúscula, número e símbolo.'
    ),
});

export const cartItemAddSchema = z.object({
  productId: z.string().uuid('Produto inválido.'),
  unitMode: z.enum(['unit', 'kg']),
  quantity: z.number().positive('Quantidade deve ser maior que zero.').max(10000),
});

export const cartItemUpdateSchema = z.object({
  quantity: z.number().positive('Quantidade deve ser maior que zero.').max(10000),
});

export const shippingAddressSchema = z.object({
  cep: z
    .string()
    .transform((v) => digitsOnly(v))
    .refine((v) => v.length === 8, 'CEP deve conter 8 dígitos.'),
  street: z.string().trim().min(2, 'Informe a rua.').max(180),
  number: z.string().trim().min(1, 'Informe o número.').max(30),
  complement: z.string().trim().max(100).optional().nullable(),
  neighborhood: z.string().trim().min(2, 'Informe o bairro.').max(120),
  city: z.string().trim().min(2, 'Informe a cidade.').max(120),
  state: z
    .string()
    .trim()
    .length(2, 'Informe a sigla do estado (ex: PR).')
    .transform((v) => v.toUpperCase()),
});

export const createOrderSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(100),
    paymentMethod: z.enum([
      'pix',
      'card',
      'credit_card',
      'debit_card',
      'cash_on_delivery',
    ]),
    paymentChannel: z.enum(['online', 'on_delivery']).optional(),
    changeFor: z.string().trim().max(40).optional().nullable(),
    shipping: shippingAddressSchema,
    notes: z.string().trim().max(400).optional().nullable(),
    saveAddress: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.paymentMethod === 'cash_on_delivery' &&
      data.paymentChannel === 'online'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pagamento em dinheiro é válido apenas na entrega.',
        path: ['paymentChannel'],
      });
    }
  });

export const processMercadoPagoCardSchema = z
  .object({
    orderId: z.string().uuid('Pedido inválido.'),
    cardType: z.enum(['credit_card', 'debit_card']),
    token: z.string().trim().min(10, 'Token de cartão inválido.').max(200),
    paymentMethodId: z
      .string()
      .trim()
      .min(2, 'Bandeira do cartão inválida.')
      .max(60),
    issuerId: z.union([z.string().trim().max(40), z.number()]).optional().nullable(),
    installments: z.number().int().min(1).max(24).default(1),
    payerEmail: z.string().trim().email('E-mail do pagador inválido.').max(180),
    identificationType: z.string().trim().max(20).optional().nullable(),
    identificationNumber: z.string().trim().max(30).optional().nullable(),
  })
  .strict();

export const reviewSchema = z.object({
  productId: z.string().uuid('Produto inválido.'),
  orderId: z.string().uuid('Pedido inválido.'),
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .min(2, 'Escreva um breve comentário.')
    .max(150, 'O comentário deve ter no máximo 150 caracteres.'),
});

export const productUpsertSchema = z
  .object({
    name: z.string().trim().min(2, 'Nome obrigatório.').max(160),
    description: z.string().trim().min(5, 'Descrição obrigatória.').max(4000),
    category: z.string().trim().max(80).optional().nullable(),
    imageUrl: z
      .string()
      .trim()
      .url('URL da imagem inválida.')
      .optional()
      .nullable()
      .or(z.literal('')),
    imagePath: z.string().trim().max(300).optional().nullable(),
    saleType: z.enum(['unit', 'kg', 'both']),
    priceUnit: z.number().positive().max(1000000).optional().nullable(),
    promoPriceUnit: z.number().positive().max(1000000).optional().nullable(),
    priceKg: z.number().positive().max(1000000).optional().nullable(),
    promoPriceKg: z.number().positive().max(1000000).optional().nullable(),
    manageStock: z.boolean().default(true),
    stockQuantity: z.number().min(0).max(1000000).optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if ((data.saleType === 'unit' || data.saleType === 'both') && !data.priceUnit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o preço por unidade.',
        path: ['priceUnit'],
      });
    }
    if ((data.saleType === 'kg' || data.saleType === 'both') && !data.priceKg) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o preço por quilo.',
        path: ['priceKg'],
      });
    }
    if (
      data.promoPriceUnit &&
      data.priceUnit &&
      data.promoPriceUnit >= data.priceUnit
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O preço promocional por unidade deve ser menor que o preço normal.',
        path: ['promoPriceUnit'],
      });
    }
    if (data.promoPriceKg && data.priceKg && data.promoPriceKg >= data.priceKg) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O preço promocional por quilo deve ser menor que o preço normal.',
        path: ['promoPriceKg'],
      });
    }
  });

export const orderStatusUpdateSchema = z.object({
  status: z.enum([
    'pending_payment',
    'awaiting_confirmation',
    'paid',
    'preparing',
    'out_for_delivery',
    'delivered',
    'cancelled',
  ]),
});

export const createAdminUserSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(180),
  cpf: z
    .string()
    .transform((v) => digitsOnly(v))
    .refine(isValidCpf, 'CPF inválido.'),
  phone: z
    .string()
    .transform((v) => digitsOnly(v))
    .refine((v) => v.length >= 10 && v.length <= 13, 'Telefone inválido.'),
  password: z
    .string()
    .refine(
      isStrongPassword,
      'A senha deve ter no mínimo 8 caracteres, com letra maiúscula, minúscula, número e símbolo.'
    ),
});
