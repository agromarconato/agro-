import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { getSupabaseAdmin } from '../supabase.ts';
import {
  requireAdmin,
  requireAuth,
  requirePasswordChanged,
  requireSuperAdmin,
} from '../middleware/auth.ts';
import {
  createAdminUserSchema,
  orderStatusUpdateSchema,
  productUpsertSchema,
} from '../utils/validation.ts';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024, // 4 MB
  },
});

export function detectImageExtension(buffer: Buffer): {
  ext: string;
  mime: string;
} | null {
  if (buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

// Todas as rotas abaixo exigem autenticação, senha inicial alterada e papel admin ou super_admin
router.use(requireAuth, requirePasswordChanged, requireAdmin);

router.get('/products', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const supabase = getSupabaseAdmin();

    const runList = (extended: boolean) => {
      let query = extended
        ? supabase
            .from('products')
            .select(
              'id, name, description, category, additional_categories, subcategory, image_url, image_path, sale_type, price_unit, promo_price_unit, price_kg, promo_price_kg, sort_price, manage_stock, stock_quantity, is_active, created_at, updated_at'
            )
            .order('created_at', { ascending: false })
        : supabase
            .from('products')
            .select(
              'id, name, description, category, image_url, image_path, sale_type, price_unit, promo_price_unit, price_kg, promo_price_kg, sort_price, manage_stock, stock_quantity, is_active, created_at, updated_at'
            )
            .order('created_at', { ascending: false });

      if (search.length > 0) {
        const safe = search.replace(/[,%()]/g, ' ').trim();
        if (safe.length > 0) {
          query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);
        }
      }
      return query;
    };

    let { data, error } = await runList(true);
    if (
      error &&
      (error.message?.includes('additional_categories') ||
        error.message?.includes('subcategory') ||
        error.code === '42703')
    ) {
      const legacy = await runList(false);
      data = legacy.data;
      error = legacy.error;
    }

    if (error) {
      res.status(500).json({ error: 'Erro ao listar produtos no painel.' });
      return;
    }

    res.json({ products: data || [] });
  } catch {
    res.status(500).json({ error: 'Erro interno ao listar produtos.' });
  }
});

router.post('/products/upload-image', (req, res) => {
  upload.single('image')(req, res, async (multerErr: unknown) => {
    try {
      if (multerErr) {
        const msg =
          multerErr instanceof Error ? multerErr.message : String(multerErr);
        if (msg.includes('File too large') || msg.includes('LIMIT_FILE_SIZE')) {
          res.status(413).json({
            error: 'Arquivo muito grande. Envie uma imagem de até 4 MB.',
          });
          return;
        }
        res.status(400).json({
          error: 'Não foi possível processar o arquivo enviado.',
        });
        return;
      }

      if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
        res.status(400).json({ error: 'Selecione um arquivo de imagem válido.' });
        return;
      }

      const detected = detectImageExtension(req.file.buffer);
      if (!detected) {
        res.status(400).json({
          error:
            'Formato inválido. Envie apenas imagens JPG, JPEG, PNG ou WebP de até 4 MB.',
        });
        return;
      }

      const supabase = getSupabaseAdmin();
      const fileName = `${crypto.randomUUID()}.${detected.ext}`;
      const filePath = `products/${fileName}`;

      let { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(filePath, req.file.buffer, {
          contentType: detected.mime,
          upsert: false,
        });

      // Se o bucket ainda não foi criado no projeto Supabase, cria automaticamente com acesso público de leitura
      if (
        uploadErr &&
        (uploadErr.message?.toLowerCase().includes('not found') ||
          uploadErr.message?.toLowerCase().includes('bucket'))
      ) {
        await supabase.storage
          .createBucket('product-images', {
            public: true,
            fileSizeLimit: 4 * 1024 * 1024,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          })
          .catch(() => undefined);

        const retry = await supabase.storage
          .from('product-images')
          .upload(filePath, req.file.buffer, {
            contentType: detected.mime,
            upsert: false,
          });
        uploadErr = retry.error;
      }

      if (uploadErr) {
        res.status(500).json({
          error:
            'Erro ao enviar imagem para o armazenamento. Verifique o Supabase Storage (005_storage_setup.sql) e tente novamente.',
        });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      if (!publicUrlData?.publicUrl) {
        res.status(500).json({
          error: 'A imagem foi enviada, mas não foi possível gerar a URL pública.',
        });
        return;
      }

      res.status(201).json({
        imageUrl: publicUrlData.publicUrl,
        imagePath: filePath,
      });
    } catch {
      res.status(500).json({ error: 'Erro interno ao enviar imagem.' });
    }
  });
});

router.post('/products', async (req, res) => {
  try {
    const parsed = productUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Dados do produto inválidos.',
      });
      return;
    }

    const p = parsed.data;
    const supabase = getSupabaseAdmin();
    const primaryCat = p.category?.trim() || null;
    const cleanAdditional = Array.from(
      new Set(
        (p.additionalCategories || [])
          .map((c) => c.trim())
          .filter((c) => c.length > 0 && c !== primaryCat)
      )
    );
    const cleanSub = p.subcategory?.trim() || null;

    const basePayload = {
      name: p.name,
      description: p.description,
      category: primaryCat,
      image_url: p.imageUrl || null,
      image_path: p.imagePath || null,
      sale_type: p.saleType,
      price_unit: p.saleType === 'kg' ? null : p.priceUnit ?? null,
      promo_price_unit: p.saleType === 'kg' ? null : p.promoPriceUnit ?? null,
      price_kg: p.saleType === 'unit' ? null : p.priceKg ?? null,
      promo_price_kg: p.saleType === 'unit' ? null : p.promoPriceKg ?? null,
      manage_stock: p.manageStock,
      stock_quantity: p.manageStock ? p.stockQuantity ?? 0 : null,
      is_active: p.isActive,
    };

    let { data: product, error } = await supabase
      .from('products')
      .insert({
        ...basePayload,
        additional_categories: cleanAdditional,
        subcategory: cleanSub,
      })
      .select('*')
      .single();

    if (
      error &&
      (error.message?.includes('additional_categories') ||
        error.message?.includes('subcategory') ||
        error.code === '42703')
    ) {
      const legacy = await supabase
        .from('products')
        .insert(basePayload)
        .select('*')
        .single();
      product = legacy.data;
      error = legacy.error;
    }

    if (error) {
      res.status(400).json({ error: 'Não foi possível cadastrar o produto.' });
      return;
    }

    res.status(201).json({ product });
  } catch {
    res.status(500).json({ error: 'Erro interno ao criar produto.' });
  }
});

