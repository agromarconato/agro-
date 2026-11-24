import { Router } from 'express';
import { getSupabaseAdmin } from '../supabase.ts';
import { requireAuth, requirePasswordChanged } from '../middleware/auth.ts';
import { reviewSchema } from '../utils/validation.ts';

const router = Router();

router.post('/', requireAuth, requirePasswordChanged, async (req, res) => {
  try {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Dados da avaliação inválidos.',
      });
      return;
    }

    const userId = req.authUser!.id;
    const { productId, orderId, rating, comment } = parsed.data;
    const supabase = getSupabaseAdmin();

    // Verifica estritamente no servidor se o pedido pertence ao usuário, foi entregue e contém o produto
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, status, order_items!inner(product_id)')
      .eq('id', orderId)
      .eq('user_id', userId)
      .eq('order_items.product_id', productId)
      .maybeSingle();

    if (orderError || !order) {
      res.status(403).json({
        error: 'Você só pode avaliar produtos comprados em seus próprios pedidos.',
      });
      return;
    }

    if (order.status !== 'delivered') {
      res.status(403).json({
        error: 'A avaliação só é liberada após a entrega do pedido.',
      });
      return;
    }

    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('order_id', orderId)
      .eq('product_id', productId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      res.status(409).json({
        error: 'Você já avaliou este produto neste pedido.',
      });
      return;
    }

    const { data: review, error: insertError } = await supabase
      .from('reviews')
      .insert({
        product_id: productId,
        order_id: orderId,
        user_id: userId,
        rating,
        comment: comment.trim(),
      })
      .select('id, product_id, order_id, rating, comment, created_at')
      .single();

    if (insertError) {
      res.status(400).json({ error: 'Não foi possível salvar sua avaliação.' });
      return;
    }

    res.status(201).json({ review });
  } catch {
    res.status(500).json({ error: 'Erro interno ao registrar avaliação.' });
  }
});

export default router;
