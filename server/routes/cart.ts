import { Router } from 'express';
import { getSupabaseAdmin } from '../supabase.ts';
import { requireAuth, requirePasswordChanged } from '../middleware/auth.ts';
import {
  cartItemAddSchema,
  cartItemUpdateSchema,
} from '../utils/validation.ts';

const router = Router();

router.use(requireAuth, requirePasswordChanged);

async function getOrCreateUserCartId(userId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('carts')
    .insert({ user_id: userId })
    .select('id')
    .single();

  if (error || !created) {
    // Em caso de inserção concorrente, busca novamente
    const { data: retry } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .single();
    if (!retry) throw new Error('CART_INIT_FAILED');
    return retry.id;
  }

  return created.id;
}

async function buildCartResponse(userId: string) {
  const supabase = getSupabaseAdmin();
  const cartId = await getOrCreateUserCartId(userId);

  let { data: items, error } = await supabase
    .from('cart_items')
    .select(
      'id, product_id, unit_mode, quantity, products(id, name, image_url, sale_type, price_unit, promo_price_unit, price_kg, promo_price_kg, price_meter, promo_price_meter, manage_stock, stock_quantity, is_active)'
    )
    .eq('cart_id', cartId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error && (error.message?.includes('price_meter') || error.code === '42703')) {
    const legacy = await supabase
      .from('cart_items')
      .select(
        'id, product_id, unit_mode, quantity, products(id, name, image_url, sale_type, price_unit, promo_price_unit, price_kg, promo_price_kg, manage_stock, stock_quantity, is_active)'
      )
      .eq('cart_id', cartId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    items = legacy.data as typeof items;
    error = legacy.error;
  }

  if (error) {
    throw new Error('CART_FETCH_FAILED');
  }

  let subtotal = 0;
  const formattedItems = (items || [])
    .map((item) => {
      const productRaw = Array.isArray(item.products)
        ? item.products[0]
        : item.products;
      const product = productRaw as
        | (typeof productRaw & {
            price_meter?: number | null;
            promo_price_meter?: number | null;
          })
        | null;
      if (!product || !product.is_active) return null;

      let unitPrice = 0;
      if (item.unit_mode === 'unit') {
        const promo =
          product.promo_price_unit !== null &&
          product.price_unit !== null &&
          Number(product.promo_price_unit) < Number(product.price_unit)
            ? Number(product.promo_price_unit)
            : null;
        unitPrice = promo ?? Number(product.price_unit || 0);
      } else if (item.unit_mode === 'kg') {
        const promo =
          product.promo_price_kg !== null &&
          product.price_kg !== null &&
          Number(product.promo_price_kg) < Number(product.price_kg)
            ? Number(product.promo_price_kg)
            : null;
        unitPrice = promo ?? Number(product.price_kg || 0);
      } else if (item.unit_mode === 'meter') {
        const promo =
          product.promo_price_meter !== null &&
          product.promo_price_meter !== undefined &&
          product.price_meter !== null &&
          product.price_meter !== undefined &&
          Number(product.promo_price_meter) < Number(product.price_meter)
            ? Number(product.promo_price_meter)
            : null;
        unitPrice = promo ?? Number(product.price_meter || 0);
      }

      if (unitPrice <= 0) return null;

      const qty = Number(item.quantity);
      const lineTotal = Number((unitPrice * qty).toFixed(2));
      subtotal = Number((subtotal + lineTotal).toFixed(2));

      return {
        id: item.id,
        productId: item.product_id,
        productName: product.name,
        imageUrl: product.image_url,
        unitMode: item.unit_mode as 'unit' | 'kg' | 'meter',
        quantity: qty,
        unitPrice,
        lineTotal,
        manageStock: Boolean(product.manage_stock),
        stockQuantity:
          product.stock_quantity !== null ? Number(product.stock_quantity) : null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return {
    items: formattedItems,
    subtotal,
    itemCount: formattedItems.length,
  };
}

router.get('/', async (req, res) => {
  try {
    const cart = await buildCartResponse(req.authUser!.id);
    res.json(cart);
  } catch {
    res.status(500).json({ error: 'Não foi possível carregar seu carrinho.' });
  }
});

router.post('/items', async (req, res) => {
  try {
    const parsed = cartItemAddSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Dados inválidos.',
      });
      return;
    }

    const userId = req.authUser!.id;
    const { productId, unitMode, quantity } = parsed.data;
    const supabase = getSupabaseAdmin();

    let { data: product, error: prodError } = await supabase
      .from('products')
      .select(
        'id, name, sale_type, price_unit, price_kg, price_meter, manage_stock, stock_quantity, is_active'
      )
      .eq('id', productId)
      .single();

    if (prodError && (prodError.message?.includes('price_meter') || prodError.code === '42703')) {
      const legacy = await supabase
        .from('products')
        .select(
          'id, name, sale_type, price_unit, price_kg, manage_stock, stock_quantity, is_active'
        )
        .eq('id', productId)
        .single();
      product = legacy.data as typeof product;
      prodError = legacy.error;
    }

    if (prodError || !product || !product.is_active) {
      res.status(404).json({ error: 'Produto indisponível ou não encontrado.' });
      return;
    }

    if (unitMode === 'unit') {
      if (product.sale_type !== 'unit' && product.sale_type !== 'both') {
        res.status(400).json({ error: 'Este produto não é vendido por unidade.' });
        return;
      }
      if (!Number.isInteger(quantity)) {
        res.status(400).json({
          error: 'Quantidade por unidade deve ser um número inteiro.',
        });
        return;
      }
    } else if (unitMode === 'kg') {
      if (product.sale_type !== 'kg' && product.sale_type !== 'both') {
        res.status(400).json({ error: 'Este produto não é vendido por quilo.' });
        return;
      }
    } else if (unitMode === 'meter') {
      if (product.sale_type !== 'meter') {
        res.status(400).json({ error: 'Este produto não é vendido por metro.' });
        return;
      }
    }

    const cartId = await getOrCreateUserCartId(userId);

    const { data: existingItem } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('user_id', userId)
      .eq('product_id', productId)
      .eq('unit_mode', unitMode)
      .maybeSingle();

    const nextQuantity = Number(
      ((existingItem ? Number(existingItem.quantity) : 0) + quantity).toFixed(3)
    );

    if (
      product.manage_stock &&
      (product.stock_quantity === null ||
        Number(product.stock_quantity) < nextQuantity)
    ) {
      res.status(409).json({
        error: `Estoque insuficiente para "${product.name}". Disponível: ${Math.max(
          0,
          Math.trunc(Number(product.stock_quantity ?? 0))
        ).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}.`,
      });
      return;
    }

    if (existingItem) {
      const { error: updateErr } = await supabase
        .from('cart_items')
        .update({ quantity: nextQuantity })
        .eq('id', existingItem.id)
        .eq('user_id', userId);

      if (updateErr) {
        res.status(500).json({ error: 'Erro ao atualizar item no carrinho.' });
        return;
      }
    } else {
      const { error: insertErr } = await supabase.from('cart_items').insert({
        cart_id: cartId,
        user_id: userId,
        product_id: productId,
        unit_mode: unitMode,
        quantity: nextQuantity,
      });

      if (insertErr) {
        res.status(500).json({ error: 'Erro ao adicionar item no carrinho.' });
        return;
      }
    }

    const cart = await buildCartResponse(userId);
    res.status(201).json(cart);
  } catch {
    res.status(500).json({ error: 'Erro interno ao atualizar carrinho.' });
  }
});

router.patch('/items/:itemId', async (req, res) => {
  try {
    const parsed = cartItemUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Quantidade inválida.',
      });
      return;
    }

    const userId = req.authUser!.id;
    const { itemId } = req.params;
    const { quantity } = parsed.data;
    const supabase = getSupabaseAdmin();

    const { data: item } = await supabase
      .from('cart_items')
      .select(
        'id, unit_mode, products(name, manage_stock, stock_quantity, is_active)'
      )
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (!item) {
      res.status(404).json({ error: 'Item do carrinho não encontrado.' });
      return;
    }

    if (item.unit_mode === 'unit' && !Number.isInteger(quantity)) {
      res.status(400).json({
        error: 'Quantidade por unidade deve ser um número inteiro.',
      });
      return;
    }

    const product = Array.isArray(item.products)
      ? item.products[0]
      : item.products;

    if (!product || !product.is_active) {
      res.status(409).json({ error: 'Produto indisponível no momento.' });
      return;
    }

    if (
      product.manage_stock &&
      (product.stock_quantity === null || Number(product.stock_quantity) < quantity)
    ) {
      res.status(409).json({
        error: `Estoque insuficiente. Disponível: ${Math.max(
          0,
          Math.trunc(Number(product.stock_quantity ?? 0))
        ).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}.`,
      });
      return;
    }

    const { error: updateErr } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', itemId)
      .eq('user_id', userId);

    if (updateErr) {
      res.status(500).json({ error: 'Não foi possível atualizar a quantidade.' });
      return;
    }

    const cart = await buildCartResponse(userId);
    res.json(cart);
  } catch {
    res.status(500).json({ error: 'Erro interno ao atualizar item.' });
  }
});

router.delete('/items/:itemId', async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const { itemId } = req.params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);

    if (error) {
      res.status(500).json({ error: 'Não foi possível remover o item.' });
      return;
    }

    const cart = await buildCartResponse(userId);
    res.json(cart);
  } catch {
    res.status(500).json({ error: 'Erro interno ao remover item.' });
  }
});

router.delete('/', async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const supabase = getSupabaseAdmin();

    await supabase.from('cart_items').delete().eq('user_id', userId);

    res.json({ items: [], subtotal: 0, itemCount: 0 });
  } catch {
    res.status(500).json({ error: 'Erro ao limpar o carrinho.' });
  }
});

export default router;
