import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import {
  getEnv,
  getSupabaseAdmin,
  isSupabaseConfigured,
} from '../supabase.ts';
import {
  requireAdmin,
  requireAuth,
  requirePasswordChanged,
  requireSuperAdmin,
} from '../middleware/auth.ts';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import {
  createAdminUserSchema,
  digitsOnly,
  isStrongPassword,
  isValidCpf,
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

const bootstrapLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  keyPrefix: 'admin-bootstrap',
});

function timingSafeCompareSecret(provided: string, expected: string): boolean {
  const hashA = crypto.createHash('sha256').update(provided).digest();
  const hashB = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function detectImageExtension(buffer: Buffer): {
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

router.get('/bootstrap-status', async (_req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      res.json({ initialized: false, supabaseConfigured: false, envReady: false });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('system_bootstrap')
      .select('id')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      res.json({ initialized: false, supabaseConfigured: true, envReady: false });
      return;
    }

    const envReady = Boolean(
      getEnv('ADMIN_BOOTSTRAP_SECRET') &&
        getEnv('INITIAL_SUPERADMIN_CPF') &&
        getEnv('INITIAL_SUPERADMIN_EMAIL') &&
        getEnv('INITIAL_SUPERADMIN_NAME') &&
        getEnv('INITIAL_SUPERADMIN_PHONE') &&
        getEnv('INITIAL_SUPERADMIN_PASSWORD')
    );

    res.json({
      initialized: Boolean(data),
      supabaseConfigured: true,
      envReady,
    });
  } catch {
    res.status(500).json({ error: 'Erro ao verificar estado de inicialização.' });
  }
});

router.post('/bootstrap', bootstrapLimiter, async (req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      res.status(503).json({
        error: 'Configure as variáveis do Supabase antes de inicializar o administrador.',
      });
      return;
    }

    const expectedSecret = getEnv('ADMIN_BOOTSTRAP_SECRET');
    if (!expectedSecret || expectedSecret.length < 16) {
      res.status(503).json({
        error:
          'Variável ADMIN_BOOTSTRAP_SECRET ausente ou muito curta no ambiente do servidor.',
      });
      return;
    }

    const providedSecret = String(
      req.headers['x-bootstrap-secret'] || req.body?.secret || ''
    ).trim();

    if (!providedSecret || !timingSafeCompareSecret(providedSecret, expectedSecret)) {
      res.status(403).json({ error: 'Segredo de inicialização inválido.' });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: alreadyInit } = await supabase
      .from('system_bootstrap')
      .select('id')
      .eq('id', 1)
      .maybeSingle();

    if (alreadyInit) {
      res.status(409).json({
        error: 'O administrador máximo inicial já foi configurado. Esta rota está bloqueada.',
      });
      return;
    }

    const rawCpf = digitsOnly(getEnv('INITIAL_SUPERADMIN_CPF'));
    const email = getEnv('INITIAL_SUPERADMIN_EMAIL').toLowerCase();
    const fullName = getEnv('INITIAL_SUPERADMIN_NAME');
    const phone = digitsOnly(getEnv('INITIAL_SUPERADMIN_PHONE'));
    const password = getEnv('INITIAL_SUPERADMIN_PASSWORD');

    if (!isValidCpf(rawCpf) || !email || !fullName || phone.length < 10 || !isStrongPassword(password)) {
      res.status(400).json({
        error:
          'Variáveis INITIAL_SUPERADMIN_* incompletas ou fora dos requisitos (CPF válido e senha forte).',
      });
      return;
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .or(`email.eq.${email},cpf.eq.${rawCpf}`)
      .maybeSingle();

    if (existingProfile) {
      res.status(409).json({
        error: 'Já existe um usuário com o CPF ou e-mail configurado para o administrador inicial.',
      });
      return;
    }

    const { data: createdAuth, error: authErr } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (authErr || !createdAuth.user) {
      res.status(400).json({
        error: 'Não foi possível criar a conta de autenticação do administrador inicial.',
      });
      return;
    }

    const userId = createdAuth.user.id;

    const { error: profileErr } = await supabase.from('profiles').insert({
      id: userId,
      full_name: fullName,
      email,
      cpf: rawCpf,
      phone,
      role: 'super_admin',
      must_change_password: true,
      is_active: true,
    });

    if (profileErr) {
      await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
      res.status(500).json({ error: 'Falha ao gravar perfil do administrador máximo.' });
      return;
    }

    const { error: lockErr } = await supabase.from('system_bootstrap').insert({
      id: 1,
      super_admin_id: userId,
    });

    if (lockErr) {
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
      res.status(409).json({ error: 'Inicialização já executada concorrentemente.' });
      return;
    }

    await supabase.from('carts').insert({ user_id: userId });

    res.status(201).json({
      message:
        'Administrador máximo inicial criado com sucesso. Faça login com o e-mail e senha configurados no ambiente e altere a senha no primeiro acesso.',
    });
  } catch {
    res.status(500).json({ error: 'Erro interno durante inicialização segura.' });
  }
});

