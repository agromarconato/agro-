import { Router } from 'express';
import { getStoreConfig, getSupabaseAdmin } from '../supabase.ts';
import { requireAuth, requirePasswordChanged } from '../middleware/auth.ts';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import {
  buildWhatsappUrl,
  createOrderSchema,
  isIratiParana,
} from '../utils/validation.ts';

const router = Router();

router.use(requireAuth, requirePasswordChanged);

const orderCreateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'order-create',
  keyExtra: (req) => req.authUser?.id || '',
});

router.get('/', async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const supabase = getSupabaseAdmin();

    const { data: orders, error } = await supabase
      .from('orders')
      .select(
        'id, order_number, status, subtotal, shipping_fee, total, shipping_cep, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, notes, created_at, updated_at, order_items(id, product_id, product_name, product_image_url, unit_mode, quantity, unit_price, line_total), payments(id, method, status, amount, provider, details)'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: 'Não foi possível carregar seus pedidos.' });
      return;
    }

    const { data: userReviews } = await supabase
      .from('reviews')
      .select('order_id, product_id, rating, comment, created_at')
      .eq('user_id', userId);

    const reviewMap = new Map<
      string,
      { rating: number; comment: string; created_at: string }
    >();
    for (const r of userReviews || []) {
      reviewMap.set(`${r.order_id}:${r.product_id}`, {
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
      });
    }

    const enriched = (orders || []).map((order) => ({
      ...order,
      order_items: (order.order_items || []).map((item) => ({
        ...item,
        my_review: reviewMap.get(`${order.id}:${item.product_id}`) || null,
      })),
    }));

    res.json({ orders: enriched });
  } catch {
    res.status(500).json({ error: 'Erro interno ao consultar pedidos.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const orderId = req.params.id;
    const supabase = getSupabaseAdmin();

    const { data: order, error } = await supabase
      .from('orders')
      .select(
        'id, order_number, status, subtotal, shipping_fee, total, shipping_cep, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, notes, created_at, updated_at, order_items(id, product_id, product_name, product_image_url, unit_mode, quantity, unit_price, line_total), payments(id, method, status, amount, provider, details)'
      )
      .eq('id', orderId)
      .eq('user_id', userId)
      .single();

    if (error || !order) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    res.json({ order });
  } catch {
    res.status(500).json({ error: 'Erro interno ao consultar pedido.' });
  }
});

router.post('/', orderCreateLimiter, async (req, res) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Dados do pedido inválidos.',
      });
      return;
    }

    const userId = req.authUser!.id;
    const { idempotencyKey, paymentMethod, shipping, notes, saveAddress } =
      parsed.data;
    const config = getStoreConfig();

    if (!isIratiParana(shipping.city, shipping.state)) {
      const whatsappUrl = buildWhatsappUrl(
        config.whatsappNumber,
        `Olá! Gostaria de combinar o frete de um pedido para ${shipping.city}/${shipping.state} (CEP ${shipping.cep}).`
      );
      res.status(422).json({
        error:
          'Entregas fora de Irati-PR exigem combinação de frete pelo WhatsApp antes de finalizar o pedido.',
        code: 'OUTSIDE_IRATI',
        whatsappUrl,
      });
      return;
    }

    const supabase = getSupabaseAdmin();

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'create_order_atomic',
      {
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_payment_method: paymentMethod,
        p_shipping_cep: shipping.cep,
        p_shipping_street: shipping.street,
        p_shipping_number: shipping.number,
        p_shipping_complement: shipping.complement || null,
        p_shipping_neighborhood: shipping.neighborhood,
        p_shipping_city: shipping.city,
        p_shipping_state: shipping.state,
        p_notes: notes || null,
        p_payment_configured: config.paymentConfigured,
      }
    );

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('CART_EMPTY')) {
        res.status(400).json({ error: 'Seu carrinho está vazio.' });
        return;
      }
      if (msg.includes('OUTSIDE_IRATI')) {
        res.status(422).json({
          error:
            'Entregas fora de Irati-PR exigem combinação de frete pelo WhatsApp.',
          code: 'OUTSIDE_IRATI',
        });
        return;
      }
      if (msg.includes('INSUFFICIENT_STOCK:')) {
        const prodName = msg.split('INSUFFICIENT_STOCK:')[1] || 'produto';
        res.status(409).json({
          error: `Estoque insuficiente para "${prodName}". Ajuste a quantidade no carrinho.`,
        });
        return;
      }
      if (msg.includes('PRODUCT_UNAVAILABLE:')) {
        const prodName = msg.split('PRODUCT_UNAVAILABLE:')[1] || 'produto';
        res.status(409).json({
          error: `O produto "${prodName}" não está mais disponível.`,
        });
        return;
      }
      res.status(400).json({
        error: 'Não foi possível criar o pedido. Verifique os itens e o endereço.',
      });
      return;
    }

    const created = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;

    if (saveAddress && created && !created.already_existed) {
      await supabase.from('addresses').insert({
        user_id: userId,
        cep: shipping.cep,
        street: shipping.street,
        number: shipping.number,
        complement: shipping.complement || null,
        neighborhood: shipping.neighborhood,
        city: shipping.city,
        state: shipping.state,
        is_default: true,
      });
    }

    res.status(created?.already_existed ? 200 : 201).json({
      order: created,
      paymentConfigured: config.paymentConfigured,
      paymentNotice: config.paymentConfigured
        ? 'Pedido criado. Siga as instruções do provedor de pagamento.'
        : 'Provedor de pagamento online ainda não configurado. Seu pedido foi registrado e você pode combinar a confirmação pelo WhatsApp da loja.',
    });
  } catch {
    res.status(500).json({ error: 'Erro interno ao finalizar pedido.' });
  }
});

export default router;
