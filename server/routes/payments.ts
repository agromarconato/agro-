import { Router } from 'express';
import { getMercadoPagoConfig, getSupabaseAdmin } from '../supabase.ts';
import { requireAuth, requirePasswordChanged } from '../middleware/auth.ts';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import {
  digitsOnly,
  processMercadoPagoCardSchema,
} from '../utils/validation.ts';

const router = Router();

router.use(requireAuth, requirePasswordChanged);

const cardPayLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 15,
  keyPrefix: 'mp-card-pay',
  keyExtra: (req) => req.authUser?.id || '',
});

const MP_REJECT_MESSAGES: Record<string, string> = {
  cc_rejected_bad_filled_card_number: 'Número do cartão inválido. Confira os dados.',
  cc_rejected_bad_filled_date: 'Data de validade inválida.',
  cc_rejected_bad_filled_other: 'Dados do cartão inválidos. Confira e tente novamente.',
  cc_rejected_bad_filled_security_code: 'Código de segurança (CVV) inválido.',
  cc_rejected_blacklist: 'Cartão não autorizado pelo emissor.',
  cc_rejected_call_for_authorize: 'É necessário autorizar a compra junto ao banco emissor.',
  cc_rejected_card_disabled: 'Cartão bloqueado ou ainda não ativado.',
  cc_rejected_card_error: 'Não foi possível processar o cartão. Tente outro cartão.',
  cc_rejected_duplicated_payment: 'Pagamento duplicado detectado pelo emissor.',
  cc_rejected_high_risk: 'Pagamento recusado pela análise antifraude do provedor.',
  cc_rejected_insufficient_amount: 'Saldo ou limite insuficiente no cartão.',
  cc_rejected_invalid_installments: 'Parcelamento não permitido para este cartão.',
  cc_rejected_max_attempts: 'Limite de tentativas excedido para este cartão.',
};

