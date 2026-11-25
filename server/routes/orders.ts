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
        'id, order_number, status, subtotal, shipping_fee, total, shipping_cep, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, notes, created_at, updated_at, order_items(id, product_id, product_name, product_image_url, unit_mode, quantity, unit_price, line_total), payments(id, method, status, amount, provider, provider_reference, details)'
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
        'id, order_number, status, subtotal, shipping_fee, total, shipping_cep, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, notes, created_at, updated_at, order_items(id, product_id, product_name, product_image_url, unit_mode, quantity, unit_price, line_total), payments(id, method, status, amount, provider, provider_reference, details)'
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
    const {
      idempotencyKey,
      paymentMethod,
      paymentChannel: rawChannel,
      changeFor,
      shipping,
      notes,
      saveAddress,
    } = parsed.data;
    const config = getStoreConfig();

    const paymentChannel: 'online' | 'on_delivery' =
      paymentMethod === 'cash_on_delivery'
        ? 'on_delivery'
        : rawChannel || (paymentMethod === 'pix' ? 'online' : 'on_delivery');

    const isOnlineCard =
      paymentChannel === 'online' &&
      (paymentMethod === 'credit_card' ||
        paymentMethod === 'debit_card' ||
        paymentMethod === 'card');

    if (isOnlineCard && !config.onlineCardConfigured) {
      res.status(400).json({
        error:
          'Pagamento com cartão online indisponível: o gateway Mercado Pago ainda não está configurado no servidor. Escolha "Pagar na entrega" ou Pix.',
      });
      return;
    }

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

    let paymentLabel = 'Pix';
    if (paymentMethod === 'cash_on_delivery') {
      paymentLabel = 'Pagar na entrega — Dinheiro';
    } else if (paymentMethod === 'credit_card') {
      paymentLabel =
        paymentChannel === 'online'
          ? 'Cartão de crédito (Online)'
          : 'Pagar na entrega — Cartão de crédito';
    } else if (paymentMethod === 'debit_card') {
      paymentLabel =
        paymentChannel === 'online'
          ? 'Cartão de débito (Online)'
          : 'Pagar na entrega — Cartão de débito';
    } else if (paymentMethod === 'card') {
      paymentLabel =
        paymentChannel === 'online'
          ? 'Cartão (Online)'
          : 'Pagar na entrega — Cartão';
    }

    const cleanChangeFor =
      paymentMethod === 'cash_on_delivery' && changeFor?.trim()
        ? changeFor.trim()
        : null;

    const paymentNote =
      paymentChannel === 'on_delivery'
        ? cleanChangeFor
          ? `Pagamento na entrega (${paymentLabel}). Troco para: ${cleanChangeFor}.`
          : `Pagamento na entrega (${paymentLabel}).`
        : isOnlineCard
          ? 'Aguardando conclusão segura do cartão no Mercado Pago e confirmação por webhook.'
          : config.paymentConfigured
            ? 'Aguardando confirmação do pagamento Pix.'
            : 'Provedor online ainda não configurado; combine a confirmação do Pix pelo WhatsApp da loja.';

    const paymentDetails = {
      selectedMethod: paymentMethod,
      channel: paymentChannel,
      label: paymentLabel,
      changeFor: cleanChangeFor,
      note: paymentNote,
    };

    const orderStatus =
      paymentChannel === 'on_delivery' ? 'awaiting_confirmation' : 'pending_payment';
    const paymentStatus =
      paymentChannel === 'on_delivery'
        ? 'pending'
        : isOnlineCard
          ? 'pending'
          : config.paymentConfigured
            ? 'pending'
            : 'pending_configuration';
    const provider =
      paymentChannel === 'on_delivery'
        ? 'pay_on_delivery'
        : isOnlineCard || config.paymentConfigured
          ? 'mercadopago'
          : 'unconfigured';

    const supabase = getSupabaseAdmin();

    let { data: rpcResult, error: rpcError } = await supabase.rpc(
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
        p_payment_details: paymentDetails,
        p_order_status: orderStatus,
        p_payment_status: paymentStatus,
        p_provider: provider,
      }
    );

    // Compatibilidade caso o banco ainda esteja antes do script 006_payment_methods_and_webhook.sql
    let usedLegacyFallback = false;
    if (
      rpcError &&
      (rpcError.message?.includes('create_order_atomic') ||
        rpcError.message?.includes('invalid input value for enum'))
    ) {
      usedLegacyFallback = true;
      const legacyMethod = paymentMethod === 'pix' ? 'pix' : 'card';
      const fallback = await supabase.rpc('create_order_atomic', {
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_payment_method: legacyMethod,
        p_shipping_cep: shipping.cep,
        p_shipping_street: shipping.street,
        p_shipping_number: shipping.number,
        p_shipping_complement: shipping.complement || null,
        p_shipping_neighborhood: shipping.neighborhood,
        p_shipping_city: shipping.city,
        p_shipping_state: shipping.state,
        p_notes: notes || null,
        p_payment_configured:
          paymentChannel === 'on_delivery' || config.paymentConfigured,
      });
      rpcResult = fallback.data;
      rpcError = fallback.error;
    }

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

    if (usedLegacyFallback && created && !created.already_existed) {
      await supabase
        .from('payments')
        .update({
          status: paymentStatus,
          provider,
          details: paymentDetails,
        })
        .eq('order_id', created.order_id);

      if (orderStatus === 'awaiting_confirmation') {
        await supabase
          .from('orders')
          .update({ status: 'awaiting_confirmation' })
          .eq('id', created.order_id);
      }
    }

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
      paymentSummary: paymentLabel,
      paymentChannel,
      paymentNotice: paymentNote,
    });
  } catch {
    res.status(500).json({ error: 'Erro interno ao finalizar pedido.' });
  }
});

export default router;