router.patch('/products/:id', async (req, res) => {
  try {
    const parsed = productUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Dados do produto inválidos.',
      });
      return;
    }

    const productId = req.params.id;
    const p = parsed.data;
    const supabase = getSupabaseAdmin();
    const primaryCat = p.category?.trim() || null;
    const cleanAdditional = Array.from(
      new Set(
        (p.additionalCategories || [])
          .map((c) => c.trim())
          .filter((c) => c.length > 0 && c !== primaryCat)
      )
    );
    const cleanSub = p.subcategory?.trim() || null;

    const basePayload = {
      name: p.name,
      description: p.description,
      category: primaryCat,
      image_url: p.imageUrl || null,
      image_path: p.imagePath || null,
      sale_type: p.saleType,
      price_unit: p.saleType === 'kg' ? null : p.priceUnit ?? null,
      promo_price_unit: p.saleType === 'kg' ? null : p.promoPriceUnit ?? null,
      price_kg: p.saleType === 'unit' ? null : p.priceKg ?? null,
      promo_price_kg: p.saleType === 'unit' ? null : p.promoPriceKg ?? null,
      manage_stock: p.manageStock,
      stock_quantity: p.manageStock ? p.stockQuantity ?? 0 : null,
      is_active: p.isActive,
    };

    let { data: product, error } = await supabase
      .from('products')
      .update({
        ...basePayload,
        additional_categories: cleanAdditional,
        subcategory: cleanSub,
      })
      .eq('id', productId)
      .select('*')
      .single();

    if (
      error &&
      (error.message?.includes('additional_categories') ||
        error.message?.includes('subcategory') ||
        error.code === '42703')
    ) {
      const legacy = await supabase
        .from('products')
        .update(basePayload)
        .eq('id', productId)
        .select('*')
        .single();
      product = legacy.data;
      error = legacy.error;
    }

    if (error || !product) {
      res.status(404).json({ error: 'Produto não encontrado ou inválido.' });
      return;
    }

    res.json({ product });
  } catch {
    res.status(500).json({ error: 'Erro interno ao atualizar produto.' });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const supabase = getSupabaseAdmin();

    // Verifica se o produto já faz parte de algum pedido; se sim, desativa em vez de quebrar histórico
    const { count: orderItemCount } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId);

    if ((orderItemCount || 0) > 0) {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', productId);

      if (error) {
        res.status(500).json({ error: 'Não foi possível desativar o produto.' });
        return;
      }

      res.json({
        deactivated: true,
        message:
          'Este produto possui pedidos vinculados e foi desativado do catálogo para preservar o histórico.',
      });
      return;
    }

    const { data: existing } = await supabase
      .from('products')
      .select('image_path')
      .eq('id', productId)
      .maybeSingle();

    const { error: deleteErr } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (deleteErr) {
      res.status(500).json({ error: 'Não foi possível excluir o produto.' });
      return;
    }

    if (existing?.image_path) {
      await supabase.storage
        .from('product-images')
        .remove([existing.image_path])
        .catch(() => undefined);
    }

    res.json({ deleted: true, message: 'Produto excluído com sucesso.' });
  } catch {
    res.status(500).json({ error: 'Erro interno ao remover produto.' });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const supabase = getSupabaseAdmin();

    const runOrders = (withDeliveryMode: boolean) => {
      let query = withDeliveryMode
        ? supabase
            .from('orders')
            .select(
              'id, order_number, user_id, status, delivery_mode, subtotal, shipping_fee, total, shipping_cep, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, customer_name, customer_cpf, customer_phone, notes, created_at, updated_at, order_items(id, product_id, product_name, unit_mode, quantity, unit_price, line_total), payments(id, method, status, amount, provider, provider_reference, details)'
            )
            .order('created_at', { ascending: false })
        : supabase
            .from('orders')
            .select(
              'id, order_number, user_id, status, subtotal, shipping_fee, total, shipping_cep, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, customer_name, customer_cpf, customer_phone, notes, created_at, updated_at, order_items(id, product_id, product_name, unit_mode, quantity, unit_price, line_total), payments(id, method, status, amount, provider, provider_reference, details)'
            )
            .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }
      return query;
    };

    let { data, error } = await runOrders(true);
    if (error && (error.message?.includes('delivery_mode') || error.code === '42703')) {
      const legacy = await runOrders(false);
      data = legacy.data;
      error = legacy.error;
    }

    if (error) {
      res.status(500).json({ error: 'Não foi possível consultar pedidos.' });
      return;
    }

    res.json({ orders: data || [] });
  } catch {
    res.status(500).json({ error: 'Erro interno ao consultar pedidos.' });
  }
});

