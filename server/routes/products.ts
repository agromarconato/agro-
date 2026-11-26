import { Router } from 'express';
import {
  MAIN_CATEGORIES,
  SPECIFIC_ANIMAL_TYPES,
  matchesCatalogCategoryFilter,
} from '../../shared/catalogTaxonomy.ts';
import { resolveOptionalAuth } from '../middleware/auth.ts';
import { getSupabaseAdmin, isSupabaseConfigured } from '../supabase.ts';

const router = Router();
export const CATALOG_PAGE_SIZE = 25;

function quotePostgrestValue(val: string): string {
  const escaped = val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function buildProductFilterOr(
  category: string,
  subcategory: string
): string | null {
  const cat = category.trim();
  const sub = subcategory.trim();

  if (!cat && !sub) return null;

  if (cat && !sub) {
    if (cat === 'Animais') {
      const clauses = [
        `category.eq.${quotePostgrestValue('Animais')}`,
        `additional_categories.cs.{${quotePostgrestValue('Animais')}}`,
        ...SPECIFIC_ANIMAL_TYPES.flatMap((animal) => [
          `category.eq.${quotePostgrestValue(animal)}`,
          `additional_categories.cs.{${quotePostgrestValue(animal)}}`,
          `subcategory.eq.${quotePostgrestValue(animal)}`,
        ]),
        `and(category.eq.${quotePostgrestValue('Animais')},subcategory.eq.${quotePostgrestValue('Outros')})`,
      ];
      return clauses.join(',');
    }

    return [
      `category.eq.${quotePostgrestValue(cat)}`,
      `additional_categories.cs.{${quotePostgrestValue(cat)}}`,
    ].join(',');
  }

  if (cat === 'Animais' && sub) {
    if (sub === 'Outros') {
      const notSpecific = SPECIFIC_ANIMAL_TYPES.map(
        (animal) => `subcategory.neq.${quotePostgrestValue(animal)}`
      ).join(',');
      const inAnimais = `or(category.eq.${quotePostgrestValue('Animais')},additional_categories.cs.{${quotePostgrestValue('Animais')}})`;
      const explicitOutros = `or(subcategory.eq.${quotePostgrestValue('Outros')},additional_categories.cs.{${quotePostgrestValue('Outros')}},subcategory.is.null,and(${notSpecific}))`;
      return `and(${inAnimais},${explicitOutros}),category.eq.${quotePostgrestValue('Outros')},additional_categories.cs.{${quotePostgrestValue('Animais - Outros')}}`;
    }

    return [
      `subcategory.eq.${quotePostgrestValue(sub)}`,
      `additional_categories.cs.{${quotePostgrestValue(sub)}}`,
      `category.eq.${quotePostgrestValue(sub)}`,
    ].join(',');
  }

  if (cat && sub) {
    const deptMatch = `or(category.eq.${quotePostgrestValue(cat)},additional_categories.cs.{${quotePostgrestValue(cat)}})`;
    const subMatch = `or(subcategory.eq.${quotePostgrestValue(sub)},additional_categories.cs.{${quotePostgrestValue(sub)}},category.eq.${quotePostgrestValue(sub)})`;
    return `and(${deptMatch},${subMatch})`;
  }

  return [
    `subcategory.eq.${quotePostgrestValue(sub)}`,
    `additional_categories.cs.{${quotePostgrestValue(sub)}}`,
    `category.eq.${quotePostgrestValue(sub)}`,
  ].join(',');
}

router.get('/', async (req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      res.json({
        products: [],
        categories: [...MAIN_CATEGORIES],
        page: 1,
        pageSize: CATALOG_PAGE_SIZE,
        totalCount: 0,
        totalPages: 1,
        supabaseConfigured: false,
      });
      return;
    }

    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const subcategory = String(req.query.subcategory || '').trim();
    const promoOnly = req.query.promoOnly === 'true';
    const inStockOnly = req.query.inStockOnly === 'true';
    const minPriceStr = String(req.query.minPrice || '').trim().replace(',', '.');
    const maxPriceStr = String(req.query.maxPrice || '').trim().replace(',', '.');
    const minPriceParsed = minPriceStr ? Number(minPriceStr) : NaN;
    const maxPriceParsed = maxPriceStr ? Number(maxPriceStr) : NaN;
    const minPrice =
      Number.isFinite(minPriceParsed) && minPriceParsed >= 0
        ? minPriceParsed
        : null;
    const maxPrice =
      Number.isFinite(maxPriceParsed) && maxPriceParsed >= 0
        ? maxPriceParsed
        : null;
    const sort = req.query.sort === 'price_desc' ? 'price_desc' : 'price_asc';
    const pageRaw = Number.parseInt(String(req.query.page || '1'), 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

    const from = (page - 1) * CATALOG_PAGE_SIZE;
    const to = from + CATALOG_PAGE_SIZE - 1;

    const supabase = getSupabaseAdmin();

    const buildQuery = (supportsExtendedTaxonomy: boolean) => {
      let query = supportsExtendedTaxonomy
        ? supabase
            .from('products')
            .select(
              'id, name, description, category, additional_categories, subcategory, image_url, sale_type, price_unit, promo_price_unit, price_kg, promo_price_kg, sort_price, manage_stock, stock_quantity, is_active, created_at',
              { count: 'exact' }
            )
            .eq('is_active', true)
        : supabase
            .from('products')
            .select(
              'id, name, description, category, image_url, sale_type, price_unit, promo_price_unit, price_kg, promo_price_kg, sort_price, manage_stock, stock_quantity, is_active, created_at',
              { count: 'exact' }
            )
            .eq('is_active', true);

      if (search.length > 0) {
        const safeTerm = search.replace(/[,%()]/g, ' ').trim();
        if (safeTerm.length > 0) {
          query = query.or(
            `name.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%`
          );
        }
      }

      if (supportsExtendedTaxonomy) {
        const taxonomyOr = buildProductFilterOr(category, subcategory);
        if (taxonomyOr) {
          query = query.or(taxonomyOr);
        }
      } else if (category.length > 0) {
        query = query.eq('category', category);
      }

      if (promoOnly) {
        query = query.or(
          'promo_price_unit.not.is.null,promo_price_kg.not.is.null'
        );
      }

      if (inStockOnly) {
        query = query.or('manage_stock.eq.false,stock_quantity.gt.0');
      }

      if (minPrice !== null) {
        query = query.gte('sort_price', minPrice);
      }

      if (maxPrice !== null) {
        query = query.lte('sort_price', maxPrice);
      }

      return query
        .order('sort_price', { ascending: sort === 'price_asc' })
        .order('name', { ascending: true })
        .range(from, to);
    };

    let usedFallback = false;
    let { data: products, error, count } = await buildQuery(true);

    if (
      error &&
      (error.message?.includes('additional_categories') ||
        error.message?.includes('subcategory') ||
        error.code === '42703')
    ) {
      usedFallback = true;
      const legacy = await buildQuery(false);
      products = legacy.data;
      error = legacy.error;
      count = legacy.count;
    }

    if (error) {
      res.status(500).json({ error: 'Não foi possível consultar o catálogo.' });
      return;
    }

    const rawProducts = (products || []) as Array<
      Record<string, unknown> & {
        id: string;
        category: string | null;
        additional_categories?: string[] | null;
        subcategory?: string | null;
        promo_price_unit: number | null;
        price_unit: number | null;
        promo_price_kg: number | null;
        price_kg: number | null;
      }
    >;

    const filteredProducts = usedFallback
      ? rawProducts.filter((p) =>
          matchesCatalogCategoryFilter(p, category, subcategory)
        )
      : rawProducts;

    // Lista categorias principais + eventuais categorias legadas ativas
    const { data: categoryRows } = await supabase
      .from('products')
      .select('category')
      .eq('is_active', true)
      .not('category', 'is', null);

    const categorySet = new Set<string>(MAIN_CATEGORIES);
    for (const row of categoryRows || []) {
      const c = (row.category || '').trim();
      if (c) categorySet.add(c);
    }
    const categories = Array.from(categorySet);

    const productIds = filteredProducts.map((p) => p.id);
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

    const enriched = filteredProducts.map((p) => {
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
        additional_categories: Array.isArray(p.additional_categories)
          ? p.additional_categories
          : [],
        subcategory: p.subcategory ?? null,
        is_promo: hasPromoUnit || hasPromoKg,
        avg_rating: stats ? Number((stats.sum / stats.count).toFixed(1)) : null,
        review_count: stats ? stats.count : 0,
      };
    });

    const totalCount = usedFallback ? filteredProducts.length : count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / CATALOG_PAGE_SIZE));

    res.json({
      products: enriched,
      categories,
      page,
      pageSize: CATALOG_PAGE_SIZE,
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

    let { data: product, error } = await supabase
      .from('products')
      .select(
        'id, name, description, category, additional_categories, subcategory, image_url, sale_type, price_unit, promo_price_unit, price_kg, promo_price_kg, sort_price, manage_stock, stock_quantity, is_active, created_at'
      )
      .eq('id', productId)
      .eq('is_active', true)
      .single();

    if (
      error &&
      (error.message?.includes('additional_categories') ||
        error.message?.includes('subcategory') ||
        error.code === '42703')
    ) {
      const legacy = await supabase
        .from('products')
        .select(
          'id, name, description, category, image_url, sale_type, price_unit, promo_price_unit, price_kg, promo_price_kg, sort_price, manage_stock, stock_quantity, is_active, created_at'
        )
        .eq('id', productId)
        .eq('is_active', true)
        .single();
      product = legacy.data as typeof product;
      error = legacy.error;
    }

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
        additional_categories: Array.isArray(product.additional_categories)
          ? product.additional_categories
          : [],
        subcategory: product.subcategory ?? null,
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
