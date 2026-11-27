import { Router } from 'express';
import {
  createSupabaseAnonClient,
  getEnv,
  getSupabaseAdmin,
  isSupabaseConfigured,
} from '../supabase.ts';
import { ensureInitialSuperAdminProvisioned } from '../services/superAdminProvisioning.ts';
import {
  changePasswordSchema,
  digitsOnly,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '../utils/validation.ts';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import {
  clearSessionCookie,
  requireAuth,
  resolveOptionalAuth,
  setSessionCookie,
} from '../middleware/auth.ts';

const router = Router();

const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  keyPrefix: 'auth',
  keyExtra: (req) => {
    const cpf = digitsOnly(String(req.body?.cpf || ''));
    if (cpf) return cpf;
    return String(req.body?.email || '').toLowerCase().trim();
  },
});

router.post('/register', authRateLimit, async (req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      res.status(503).json({
        error: 'Serviço de autenticação aguardando configuração do Supabase.',
      });
      return;
    }

    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Dados de cadastro inválidos.',
      });
      return;
    }

    const { fullName, email, cpf, phone, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    await ensureInitialSuperAdminProvisioned();
    const supabaseAdmin = getSupabaseAdmin();

    // Verifica duplicidade de CPF ou e-mail antes de criar usuário no Auth
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, cpf')
      .or(`email.eq.${normalizedEmail},cpf.eq.${cpf}`)
      .limit(1)
      .maybeSingle();

    if (existingProfile) {
      if (existingProfile.cpf === cpf) {
        res.status(409).json({ error: 'Já existe uma conta cadastrada com este CPF.' });
        return;
      }
      res.status(409).json({ error: 'Já existe uma conta cadastrada com este e-mail.' });
      return;
    }

    const { data: createdAuth, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

    if (createAuthError || !createdAuth.user) {
      const msg =
        createAuthError?.message?.toLowerCase().includes('already')
          ? 'Já existe uma conta cadastrada com este e-mail.'
          : 'Não foi possível concluir seu cadastro. Verifique os dados informados.';
      res.status(400).json({ error: msg });
      return;
    }

    const userId = createdAuth.user.id;

    // Papel sempre definido no servidor como 'customer'
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      full_name: fullName,
      email: normalizedEmail,
      cpf,
      phone,
      role: 'customer',
      must_change_password: false,
      is_active: true,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
      res.status(400).json({
        error: 'Não foi possível salvar seu perfil. Verifique se CPF ou e-mail já existem.',
      });
      return;
    }

    await supabaseAdmin.from('carts').insert({ user_id: userId });

    // Inicia sessão real no Supabase Auth
    const anonClient = createSupabaseAnonClient();
    const { data: signInData, error: signInError } =
      await anonClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    if (signInError || !signInData.session) {
      res.status(201).json({
        message: 'Conta criada com sucesso. Faça login com seu CPF e senha para continuar.',
        requiresLogin: true,
      });
      return;
    }

    setSessionCookie(
      req,
      res,
      signInData.session.access_token,
      signInData.session.expires_in || 3600
    );

    res.status(201).json({
      accessToken: signInData.session.access_token,
      expiresAt: signInData.session.expires_at,
      user: {
        id: userId,
        fullName,
        email: normalizedEmail,
        cpf,
        phone,
        role: 'customer',
        mustChangePassword: false,
      },
    });
  } catch {
    res.status(500).json({ error: 'Erro interno ao processar cadastro.' });
  }
});