router.patch('/orders/:id/status', async (req, res) => {
  try {
    const parsed = orderStatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Status de pedido inválido.' });
      return;
    }

    const orderId = req.params.id;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc('update_order_status_atomic', {
      p_order_id: orderId,
      p_new_status: parsed.data.status,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('ORDER_NOT_FOUND')) {
        res.status(404).json({ error: 'Pedido não encontrado.' });
        return;
      }
      if (msg.includes('CANNOT_REOPEN_CANCELLED_ORDER')) {
        res.status(409).json({
          error: 'Pedidos cancelados não podem ser reabertos.',
        });
        return;
      }
      res.status(400).json({ error: 'Não foi possível atualizar o status.' });
      return;
    }

    res.json({ order: data });
  } catch {
    res.status(500).json({ error: 'Erro interno ao atualizar pedido.' });
  }
});

router.get('/users', async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, full_name, email, cpf, phone, role, is_active, must_change_password, created_at'
      )
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: 'Não foi possível consultar usuários.' });
      return;
    }

    res.json({ users: data || [] });
  } catch {
    res.status(500).json({ error: 'Erro interno ao listar usuários.' });
  }
});

// Apenas super_admin pode criar novos administradores ou alterar status de usuários
router.post('/users', requireSuperAdmin, async (req, res) => {
  try {
    const parsed = createAdminUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Dados inválidos.',
      });
      return;
    }

    const { fullName, email, cpf, phone, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .or(`email.eq.${normalizedEmail},cpf.eq.${cpf}`)
      .maybeSingle();

    if (existing) {
      res.status(409).json({
        error: 'Já existe um usuário cadastrado com este e-mail ou CPF.',
      });
      return;
    }

    const { data: createdAuth, error: authErr } =
      await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (authErr || !createdAuth.user) {
      res.status(400).json({ error: 'Não foi possível criar usuário administrativo.' });
      return;
    }

    const userId = createdAuth.user.id;

    // Papel fixado no servidor como 'admin' (nunca eleva para super_admin via API)
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name: fullName,
        email: normalizedEmail,
        cpf,
        phone,
        role: 'admin',
        must_change_password: true,
        is_active: true,
      })
      .select(
        'id, full_name, email, cpf, phone, role, is_active, must_change_password, created_at'
      )
      .single();

    if (profErr) {
      await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
      res.status(500).json({ error: 'Erro ao salvar perfil do administrador.' });
      return;
    }

    await supabase.from('carts').insert({ user_id: userId });

    res.status(201).json({ user: profile });
  } catch {
    res.status(500).json({ error: 'Erro interno ao criar administrador.' });
  }
});

router.patch('/users/:id', requireSuperAdmin, async (req, res) => {
  try {
    const targetId = req.params.id;
    const isActive = Boolean(req.body?.isActive);

    if (targetId === req.authUser!.id) {
      res.status(400).json({
        error: 'Você não pode alterar o status da sua própria conta aqui.',
      });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: target } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', targetId)
      .single();

    if (!target) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    if (target.role === 'super_admin') {
      res.status(403).json({
        error: 'Não é permitido alterar o administrador máximo por esta rota.',
      });
      return;
    }

    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', targetId)
      .select(
        'id, full_name, email, cpf, phone, role, is_active, must_change_password, created_at'
      )
      .single();

    if (error) {
      res.status(500).json({ error: 'Erro ao atualizar status do usuário.' });
      return;
    }

    res.json({ user: updated });
  } catch {
    res.status(500).json({ error: 'Erro interno ao atualizar usuário.' });
  }
});

export default router;
