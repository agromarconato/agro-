import { X } from 'lucide-react';

interface LoginPromptModalProps {
  open: boolean;
  productName?: string;
  onClose: () => void;
  onGoToLogin: () => void;
  onGoToRegister: () => void;
}

export function LoginPromptModal({
  open,
  productName,
  onClose,
  onGoToLogin,
  onGoToRegister,
}: LoginPromptModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Login obrigatório para continuar compras"
    >
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
          aria-label="Fechar aviso"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="pr-8 text-lg font-bold text-neutral-900">
          Faça login para continuar suas compras
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700">
          Faça login para continuar suas compras. Entre na sua conta para
          adicionar produtos ao carrinho e finalizar seu pedido.
        </p>
        {productName && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
            Item selecionado: <strong>{productName}</strong>. Ele será
            adicionado automaticamente ao seu carrinho assim que você entrar.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onGoToLogin}
            className="min-h-[44px] flex-1 cursor-pointer rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-950"
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={onGoToRegister}
            className="min-h-[44px] flex-1 cursor-pointer rounded-lg border border-emerald-900 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            Criar uma conta
          </button>
        </div>
      </div>
    </div>
  );
}