// Todas as rotas abaixo exigem autenticação, senha inicial alterada e papel admin ou super_admin
router.use(requireAuth, requirePasswordChanged, requireAdmin);

router.get('/products', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const supabase = getSupabaseAdmin();

    let query = supabase
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

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: 'Erro ao listar produtos no painel.' });
      return;
    }

    res.json({ products: data || [] });
  } catch {
    res.status(500).json({ error: 'Erro interno ao listar produtos.' });
  }
});

router.post(
  '/products/upload-image',
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        res.status(400).json({ error: 'Selecione um arquivo de imagem.' });
        return;
      }

      const detected = detectImageExtension(req.file.buffer);
      if (!detected) {
        res.status(400).json({
          error: 'Formato inválido. Envie uma imagem JPG, PNG ou WebP de até 4MB.',
        });
        return;
      }

      const supabase = getSupabaseAdmin();
      const fileName = `${crypto.randomUUID()}.${detected.ext}`;
      const filePath = `products/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(filePath, req.file.buffer, {
          contentType: detected.mime,
          upsert: false,
        });

      if (uploadErr) {
        res.status(500).json({
          error:
            'Erro ao enviar imagem para o Supabase Storage. Verifique se o script 005_storage_setup.sql foi executado.',
        });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      res.status(201).json({
        imageUrl: publicUrlData.publicUrl,
        imagePath: filePath,
      });
    } catch {
      res.status(500).json({ error: 'Erro interno ao enviar imagem.' });
    }
  }
);

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

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name: p.name,
        description: p.description,
        category: p.category || null,
        image_url: p.imageUrl || null,
        image_path: p.imagePath || null,
        sale_type: p.saleType,
        price_unit: p.saleType === 'kg' ? null : p.priceUnit ?? null,
        promo_price_unit:
          p.saleType === 'kg' ? null : p.promoPriceUnit ?? null,
        price_kg: p.saleType === 'unit' ? null : p.priceKg ?? null,
        promo_price_kg:
          p.saleType === 'unit' ? null : p.promoPriceKg ?? null,
        manage_stock: p.manageStock,
        stock_quantity: p.manageStock ? p.stockQuantity ?? 0 : null,
        is_active: p.isActive,
      })
      .select('*')
      .single();

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

    const { data: product, error } = await supabase
      .from('products')
      .update({
        name: p.name,
        description: p.description,
        category: p.category || null,
        image_url: p.imageUrl || null,
        image_path: p.imagePath || null,
        sale_type: p.saleType,
        price_unit: p.saleType === 'kg' ? null : p.priceUnit ?? null,
        promo_price_unit:
          p.saleType === 'kg' ? null : p.promoPriceUnit ?? null,
        price_kg: p.saleType === 'unit' ? null : p.priceKg ?? null,
        promo_price_kg:
          p.saleType === 'unit' ? null : p.promoPriceKg ?? null,
        manage_stock: p.manageStock,
        stock_quantity: p.manageStock ? p.stockQuantity ?? 0 : null,
        is_active: p.isActive,
      })
      .eq('id', productId)
      .select('*')
      .single();

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

    let query = supabase
      .from('orders')
      .select(
        'id, order_number, user_id, status, subtotal, shipping_fee, total, shipping_cep, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, customer_name, customer_cpf, customer_phone, notes, created_at, updated_at, order_items(id, product_id, product_name, unit_mode, quantity, unit_price, line_total), payments(id, method, status, amount, provider, details)'
      )
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
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
