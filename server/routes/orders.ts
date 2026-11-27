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

const PICKUP_NOTICE = 'Você tem até 7 dias para retirar seu pedido na loja.';

router.get('/', async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const supabase = getSupabaseAdmin();

    const runQuery = (withDeliveryMode: boolean) =>
      withDeliveryMode
        ? supabase
            .from('orders')
            .select(
              'id, order_number, status, delivery_mode, subtotal, shipping_fee, total, shipping_cep, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, notes, created_at, updated_at, order_items(id, product_id, product_name, product_image_url, unit_mode, quantity, unit_price, line_total), payments(id, method, status, amount, provider, provider_reference, details)'
            )
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
        : supabase
            .from('orders')
            .select(
              'id, order_number, status, subtotal, shipping_fee, total, shipping_cep, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, notes, created_at, updated_at, order_items(id, product_id, product_name, product_image_url, unit_mode, quantity, unit_price, line_total), payments(id, method, status, amount, provider, provider_reference, details)'
            )
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

    let { data: orders, error } = await runQuery(true);
    if (error && (error.message?.includes('delivery_mode') || error.code === '42703')) {
      const legacy = await runQuery(false);
      orders = legacy.data;
      error = legacy.error;
    }

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

    const enriched = ((orders || []) as Array<Record<string, unknown> & { id: string; order_items?: Array<{ product_id: string }> }>).map((order) => ({
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

    const runQuery = (withDeliveryMode: boolean) =>
      withDeliveryMode
        ? supabase
            .from('orders')
            .select(
              'id, order_number, status, delivery_mode, subtotal, shipping_fee, total, shipping_cep, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, notes, created_at, updated_at, order_items(id, product_id, product_name, product_image_url, unit_mode, quantity, unit_price, line_total), payments(id, method, status, amount, provider, provider_reference, details)'
            )
            .eq('id', orderId)
            .eq('user_id', userId)
            .single()
        : supabase
            .from('orders')
            .select(
              'id, order_number, status, subtotal, shipping_fee, total, shipping_cep, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, notes, created_at, updated_at, order_items(id, product_id, product_name, product_image_url, unit_mode, quantity, unit_price, line_total), payments(id, method, status, amount, provider, provider_reference, details)'
            )
            .eq('id', orderId)
            .eq('user_id', userId)
            .single();

    let { data: order, error } = await runQuery(true);
    if (error && (error.message?.includes('delivery_mode') || error.code === '42703')) {
      const legacy = await runQuery(false);
      order = legacy.data;
      error = legacy.error;
    }

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
      deliveryMode,
      paymentMethod,
      paymentChannel: rawChannel,
      changeFor,
      shipping,
      notes,
      saveAddress,
    } = parsed.data;
    const config = getStoreConfig();

    const isPickup = deliveryMode === 'pickup';

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
          'Pagamento com cartão online indisponível no momento. Escolha "Pagamento na entrega".',
      });
      return;
    }

    if (!isPickup) {
      if (!shipping || !isIratiParana(shipping.city, shipping.state)) {
        const whatsappUrl = buildWhatsappUrl(
          config.whatsappNumber,
          `Olá! Gostaria de combinar o frete de um pedido para ${shipping?.city || ''}/${shipping?.state || ''} (CEP ${shipping?.cep || ''}).`
        );
        res.status(422).json({
          error:
            'Entregas fora de Irati-PR exigem combinação de frete pelo WhatsApp antes de finalizar o pedido.',
          code: 'OUTSIDE_IRATI',
          whatsappUrl,
        });
        return;
      }
    }

    const effectiveShipping = isPickup
      ? {
          cep: '84500000',
          street: 'Retirada na loja — Agro Marconato',
          number: 'S/N',
          complement: 'Retirada em até 7 dias',
          neighborhood: 'Centro',
          city: 'Irati',
          state: 'PR',
        }
      : shipping!;

    let paymentLabel = 'Pix';
    if (paymentMethod === 'cash_on_delivery') {
      paymentLabel = 'Pagamento na entrega';
    } else if (paymentMethod === 'credit_card') {
      paymentLabel =
        paymentChannel === 'online'
          ? 'Cartão de crédito online'
          : 'Cartão de crédito na entrega';
    } else if (paymentMethod === 'debit_card') {
      paymentLabel =
        paymentChannel === 'online'
          ? 'Cartão de débito online'
          : 'Cartão de débito na entrega';
    } else if (paymentMethod === 'card') {
      paymentLabel =
        paymentChannel === 'online' ? 'Cartão online' : 'Cartão na entrega';
    }

    const cleanChangeFor =
      paymentMethod === 'cash_on_delivery' && changeFor?.trim()
        ? changeFor.trim()
        : null;

    const paymentNote = isPickup
      ? `${paymentLabel}. ${PICKUP_NOTICE}`
      : paymentChannel === 'on_delivery'
        ? cleanChangeFor
          ? `${paymentLabel}. Troco para: ${cleanChangeFor}.`
          : `${paymentLabel}.`
        : isOnlineCard
          ? 'Aguardando confirmação do cartão online.'
          : config.paymentConfigured
            ? 'Aguardando confirmação do pagamento.'
            : 'Aguardando confirmação da loja.';

    const paymentDetails = {
      selectedMethod: paymentMethod,
      channel: paymentChannel,
      label: paymentLabel,
      changeFor: cleanChangeFor,
      deliveryMode,
      ...(isPickup ? { pickupNotice: PICKUP_NOTICE } : {}),
      note: paymentNote,
    };

    const orderStatus =
      paymentChannel === 'on_delivery' ? 'awaiting_confirmation' : 'pending_payment';
    const paymentStatus =
      paymentChannel === 'on_delivery'
        ? 'pending'
        : isOnlineCard || config.paymentConfigured
          ? 'pending'
          : 'pending_configuration';
    const provider =
      paymentChannel === 'on_delivery'
        ? 'pay_on_delivery'
        : isOnlineCard || config.paymentConfigured
          ? 'mercadopago'
          : 'unconfigured';

    const supabase = getSupabaseAdmin();

    // Tenta RPC completa com p_delivery_mode (007)
    let { data: rpcResult, error: rpcError } = await supabase.rpc(
      'create_order_atomic',
      {
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_payment_method: paymentMethod,
        p_shipping_cep: effectiveShipping.cep,
        p_shipping_street: effectiveShipping.street,
        p_shipping_number: effectiveShipping.number,
        p_shipping_complement: effectiveShipping.complement || null,
        p_shipping_neighborhood: effectiveShipping.neighborhood,
        p_shipping_city: effectiveShipping.city,
        p_shipping_state: effectiveShipping.state,
        p_notes: notes || null,
        p_payment_configured: config.paymentConfigured,
        p_payment_details: paymentDetails,
        p_order_status: orderStatus,
        p_payment_status: paymentStatus,
        p_provider: provider,
        p_delivery_mode: deliveryMode,
      }
    );

    let usedFallback = false;

    // Fallback para RPC 006 (16 args) ou 003 (12 args) caso 007 ainda não tenha sido rodado no Supabase
    if (
      rpcError &&
      (rpcError.message?.includes('create_order_atomic') ||
        rpcError.message?.includes('invalid input value for enum'))
    ) {
      usedFallback = true;
      const attempt16 = await supabase.rpc('create_order_atomic', {
        p_user_id: userId,
        p_idempotency_key: idempotencyKey,
        p_payment_method: paymentMethod,
        p_shipping_cep: effectiveShipping.cep,
        p_shipping_street: effectiveShipping.street,
        p_shipping_number: effectiveShipping.number,
        p_shipping_complement: effectiveShipping.complement || null,
        p_shipping_neighborhood: effectiveShipping.neighborhood,
        p_shipping_city: effectiveShipping.city,
        p_shipping_state: effectiveShipping.state,
        p_notes: notes || null,
        p_payment_configured: config.paymentConfigured,
        p_payment_details: paymentDetails,
        p_order_status: orderStatus,
        p_payment_status: paymentStatus,
        p_provider: provider,
      });

      if (
        attempt16.error &&
        (attempt16.error.message?.includes('create_order_atomic') ||
          attempt16.error.message?.includes('invalid input value for enum'))
      ) {
        const legacyMethod = paymentMethod === 'pix' ? 'pix' : 'card';
        const attempt12 = await supabase.rpc('create_order_atomic', {
          p_user_id: userId,
          p_idempotency_key: idempotencyKey,
          p_payment_method: legacyMethod,
          p_shipping_cep: effectiveShipping.cep,
          p_shipping_street: effectiveShipping.street,
          p_shipping_number: effectiveShipping.number,
          p_shipping_complement: effectiveShipping.complement || null,
          p_shipping_neighborhood: effectiveShipping.neighborhood,
          p_shipping_city: effectiveShipping.city,
          p_shipping_state: effectiveShipping.state,
          p_notes: notes || null,
          p_payment_configured:
            paymentChannel === 'on_delivery' || config.paymentConfigured,
        });
        rpcResult = attempt12.data;
        rpcError = attempt12.error;
      } else {
        rpcResult = attempt16.data;
        rpcError = attempt16.error;
      }
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
      if (msg.includes('INVALID_SALE_MODE:')) {
        const prodName = msg.split('INVALID_SALE_MODE:')[1] || 'produto';
        res.status(409).json({
          error: `A unidade selecionada para "${prodName}" não está mais disponível.`,
        });
        return;
      }
      if (msg.includes('UNIT_QUANTITY_MUST_BE_INTEGER:')) {
        const prodName = msg.split('UNIT_QUANTITY_MUST_BE_INTEGER:')[1] || 'produto';
        res.status(400).json({
          error: `A quantidade de "${prodName}" por unidade deve ser um número inteiro.`,
        });
        return;
      }
      res.status(400).json({
        error: 'Não foi possível criar o pedido. Verifique os itens e o endereço.',
      });
      return;
    }

    let created = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;

    if (usedFallback && created && !created.already_existed) {
      const finalShippingFee = isPickup ? 0 : Number(created.shipping_fee);
      const finalTotal = isPickup
        ? Number(Number(created.subtotal).toFixed(2))
        : Number(created.total);

      await supabase
        .from('payments')
        .update({
          status: paymentStatus,
          provider,
          amount: finalTotal,
          details: paymentDetails,
        })
        .eq('order_id', created.order_id);

      const orderPatch: Record<string, unknown> = {};
      if (orderStatus === 'awaiting_confirmation') {
        orderPatch.status = 'awaiting_confirmation';
      }
      if (isPickup) {
        orderPatch.shipping_fee = 0;
        orderPatch.total = finalTotal;
      }

      if (Object.keys(orderPatch).length > 0) {
        await supabase
          .from('orders')
          .update(orderPatch)
          .eq('id', created.order_id);
      }

      created = {
        ...created,
        shipping_fee: finalShippingFee,
        total: finalTotal,
      };
    }

    if (!isPickup && saveAddress && created && !created.already_existed) {
      await supabase.from('addresses').insert({
        user_id: userId,
        cep: effectiveShipping.cep,
        street: effectiveShipping.street,
        number: effectiveShipping.number,
        complement: effectiveShipping.complement || null,
        neighborhood: effectiveShipping.neighborhood,
        city: effectiveShipping.city,
        state: effectiveShipping.state,
        is_default: true,
      });
    }

    res.status(created?.already_existed ? 200 : 201).json({
      order: {
        ...created,
        delivery_mode: deliveryMode,
      },
      deliveryMode,
      pickupNotice: isPickup ? PICKUP_NOTICE : null,
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
