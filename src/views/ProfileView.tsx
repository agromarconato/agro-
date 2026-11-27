import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Edit3,
  LogOut,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import {
  formatCepInput,
  formatCpfDisplay,
  formatDateTime,
  formatPhoneInput,
} from '../lib/format';
import type { CustomerAddress, UserProfile } from '../types';

interface ProfileViewProps {
  onGoToCatalog: () => void;
  onGoToOrders: () => void;
  onGoToAdmin: () => void;
  onLoggedOut: () => void;
}

interface MeResponse {
  user: UserProfile;
  profileDetails?: {
    createdAt: string | null;
    isActive: boolean;
  };
  addresses?: CustomerAddress[];
}

export function ProfileView({
  onGoToCatalog,
  onGoToOrders,
  onGoToAdmin,
  onLoggedOut,
}: ProfileViewProps) {
  const { user, accessToken, updateProfileLocal, logout } = useAuth();

  const [loadingDetails, setLoadingDetails] = useState(true);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);

  const [editing, setEditing] = useState(false);
  const [fullNameInput, setFullNameInput] = useState(user?.fullName || '');
  const [phoneInput, setPhoneInput] = useState(
    user?.phone ? formatPhoneInput(user.phone) : ''
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullNameInput(user.fullName);
    setPhoneInput(formatPhoneInput(user.phone));
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!accessToken) {
      setLoadingDetails(false);
      return;
    }

    setLoadingDetails(true);
    apiFetch<MeResponse>('/api/auth/me', { token: accessToken })
      .then((res) => {
        if (!active) return;
        if (res.user) {
          updateProfileLocal(res.user);
        }
        if (res.profileDetails) {
          setCreatedAt(res.profileDetails.createdAt);
          setIsActive(res.profileDetails.isActive);
        }
        setAddresses(res.addresses || []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingDetails(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, updateProfileLocal]);

  if (!user) return null;

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const roleLabel =
    user.role === 'super_admin'
      ? 'Administrador Máximo'
      : user.role === 'admin'
        ? 'Administrador'
        : 'Cliente';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);
    setSaving(true);
    try {
      const res = await apiFetch<{ message: string; user: UserProfile }>(
        '/api/auth/me',
        {
          method: 'PATCH',
          token: accessToken,
          body: {
            fullName: fullNameInput.trim(),
            phone: phoneInput,
          },
        }
      );
      updateProfileLocal(res.user);
      setEditing(false);
      setSaveSuccess(res.message || 'Dados cadastrais atualizados.');
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Não foi possível atualizar seus dados.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      onLoggedOut();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-5">
        <div>
          <button
            type="button"
            onClick={onGoToCatalog}
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-emerald-900 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao catálogo
          </button>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900 sm:text-3xl">
            Meu Perfil
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Consulte e mantenha seus dados cadastrais atualizados na Agro Marconato.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onGoToOrders}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-900/25 bg-white px-4 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-50"
          >
            <PackageCheck className="h-4 w-4 text-emerald-800" />
            Meus Pedidos
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={onGoToAdmin}
              className="inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-900/25 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-100"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-800" />
              Painel Admin
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div
          role="status"
          className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-800" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Cartão principal de resumo da conta */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 bg-emerald-950/[0.03] px-6 py-5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-white shadow-sm">
              <User className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-neutral-900">
                {user.fullName}
              </h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                <span className="inline-flex items-center rounded-md bg-emerald-900/10 px-2 py-0.5 font-semibold text-emerald-950">
                  {roleLabel}
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  {isActive ? 'Conta ativa' : 'Conta inativa'}
                </span>
              </div>
            </div>
          </div>

          {!editing && (
            <button
              type="button"
              onClick={() => {
                setSaveError(null);
                setSaveSuccess(null);
                setFullNameInput(user.fullName);
                setPhoneInput(formatPhoneInput(user.phone));
                setEditing(true);
              }}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-800 transition-colors hover:border-emerald-900/40 hover:bg-neutral-50"
            >
              <Edit3 className="h-3.5 w-3.5 text-emerald-900" />
              Editar dados
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSaveProfile} className="space-y-4 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="profile-fullname"
                  className="block text-xs font-semibold text-neutral-800"
                >
                  Nome completo
                </label>
                <input
                  id="profile-fullname"
                  type="text"
                  required
                  minLength={3}
                  maxLength={120}
                  value={fullNameInput}
                  onChange={(e) => setFullNameInput(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-sm text-neutral-900 focus:border-emerald-800 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-phone"
                  className="block text-xs font-semibold text-neutral-800"
                >
                  Telefone / WhatsApp
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  required
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(formatPhoneInput(e.target.value))}
                  placeholder="(42) 99999-9999"
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 font-mono text-sm text-neutral-900 focus:border-emerald-800 focus:outline-none"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-neutral-600">
                  CPF (não alterável)
                </span>
                <p className="mt-1 flex h-11 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 font-mono tabular-nums text-sm text-neutral-600">
                  {formatCpfDisplay(user.cpf)}
                </p>
              </div>

              <div>
                <span className="block text-xs font-semibold text-neutral-600">
                  E-mail (não alterável)
                </span>
                <p className="mt-1 flex h-11 items-center truncate rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 text-sm text-neutral-600">
                  {user.email}
                </p>
              </div>
            </div>

            {saveError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {saveError}
              </p>
            )}

            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] cursor-pointer rounded-xl bg-emerald-900 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-950 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setSaveError(null);
                }}
                className="min-h-[42px] cursor-pointer rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-4">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <User className="h-3.5 w-3.5 text-emerald-800" />
                Nome completo
              </span>
              <p className="mt-1.5 text-sm font-bold text-neutral-900 break-words">
                {user.fullName}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                CPF
              </span>
              <p className="mt-1.5 font-mono tabular-nums text-sm font-bold text-neutral-900">
                {formatCpfDisplay(user.cpf)}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-4">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <Mail className="h-3.5 w-3.5 text-emerald-800" />
                E-mail
              </span>
              <p className="mt-1.5 text-sm font-bold text-neutral-900 break-all">
                {user.email}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-4">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <Phone className="h-3.5 w-3.5 text-emerald-800" />
                Telefone
              </span>
              <p className="mt-1.5 font-mono tabular-nums text-sm font-bold text-neutral-900">
                {formatPhoneInput(user.phone)}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-4">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-800" />
                Tipo e situação da conta
              </span>
              <p className="mt-1.5 text-sm font-bold text-neutral-900">
                {roleLabel} · {isActive ? 'Ativa' : 'Inativa'}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-4">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <Calendar className="h-3.5 w-3.5 text-emerald-800" />
                Cliente desde
              </span>
              <p className="mt-1.5 text-sm font-bold text-neutral-900">
                {loadingDetails
                  ? 'Carregando...'
                  : createdAt
                    ? formatDateTime(createdAt)
                    : 'Conta verificada'}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Endereços salvos vinculados exclusivamente a este usuário */}
      <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-emerald-800" />
          <h2 className="text-base font-bold text-neutral-900">
            Endereços cadastrados
          </h2>
        </div>

        {loadingDetails ? (
          <p className="mt-3 text-sm text-neutral-500">
            Consultando endereços salvos...
          </p>
        ) : addresses.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">
            Nenhum endereço salvo ainda. Quando você finalizar um pedido para entrega, seu endereço ficará registrado aqui para consulta.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-emerald-900">
                    CEP {formatCepInput(addr.cep)}
                  </span>
                  {addr.is_default && (
                    <span className="rounded-md bg-emerald-900/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-950">
                      Principal
                    </span>
                  )}
                </div>
                <p className="mt-1.5 font-semibold text-neutral-900">
                  {addr.street}, {addr.number}
                  {addr.complement ? ` — ${addr.complement}` : ''}
                </p>
                <p className="text-xs text-neutral-600">
                  {addr.neighborhood} · {addr.city}/{addr.state}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Encerrar sessão (botão de sair exclusivamente dentro do perfil) */}
      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-200/80 bg-red-50/40 p-6">
        <div>
          <h2 className="text-base font-bold text-neutral-900">
            Sessão da conta
          </h2>
          <p className="mt-0.5 text-sm text-neutral-600">
            Deseja encerrar o acesso neste dispositivo?
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-red-300 bg-white px-5 py-2.5 text-sm font-bold text-red-700 shadow-sm transition-colors hover:bg-red-600 hover:text-white disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          <span>{loggingOut ? 'Saindo...' : 'Sair da conta'}</span>
        </button>
      </section>
    </main>
  );
}