router.post('/mercadopago/process', cardPayLimiter, async (req, res) => {
  try {
    const mp = getMercadoPagoConfig();
    if (!mp.onlineCardConfigured) {
      res.status(503).json({
        error:
          'Gateway de pagamento online ainda não configurado no servidor (VITE_MP_PUBLIC_KEY, MP_ACCESS_TOKEN e MP_WEBHOOK_SECRET).',
      });
      return;
    }

    const parsed = processMercadoPagoCardSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error:
          parsed.error.issues[0]?.message ||
          'Dados tokenizados de pagamento inválidos.',
      });
      return;
    }

    const {
      orderId,
      cardType,
      token,
      paymentMethodId,
      issuerId,
      installments,
      payerEmail,
      identificationType,
      identificationNumber,
    } = parsed.data;

    const userId = req.authUser!.id;
    const supabase = getSupabaseAdmin();

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(
        'id, order_number, user_id, status, total, payments(id, method, status, details)'
      )
      .eq('id', orderId)
      .eq('user_id', userId)
      .single();

    if (orderErr || !order) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    if (order.status === 'paid' || order.status === 'cancelled') {
      res.status(409).json({
        error:
          order.status === 'paid'
            ? 'Este pedido já foi pago.'
            : 'Este pedido está cancelado.',
      });
      return;
    }

    const paymentRow = Array.isArray(order.payments)
      ? order.payments[0]
      : order.payments;

    if (!paymentRow) {
      res.status(400).json({ error: 'Registro de pagamento do pedido não encontrado.' });
      return;
    }

    const existingDetails =
      (paymentRow.details as Record<string, unknown> | null) || {};
    if (existingDetails.channel === 'on_delivery') {
      res.status(400).json({
        error: 'Este pedido foi registrado para pagamento na entrega.',
      });
      return;
    }

    const normalizedInstallments = cardType === 'debit_card' ? 1 : installments;

    const forwardedProto = String(req.headers['x-forwarded-proto'] || 'https')
      .split(',')[0]
      .trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
    const notificationUrl =
      host && !host.includes('localhost') && !host.includes('127.0.0.1')
        ? `${forwardedProto}://${host}/api/webhooks/mercadopago`
        : undefined;

    const idDigits = digitsOnly(identificationNumber || req.authUser!.cpf || '');
    const mpPayload: Record<string, unknown> = {
      transaction_amount: Number(Number(order.total).toFixed(2)),
      token,
      description: `Pedido #${order.order_number} - Agro Marconato`,
      installments: normalizedInstallments,
      payment_method_id: paymentMethodId,
      external_reference: order.id,
      payer: {
        email: payerEmail,
        ...(idDigits
          ? {
              identification: {
                type: identificationType || 'CPF',
                number: idDigits,
              },
            }
          : {}),
      },
    };

    if (issuerId !== undefined && issuerId !== null && String(issuerId).trim() !== '') {
      mpPayload.issuer_id = String(issuerId);
    }

    if (notificationUrl) {
      mpPayload.notification_url = notificationUrl;
    }

    const mpResp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mp.accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `agro-${order.id}-${token.slice(0, 16)}`,
      },
      body: JSON.stringify(mpPayload),
    });

    const mpData = (await mpResp.json().catch(() => ({}))) as {
      id?: number | string;
      status?: string;
      status_detail?: string;
      payment_type_id?: string;
      payment_method_id?: string;
      installments?: number;
      card?: { last_four_digits?: string };
      message?: string;
    };

    if (!mpResp.ok || !mpData.id) {
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          provider: 'mercadopago',
          details: {
            ...existingDetails,
            selectedMethod: cardType,
            channel: 'online',
            installments: normalizedInstallments,
            mpError: mpData.message || 'Erro de comunicação com o gateway.',
            note: 'Pagamento não autorizado pelo gateway. Pedido mantido como não pago.',
          },
        })
        .eq('id', paymentRow.id);

      res.status(402).json({
        error:
          'O pagamento não foi autorizado pelo provedor. O pedido permanece como não pago.',
      });
      return;
    }

    const mpStatus = String(mpData.status || 'pending');
    const mpStatusDetail = String(mpData.status_detail || '');
    const isRejected = mpStatus === 'rejected' || mpStatus === 'cancelled';

    if (isRejected) {
      const reason =
        MP_REJECT_MESSAGES[mpStatusDetail] ||
        'Pagamento recusado pela operadora do cartão.';

      await supabase
        .from('payments')
        .update({
          status: 'failed',
          provider: 'mercadopago',
          provider_reference: String(mpData.id),
          details: {
            ...existingDetails,
            selectedMethod: cardType,
            channel: 'online',
            installments: Number(mpData.installments || normalizedInstallments),
            cardBrand: mpData.payment_method_id || paymentMethodId,
            cardLastFour: mpData.card?.last_four_digits || null,
            mpStatus,
            mpStatusDetail,
            note: reason,
          },
        })
        .eq('id', paymentRow.id);

      res.status(402).json({
        error: `${reason} Seu pedido #${order.order_number} continua como não pago.`,
        mpStatus,
        mpStatusDetail,
      });
      return;
    }

    // Segurança: NUNCA marca o pedido como 'paid' aqui; somente o webhook verificado confirma o pagamento.
    const nextPaymentStatus = mpStatus === 'approved' ? 'authorized' : 'pending';
    const nextNote =
      mpStatus === 'approved'
        ? 'Transação autorizada no gateway; aguardando confirmação oficial por webhook.'
        : 'Pagamento em processamento no gateway; aguardando confirmação oficial por webhook.';

    await supabase
      .from('payments')
      .update({
        status: nextPaymentStatus,
        provider: 'mercadopago',
        provider_reference: String(mpData.id),
        details: {
          ...existingDetails,
          selectedMethod: cardType,
          channel: 'online',
          installments: Number(mpData.installments || normalizedInstallments),
          cardBrand: mpData.payment_method_id || paymentMethodId,
          cardLastFour: mpData.card?.last_four_digits || null,
          mpStatus,
          mpStatusDetail,
          awaitingWebhook: true,
          note: nextNote,
        },
      })
      .eq('id', paymentRow.id);

    res.json({
      ok: true,
      awaitingWebhook: true,
      orderId: order.id,
      orderNumber: order.order_number,
      paymentId: String(mpData.id),
      mpStatus,
      message: nextNote,
    });
  } catch {
    res.status(500).json({
      error: 'Erro interno ao processar pagamento com o provedor.',
    });
  }
});

export default router;
