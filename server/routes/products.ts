import { Router } from 'express';
import { getSupabaseAdmin, isSupabaseConfigured } from '../supabase.ts';
import { resolveOptionalAuth } from '../middleware/auth.ts';

const router = Router();
const PAGE_SIZE = 20;

router.get('/', async (req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      res.json({
        products: [],
        categories: [],
        page: 1,
        pageSize: PAGE_SIZE,
        totalCount: 0,
        totalPages: 1,
        supabaseConfigured: false,
      });
      return;
    }

    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const promoOnly = req.query.promoOnly === 'true';
    const sort = req.query.sort === 'price_desc' ? 'price_desc' : 'price_asc';
    const pageRaw = Number.parseInt(String(req.query.page || '1'), 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('products')
      .select(
        'id, name, description, category, image_url, sale_type, price_unit, promo_price_unit, price_kg, promo_price_kg, sort_price, manage_stock, stock_quantity, is_active, created_at',
        { count: 'exact' }
      )
      .eq('is_active', true);

    if (search.length > 0) {
      // Escapa caracteres especiais do operador ilike/or do PostgREST
      const safeTerm = search.replace(/[,%()]/g, ' ').trim();
      if (safeTerm.length > 0) {
        query = query.or(
          `name.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%`
        );
      }
    }

    if (category.length > 0) {
      query = query.eq('category', category);
    }

    if (promoOnly) {
      query = query.or(
        'promo_price_unit.not.is.null,promo_price_kg.not.is.null'
      );
    }

    query = query
      .order('sort_price', { ascending: sort === 'price_asc' })
      .order('name', { ascending: true })
      .range(from, to);

    const { data: products, error, count } = await query;

    if (error) {
      res.status(500).json({ error: 'Não foi possível consultar o catálogo.' });
      return;
    }

    // Categorias ativas distintas para filtro
    const { data: categoryRows } = await supabase
      .from('products')
      .select('category')
      .eq('is_active', true)
      .not('category', 'is', null);

    const categories = Array.from(
      new Set(
        (categoryRows || [])
          .map((row) => (row.category || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    // Estatísticas de avaliação dos produtos retornados
    const productIds = (products || []).map((p) => p.id);
    const ratingMap = new Map<string, { sum: number; count: number }>();

    if (productIds.length > 0) {
      const { data: reviewRows } = await supabase
        .from('reviews')
        .select('product_id, rating')
        .in('product_id', productIds);

      for (const r of reviewRows || []) {
        const current = ratingMap.get(r.product_id) || { sum: 0, count: 0 };
        current.sum += r.rating;
        current.count += 1;
        ratingMap.set(r.product_id, current);
      }
    }

    const enriched = (products || []).map((p) => {
      const stats = ratingMap.get(p.id);
      const hasPromoUnit =
        p.promo_price_unit !== null &&
        p.price_unit !== null &&
        Number(p.promo_price_unit) < Number(p.price_unit);
      const hasPromoKg =
        p.promo_price_kg !== null &&
        p.price_kg !== null &&
        Number(p.promo_price_kg) < Number(p.price_kg);

      return {
        ...p,
        is_promo: hasPromoUnit || hasPromoKg,
        avg_rating: stats ? Number((stats.sum / stats.count).toFixed(1)) : null,
        review_count: stats ? stats.count : 0,
      };
    });

    const totalCount = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    res.json({
      products: enriched,
      categories,
      page,
      pageSize: PAGE_SIZE,
      totalCount,
      totalPages,
      supabaseConfigured: true,
    });
  } catch {
    res.status(500).json({ error: 'Erro interno ao buscar produtos.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      res.status(503).json({ error: 'Banco de dados não configurado.' });
      return;
    }

    const productId = req.params.id;
    const supabase = getSupabaseAdmin();

    const { data: product, error } = await supabase
      .from('products')
      .select(
        'id, name, description, category, image_url, sale_type, price_unit, promo_price_unit, price_kg, promo_price_kg, sort_price, manage_stock, stock_quantity, is_active, created_at'
      )
      .eq('id', productId)
      .eq('is_active', true)
      .single();

    if (error || !product) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }

    const { data: reviews } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, profiles(full_name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    const formattedReviews = (reviews || []).map((r) => {
      const profileObj = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      const fullName = profileObj?.full_name || 'Cliente';
      const firstName = fullName.split(' ')[0];
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
        authorName: firstName,
      };
    });

    let eligibleOrderIds: string[] = [];
    const authUser = await resolveOptionalAuth(req);
    if (authUser) {
      const { data: deliveredOrders } = await supabase
        .from('orders')
        .select('id, order_items!inner(product_id)')
        .eq('user_id', authUser.id)
        .eq('status', 'delivered')
        .eq('order_items.product_id', productId);

      const { data: existingReviews } = await supabase
        .from('reviews')
        .select('order_id')
        .eq('user_id', authUser.id)
        .eq('product_id', productId);

      const reviewedOrderSet = new Set(
        (existingReviews || []).map((er) => er.order_id)
      );
      eligibleOrderIds = (deliveredOrders || [])
        .map((o) => o.id)
        .filter((oid) => !reviewedOrderSet.has(oid));
    }

    const hasPromoUnit =
      product.promo_price_unit !== null &&
      product.price_unit !== null &&
      Number(product.promo_price_unit) < Number(product.price_unit);
    const hasPromoKg =
      product.promo_price_kg !== null &&
      product.price_kg !== null &&
      Number(product.promo_price_kg) < Number(product.price_kg);

    const reviewCount = formattedReviews.length;
    const avgRating =
      reviewCount > 0
        ? Number(
            (
              formattedReviews.reduce((acc, item) => acc + item.rating, 0) /
              reviewCount
            ).toFixed(1)
          )
        : null;

    res.json({
      product: {
        ...product,
        is_promo: hasPromoUnit || hasPromoKg,
        avg_rating: avgRating,
        review_count: reviewCount,
      },
      reviews: formattedReviews,
      eligibleOrderIds,
    });
  } catch {
    res.status(500).json({ error: 'Erro interno ao consultar detalhes do produto.' });
  }
});

export default router;
