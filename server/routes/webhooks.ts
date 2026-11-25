import crypto from 'node:crypto';
import { Router } from 'express';
import { getMercadoPagoConfig, getSupabaseAdmin } from '../supabase.ts';

const router = Router();

function verifyMercadoPagoSignature(
  signatureHeader: string | undefined,
  requestIdHeader: string | undefined,
  dataId: string,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !requestIdHeader || !dataId || !webhookSecret) {
    return false;
  }

  let ts = '';
  let v1 = '';
  for (const part of signatureHeader.split(',')) {
    const [k, ...rest] = part.split('=');
    const key = (k || '').trim();
    const val = rest.join('=').trim();
    if (key === 'ts') ts = val;
    if (key === 'v1') v1 = val;
  }

  if (!ts || !v1) {
    return false;
  }

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestIdHeader};ts:${ts};`;
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(manifest)
    .digest('hex');

  const bufA = Buffer.from(expected, 'utf8');
  const bufB = Buffer.from(v1.toLowerCase(), 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

router.post('/mercadopago', async (req, res) => {
  try {
    const mp = getMercadoPagoConfig();
    if (!mp.accessToken || !mp.webhookSecret) {
      res.status(503).json({ error: 'Webhook do Mercado Pago não configurado.' });
      return;
    }

    const queryDataId =
      typeof req.query['data.id'] === 'string' ? req.query['data.id'] : '';
    const bodyDataId = req.body?.data?.id ? String(req.body.data.id) : '';
    const dataId = (queryDataId || bodyDataId).trim();

    const topic = String(
      req.query.type || req.query.topic || req.body?.type || ''
    ).toLowerCase();

    if (!dataId) {
      res.status(400).json({ error: 'Identificador do pagamento ausente.' });
      return;
    }

    if (topic && topic !== 'payment') {
      res.status(200).json({ ignored: true });
      return;
    }

    const signatureHeader =
      typeof req.headers['x-signature'] === 'string'
        ? req.headers['x-signature']
        : undefined;
    const requestIdHeader =
      typeof req.headers['x-request-id'] === 'string'
        ? req.headers['x-request-id']
        : undefined;

    const isValidSignature = verifyMercadoPagoSignature(
      signatureHeader,
      requestIdHeader,
      dataId,
      mp.webhookSecret
    );

    if (!isValidSignature) {
      res.status(401).json({ error: 'Assinatura de webhook inválida.' });
      return;
    }

    // Consulta oficial na API do Mercado Pago antes de alterar qualquer status no banco
    const mpResp = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`,
      {
        headers: {
          Authorization: `Bearer ${mp.accessToken}`,
        },
      }
    );

    if (!mpResp.ok) {
      res.status(502).json({ error: 'Não foi possível consultar pagamento no provedor.' });
      return;
    }

    const mpPayment = (await mpResp.json()) as {
      id?: number | string;
      status?: string;
      status_detail?: string;
      transaction_amount?: number;
      external_reference?: string;
      payment_method_id?: string;
      payment_type_id?: string;
      installments?: number;
      card?: { last_four_digits?: string };
    };

    const supabase = getSupabaseAdmin();

    let orderId = mpPayment.external_reference || '';
    if (!orderId) {
      const { data: paymentLookup } = await supabase
        .from('payments')
        .select('order_id')
        .eq('provider_reference', String(dataId))
        .maybeSingle();
      if (paymentLookup?.order_id) {
        orderId = paymentLookup.order_id;
      }
    }

    if (!orderId) {
      res.status(404).json({ error: 'Pedido vinculado ao pagamento não encontrado.' });
      return;
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id, status, total, payments(id, status, details)')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    if (
      typeof mpPayment.transaction_amount === 'number' &&
      Math.abs(Number(mpPayment.transaction_amount) - Number(order.total)) > 0.01
    ) {
      res.status(400).json({ error: 'Valor do pagamento diverge do total do pedido.' });
      return;
    }

    const paymentRow = Array.isArray(order.payments)
      ? order.payments[0]
      : order.payments;

    if (!paymentRow) {
      res.status(404).json({ error: 'Registro de pagamento não encontrado.' });
      return;
    }

    const existingDetails =
      (paymentRow.details as Record<string, unknown> | null) || {};
    const mpStatus = String(mpPayment.status || 'pending');

    const updatedDetails = {
      ...existingDetails,
      installments: Number(
        mpPayment.installments || existingDetails.installments || 1
      ),
      cardBrand: mpPayment.payment_method_id || existingDetails.cardBrand || null,
      cardLastFour:
        mpPayment.card?.last_four_digits || existingDetails.cardLastFour || null,
      mpStatus,
      mpStatusDetail: mpPayment.status_detail || null,
      awaitingWebhook: false,
      webhookVerified: true,
      webhookVerifiedAt: new Date().toISOString(),
    };

    if (mpStatus === 'approved') {
      await supabase
        .from('payments')
        .update({
          status: 'paid',
          provider: 'mercadopago',
          provider_reference: String(mpPayment.id || dataId),
          details: {
            ...updatedDetails,
            note: 'Pagamento confirmado via webhook verificado do Mercado Pago.',
          },
        })
        .eq('id', paymentRow.id);

      if (
        order.status === 'pending_payment' ||
        order.status === 'awaiting_confirmation'
      ) {
        await supabase.rpc('update_order_status_atomic', {
          p_order_id: order.id,
          p_new_status: 'paid',
        });
      }
    } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          provider: 'mercadopago',
          provider_reference: String(mpPayment.id || dataId),
          details: {
            ...updatedDetails,
            note: 'Pagamento recusado ou cancelado segundo confirmação do Mercado Pago.',
          },
        })
        .eq('id', paymentRow.id);
    } else if (mpStatus === 'refunded' || mpStatus === 'charged_back') {
      await supabase
        .from('payments')
        .update({
          status: 'refunded',
          provider: 'mercadopago',
          provider_reference: String(mpPayment.id || dataId),
          details: {
            ...updatedDetails,
            note: 'Pagamento estornado no Mercado Pago.',
          },
        })
        .eq('id', paymentRow.id);
    } else {
      await supabase
        .from('payments')
        .update({
          status: 'pending',
          provider: 'mercadopago',
          provider_reference: String(mpPayment.id || dataId),
          details: updatedDetails,
        })
        .eq('id', paymentRow.id);
    }

    res.status(200).json({ received: true, mpStatus });
  } catch {
    res.status(500).json({ error: 'Erro interno ao processar webhook.' });
  }
});

export default router;