router.post('/login', authRateLimit, async (req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      res.status(503).json({
        error: 'Serviço de autenticação aguardando configuração do Supabase.',
      });
      return;
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'CPF ou senha inválidos.',
      });
      return;
    }

    const { cpf, password } = parsed.data;
    const provisionResult = await ensureInitialSuperAdminProvisioned();
    const supabaseAdmin = getSupabaseAdmin();

    // Localiza o perfil pelo CPF normalizado (11 dígitos) exclusivamente no servidor
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(
        'id, full_name, email, cpf, phone, role, must_change_password, is_active'
      )
      .eq('cpf', cpf)
      .maybeSingle();

    if (profileError) {
      res.status(500).json({
        error:
          'Erro ao consultar perfil no banco de dados. Verifique se os scripts SQL foram executados.',
      });
      return;
    }

    if (!profile) {
      const configuredAdminCpf = digitsOnly(getEnv('INITIAL_SUPERADMIN_CPF'));
      if (
        configuredAdminCpf &&
        cpf === configuredAdminCpf &&
        (provisionResult.status === 'invalid_env' || provisionResult.status === 'error') &&
        provisionResult.message
      ) {
        res.status(503).json({ error: provisionResult.message });
        return;
      }
      res.status(401).json({ error: 'CPF ou senha incorretos.' });
      return;
    }

    if (!profile.is_active) {
      res.status(403).json({
        error: 'Esta conta está desativada. Entre em contato com o suporte.',
      });
      return;
    }

    const anonClient = createSupabaseAnonClient();
    const { data: authData, error: authError } =
      await anonClient.auth.signInWithPassword({
        email: profile.email,
        password,
      });

    if (authError || !authData.session || !authData.user) {
      res.status(401).json({ error: 'CPF ou senha incorretos.' });
      return;
    }

    setSessionCookie(
      req,
      res,
      authData.session.access_token,
      authData.session.expires_in || 3600
    );

    res.json({
      accessToken: authData.session.access_token,
      expiresAt: authData.session.expires_at,
      user: {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        cpf: profile.cpf,
        phone: profile.phone,
        role: profile.role,
        mustChangePassword: Boolean(profile.must_change_password),
      },
    });
  } catch {
    res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
});

router.get('/session', async (req, res) => {
  try {
    const user = await resolveOptionalAuth(req);
    if (!user || !req.accessToken) {
      res.json({ authenticated: false, user: null });
      return;
    }
    res.json({
      authenticated: true,
      accessToken: req.accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        cpf: user.cpf,
        phone: user.phone,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch {
    res.json({ authenticated: false, user: null });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = req.authUser!;
    const supabaseAdmin = getSupabaseAdmin();

    const [{ data: profileRow }, { data: addressRows }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('created_at, is_active')
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('addresses')
        .select(
          'id, cep, street, number, complement, neighborhood, city, state, is_default, created_at'
        )
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    res.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        cpf: user.cpf,
        phone: user.phone,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
      profileDetails: {
        createdAt: profileRow?.created_at ?? null,
        isActive: profileRow?.is_active ?? true,
      },
      addresses: addressRows || [],
    });
  } catch {
    res.status(500).json({ error: 'Não foi possível carregar seu perfil.' });
  }
});

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Dados inválidos.',
      });
      return;
    }

    const user = req.authUser!;
    const { fullName, phone } = parsed.data;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: updated, error } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        phone,
      })
      .eq('id', user.id)
      .select(
        'id, full_name, email, cpf, phone, role, must_change_password, created_at, is_active'
      )
      .single();

    if (error || !updated) {
      res.status(400).json({ error: 'Não foi possível atualizar seu perfil.' });
      return;
    }

    res.json({
      message: 'Dados cadastrais atualizados com sucesso.',
      user: {
        id: updated.id,
        fullName: updated.full_name,
        email: updated.email,
        cpf: updated.cpf,
        phone: updated.phone,
        role: updated.role,
        mustChangePassword: Boolean(updated.must_change_password),
      },
      profileDetails: {
        createdAt: updated.created_at ?? null,
        isActive: Boolean(updated.is_active),
      },
    });
  } catch {
    res.status(500).json({ error: 'Erro interno ao atualizar perfil.' });
  }
});

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Nova senha inválida.',
      });
      return;
    }

    const user = req.authUser!;
    const supabaseAdmin = getSupabaseAdmin();

    const { error: updateAuthError } =
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: parsed.data.newPassword,
      });

    if (updateAuthError) {
      res.status(400).json({ error: 'Não foi possível atualizar a senha.' });
      return;
    }

    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id);

    if (profileUpdateError) {
      res.status(500).json({ error: 'Senha alterada, mas houve falha ao atualizar o perfil.' });
      return;
    }

    res.json({
      message: 'Senha atualizada com sucesso.',
      mustChangePassword: false,
    });
  } catch {
    res.status(500).json({ error: 'Erro interno ao alterar a senha.' });
  }
});

router.post('/logout', (req, res) => {
  clearSessionCookie(req, res);
  res.json({ message: 'Sessão encerrada.' });
});

export default router;
