import { getEnv, getSupabaseAdmin, isSupabaseConfigured } from '../supabase.ts';
import { digitsOnly, isValidCpf } from '../utils/validation.ts';

export interface ProvisionResult {
  status:
    | 'already_initialized'
    | 'provisioned'
    | 'not_configured'
    | 'invalid_env'
    | 'error';
  message?: string;
}

let bootstrapVerifiedInMemory = false;
let inFlightProvision: Promise<ProvisionResult> | null = null;

async function findAuthUserByEmail(email: string) {
  const supabase = getSupabaseAdmin();
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) {
      return null;
    }
    const found = data.users.find(
      (u) => (u.email || '').trim().toLowerCase() === email
    );
    if (found) return found;
    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function runProvisioning(): Promise<ProvisionResult> {
  if (!isSupabaseConfigured()) {
    return { status: 'not_configured' };
  }

  const supabase = getSupabaseAdmin();

  // 1. Verifica se o sistema já possui bootstrap registrado
  const { data: existingBootstrap, error: bootstrapReadErr } = await supabase
    .from('system_bootstrap')
    .select('id, super_admin_id')
    .eq('id', 1)
    .maybeSingle();

  if (bootstrapReadErr) {
    return {
      status: 'error',
      message: 'Erro ao consultar system_bootstrap no banco de dados.',
    };
  }

  if (existingBootstrap) {
    bootstrapVerifiedInMemory = true;
    return { status: 'already_initialized' };
  }

  // 2. Se já existir algum super_admin em public.profiles, apenas registra o lock sem sobrescrever contas
  const { data: existingSuperAdmin } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'super_admin')
    .limit(1)
    .maybeSingle();

  if (existingSuperAdmin) {
    await supabase
      .from('system_bootstrap')
      .upsert(
        { id: 1, super_admin_id: existingSuperAdmin.id },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    bootstrapVerifiedInMemory = true;
    return { status: 'already_initialized' };
  }

  // 3. Lê as credenciais do administrador inicial das variáveis de ambiente do servidor
  const rawCpf = digitsOnly(getEnv('INITIAL_SUPERADMIN_CPF'));
  const emailEnv = getEnv('INITIAL_SUPERADMIN_EMAIL').toLowerCase();
  const email =
    emailEnv && emailEnv.includes('@')
      ? emailEnv
      : isValidCpf(rawCpf)
        ? `superadmin.${rawCpf}@agromarconato.com`
        : '';
  const fullNameEnv = getEnv('INITIAL_SUPERADMIN_NAME');
  const fullName =
    fullNameEnv.length >= 3 ? fullNameEnv : 'Administrador AgroMarconato';
  const rawPhone = digitsOnly(getEnv('INITIAL_SUPERADMIN_PHONE'));
  const fallbackPhone = digitsOnly(getEnv('VITE_WHATSAPP_NUMBER'));
  const phone =
    rawPhone.length >= 10
      ? rawPhone
      : fallbackPhone.length >= 10
        ? fallbackPhone
        : '42988093611';
  const password = getEnv('INITIAL_SUPERADMIN_PASSWORD');

  const missingOrInvalid: string[] = [];
  if (!isValidCpf(rawCpf)) missingOrInvalid.push('INITIAL_SUPERADMIN_CPF');
  if (!email || !email.includes('@')) missingOrInvalid.push('INITIAL_SUPERADMIN_EMAIL');
  if (!password || password.length < 6) missingOrInvalid.push('INITIAL_SUPERADMIN_PASSWORD');

  if (missingOrInvalid.length > 0) {
    return {
      status: 'invalid_env',
      message: `Variáveis de administrador inicial ausentes ou inválidas no servidor: ${missingOrInvalid.join(', ')}.`,
    };
  }

  // 4. Verifica se já existe perfil com este CPF ou e-mail em public.profiles
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, email, cpf, role')
    .or(`cpf.eq.${rawCpf},email.eq.${email}`)
    .limit(1)
    .maybeSingle();

  if (existingProfile) {
    // Nunca altera ou sobrescreve contas de clientes existentes com outro CPF
    if (existingProfile.cpf !== rawCpf) {
      return {
        status: 'invalid_env',
        message:
          'O e-mail configurado em INITIAL_SUPERADMIN_EMAIL já pertence a outro cliente cadastrado.',
      };
    }

    // Se o perfil já pertence exatamente ao CPF do super_admin configurado (mas ainda não tinha lock), garante role super_admin
    if (existingProfile.role !== 'super_admin') {
      await supabase
        .from('profiles')
        .update({ role: 'super_admin', is_active: true })
        .eq('id', existingProfile.id);
    }

    await supabase
      .from('system_bootstrap')
      .upsert(
        { id: 1, super_admin_id: existingProfile.id },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    await supabase
      .from('carts')
      .upsert({ user_id: existingProfile.id }, { onConflict: 'user_id', ignoreDuplicates: true });

    bootstrapVerifiedInMemory = true;
    return { status: 'provisioned' };
  }

  // 5. Cria usuário no Supabase Auth (ou reaproveita usuário órfão no Auth que ainda não possui perfil)
  let userId: string | null = null;
  let createdFreshAuthUser = false;

  const { data: createdAuth, error: createAuthErr } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

  if (createdAuth?.user) {
    userId = createdAuth.user.id;
    createdFreshAuthUser = true;
  } else {
    const existingAuthUser = await findAuthUserByEmail(email);
    if (!existingAuthUser) {
      return {
        status: 'error',
        message: 'Não foi possível criar a conta de autenticação do administrador inicial.',
      };
    }

    // Só vincula o usuário órfão se realmente não houver perfil para esse ID
    const { data: profileById } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', existingAuthUser.id)
      .maybeSingle();

    if (profileById) {
      return {
        status: 'invalid_env',
        message:
          'Já existe um perfil vinculado ao e-mail configurado para o administrador inicial.',
      };
    }

    const { error: updateErr } = await supabase.auth.admin.updateUserById(
      existingAuthUser.id,
      {
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      }
    );

    if (updateErr) {
      return {
        status: 'error',
        message: 'Não foi possível sincronizar a conta de autenticação do administrador inicial.',
      };
    }

    userId = existingAuthUser.id;
  }

  const { error: profileInsertErr } = await supabase.from('profiles').insert({
    id: userId,
    full_name: fullName,
    email,
    cpf: rawCpf,
    phone,
    role: 'super_admin',
    must_change_password: false,
    is_active: true,
  });

  if (profileInsertErr) {
    if (createdFreshAuthUser) {
      await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    return {
      status: 'error',
      message: 'Falha ao criar o perfil administrativo no banco de dados.',
    };
  }

  const { error: lockErr } = await supabase.from('system_bootstrap').insert({
    id: 1,
    super_admin_id: userId,
  });

  if (lockErr) {
    // Outro processo concorrente já inicializou; se acabamos de criar o registro duplicado, reverte apenas ele
    if (createdFreshAuthUser) {
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    bootstrapVerifiedInMemory = true;
    return { status: 'already_initialized' };
  }

  await supabase
    .from('carts')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });

  bootstrapVerifiedInMemory = true;
  return { status: 'provisioned' };
}

export async function ensureInitialSuperAdminProvisioned(): Promise<ProvisionResult> {
  if (bootstrapVerifiedInMemory) {
    return { status: 'already_initialized' };
  }

  if (!inFlightProvision) {
    inFlightProvision = runProvisioning().finally(() => {
      inFlightProvision = null;
    });
  }

  return inFlightProvision;
}

export function resetSuperAdminProvisionCacheForTest(): void {
  bootstrapVerifiedInMemory = false;
  inFlightProvision = null;
}
