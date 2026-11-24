import { Check, KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PasswordInput } from '../components/PasswordInput';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import {
  formatCpfInput,
  formatPhoneInput,
  isValidCpfClient,
} from '../lib/format';
import type { UserProfile } from '../types';

interface AuthViewProps {
  initialTab: 'login' | 'register';
  onAuthComplete: (user: UserProfile, token: string) => Promise<void>;
}

interface AuthResponse {
  accessToken: string;
  user: UserProfile;
  requiresLogin?: boolean;
  message?: string;
}

export function AuthView({ initialTab, onAuthComplete }: AuthViewProps) {
  const { pendingCartIntent } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Login (CPF e senha)
  const [loginCpf, setLoginCpf] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Cadastro
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const normalizedCpf = loginCpf.replace(/\D/g, '');
    if (!isValidCpfClient(normalizedCpf)) {
      setError('CPF inválido. Informe os 11 dígitos do seu CPF.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: { cpf: normalizedCpf, password: loginPassword },
      });
      await onAuthComplete(res.user, res.accessToken);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível entrar na conta.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!isValidCpfClient(cpf)) {
      setError('Informe um CPF válido.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: {
          fullName: fullName.trim(),
          email: email.trim(),
          cpf,
          phone,
          password,
        },
      });

      if (res.requiresLogin) {
        setTab('login');
        setInfoMessage(
          res.message || 'Cadastro criado. Entre com seu CPF e senha.'
        );
        return;
      }

      await onAuthComplete(res.user, res.accessToken);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível concluir o cadastro.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      {pendingCartIntent && (
        <div className="mb-6 rounded-xl border border-emerald-900/20 bg-emerald-50 p-4 text-sm text-emerald-950">
          Você selecionou <strong>{pendingCartIntent.productName}</strong>.
          Entre ou crie sua conta abaixo para adicioná-lo automaticamente ao seu
          carrinho.
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`min-h-[42px] flex-1 cursor-pointer rounded-md text-sm font-semibold transition-colors ${
              tab === 'login'
                ? 'bg-emerald-900 text-white'
                : 'text-neutral-700 hover:text-neutral-950'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`min-h-[42px] flex-1 cursor-pointer rounded-md text-sm font-semibold transition-colors ${
              tab === 'register'
                ? 'bg-emerald-900 text-white'
                : 'text-neutral-700 hover:text-neutral-950'
            }`}
          >
            Criar conta
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {infoMessage && (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {infoMessage}
          </div>
        )}

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="mt-6 space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">
                Acessar sua conta
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Use seu CPF e senha para acompanhar pedidos ou administrar a loja.
              </p>
            </div>

            <div>
              <label
                htmlFor="login-cpf"
                className="block text-sm font-medium text-neutral-800"
              >
                CPF
              </label>
              <input
                id="login-cpf"
                type="text"
                required
                inputMode="numeric"
                autoComplete="username"
                value={loginCpf}
                onChange={(e) => setLoginCpf(formatCpfInput(e.target.value))}
                placeholder="000.000.000-00"
                className="mt-1.5 h-12 w-full rounded-lg border border-neutral-300 px-4 font-mono tabular-nums text-base text-neutral-900 focus:border-emerald-800 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-neutral-800"
              >
                Senha
              </label>
              <PasswordInput
                id="login-password"
                required
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Digite sua senha"
                wrapperClassName="mt-1.5"
                className="h-12 w-full rounded-lg border border-neutral-300 pl-4 text-base text-neutral-900 focus:border-emerald-800 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="min-h-[48px] w-full cursor-pointer rounded-lg bg-emerald-900 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-950 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="mt-6 space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">
                Criar conta de cliente
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Preencha seus dados para adicionar produtos ao carrinho e finalizar pedidos.
              </p>
            </div>

            <div>
              <label
                htmlFor="reg-name"
                className="block text-sm font-medium text-neutral-800"
              >
                Nome completo
              </label>
              <input
                id="reg-name"
                type="text"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Maria da Silva"
                className="mt-1.5 h-12 w-full rounded-lg border border-neutral-300 px-4 text-base text-neutral-900 focus:border-emerald-800 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="reg-email"
                className="block text-sm font-medium text-neutral-800"
              >
                E-mail
              </label>
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="mt-1.5 h-12 w-full rounded-lg border border-neutral-300 px-4 text-base text-neutral-900 focus:border-emerald-800 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="reg-cpf"
                  className="block text-sm font-medium text-neutral-800"
                >
                  CPF
                </label>
                <input
                  id="reg-cpf"
                  type="text"
                  required
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpfInput(e.target.value))}
                  placeholder="000.000.000-00"
                  className="mt-1.5 h-12 w-full rounded-lg border border-neutral-300 px-4 font-mono tabular-nums text-base text-neutral-900 focus:border-emerald-800 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-phone"
                  className="block text-sm font-medium text-neutral-800"
                >
                  Telefone / WhatsApp
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  required
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  placeholder="(42) 99999-9999"
                  className="mt-1.5 h-12 w-full rounded-lg border border-neutral-300 px-4 font-mono tabular-nums text-base text-neutral-900 focus:border-emerald-800 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="reg-password"
                className="block text-sm font-medium text-neutral-800"
              >
                Senha forte
              </label>
              <PasswordInput
                id="reg-password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Crie uma senha segura"
                wrapperClassName="mt-1.5"
                className="h-12 w-full rounded-lg border border-neutral-300 pl-4 text-base text-neutral-900 focus:border-emerald-800 focus:outline-none"
              />
              <ul className="mt-2.5 grid grid-cols-1 gap-1.5 text-xs text-neutral-600 sm:grid-cols-2">
                {[
                  { ok: passwordChecks.length, label: 'Mínimo 8 caracteres' },
                  { ok: passwordChecks.upper, label: '1 letra maiúscula' },
                  { ok: passwordChecks.lower, label: '1 letra minúscula' },
                  { ok: passwordChecks.number, label: '1 número' },
                  { ok: passwordChecks.symbol, label: '1 símbolo (ex: !@#$)' },
                ].map((rule) => (
                  <li
                    key={rule.label}
                    className={`flex items-center gap-1.5 ${
                      rule.ok ? 'font-medium text-emerald-800' : 'text-neutral-500'
                    }`}
                  >
                    <Check
                      className={`h-3.5 w-3.5 ${
                        rule.ok ? 'text-emerald-700' : 'text-neutral-300'
                      }`}
                    />
                    {rule.label}
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="min-h-[48px] w-full cursor-pointer rounded-lg bg-emerald-900 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-950 disabled:opacity-50"
            >
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export function ChangePasswordView({
  onPasswordUpdated,
}: {
  onPasswordUpdated: () => void;
}) {
  const { accessToken, updateProfileLocal } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        token: accessToken,
        body: { newPassword },
      });
      updateProfileLocal({ mustChangePassword: false });
      onPasswordUpdated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível alterar a senha.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-900">
          <KeyRound className="h-5 w-5" />
          <h1 className="text-xl font-bold text-neutral-900">
            Alteração obrigatória da senha inicial
          </h1>
        </div>
        <p className="mt-2 text-sm text-neutral-600">
          Por segurança, defina uma nova senha forte pessoal antes de continuar no sistema.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="new-pwd"
              className="block text-sm font-medium text-neutral-800"
            >
              Nova senha forte
            </label>
            <PasswordInput
              id="new-pwd"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mín. 8 chars, maiúscula, minúscula, número e símbolo"
              wrapperClassName="mt-1.5"
              className="h-12 w-full rounded-lg border border-neutral-300 pl-4 text-base"
            />
          </div>

          <div>
            <label
              htmlFor="confirm-pwd"
              className="block text-sm font-medium text-neutral-800"
            >
              Confirmar nova senha
            </label>
            <PasswordInput
              id="confirm-pwd"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              toggleLabel="confirmação de senha"
              wrapperClassName="mt-1.5"
              className="h-12 w-full rounded-lg border border-neutral-300 pl-4 text-base"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="min-h-[48px] w-full cursor-pointer rounded-lg bg-emerald-900 px-6 py-3 text-base font-semibold text-white hover:bg-emerald-950 disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Atualizar senha e continuar'}
          </button>
        </form>
      </div>
    </main>
  );
}
