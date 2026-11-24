import type { NextFunction, Request, Response } from 'express';
import { getSupabaseAdmin, isSupabaseConfigured } from '../supabase.ts';

export type UserRole = 'customer' | 'admin' | 'super_admin';

export interface AuthUserProfile {
  id: string;
  fullName: string;
  email: string;
  cpf: string;
  phone: string;
  role: UserRole;
  mustChangePassword: boolean;
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUserProfile;
      accessToken?: string;
    }
  }
}

export async function resolveOptionalAuth(
  req: Request
): Promise<AuthUserProfile | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token || !isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      'id, full_name, email, cpf, phone, role, must_change_password, is_active'
    )
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    return null;
  }

  req.accessToken = token;
  req.authUser = {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    cpf: profile.cpf,
    phone: profile.phone,
    role: profile.role as UserRole,
    mustChangePassword: Boolean(profile.must_change_password),
    isActive: Boolean(profile.is_active),
  };

  return req.authUser;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isSupabaseConfigured()) {
      res.status(503).json({
        error:
          'Banco de dados Supabase ainda não configurado nas variáveis de ambiente.',
      });
      return;
    }

    const user = await resolveOptionalAuth(req);
    if (!user) {
      res.status(401).json({
        error: 'Sessão inválida ou expirada. Faça login para continuar.',
      });
      return;
    }

    next();
  } catch {
    res.status(401).json({
      error: 'Não foi possível validar sua sessão.',
    });
  }
}

export function requirePasswordChanged(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.authUser?.mustChangePassword) {
    res.status(403).json({
      error: 'É necessário alterar a senha inicial antes de continuar.',
      code: 'MUST_CHANGE_PASSWORD',
    });
    return;
  }
  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const role = req.authUser?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    res.status(403).json({
      error: 'Acesso restrito a administradores.',
    });
    return;
  }
  next();
}

export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.authUser?.role !== 'super_admin') {
    res.status(403).json({
      error: 'Ação permitida apenas ao administrador máximo.',
    });
    return;
  }
  next();
}
