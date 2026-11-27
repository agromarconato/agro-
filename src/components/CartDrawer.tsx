import { Minus, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatUnitShort } from '../lib/format';
import { ProductImage } from './ProductImage';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onProceedToCheckout: () => void;
  onRequireLogin: () => void;
}

export function CartDrawer({
  open,
  onClose,
  onProceedToCheckout,
  onRequireLogin,
}: CartDrawerProps) {
  const { user, cart, updateCartItemQuantity, removeCartItem } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleQty = async (itemId: string, nextQty: number) => {
    if (nextQty <= 0) return;
    setError(null);
    setBusyId(itemId);
    try {
      await updateCartItemQuantity(itemId, nextQty);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar item.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (itemId: string) => {
    setError(null);
    setBusyId(itemId);
    try {
      await removeCartItem(itemId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover item.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-label="Seu carrinho"
    >
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="text-lg font-bold text-neutral-900">Seu carrinho</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
            aria-label="Fechar carrinho"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!user ? (
            <div className="py-12 text-center">
              <p className="text-sm text-neutral-700">
                Faça login para continuar suas compras. Entre na sua conta para
                adicionar produtos ao carrinho e finalizar seu pedido.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequireLogin();
                }}
                className="mt-5 min-h-[44px] cursor-pointer rounded-lg bg-emerald-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-950"
              >
                Entrar ou criar conta
              </button>
            </div>
          ) : cart.items.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-500">
              Seu carrinho está vazio. Adicione produtos do catálogo para continuar.
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {cart.items.map((item) => {
                const step = item.unitMode === 'kg' ? 0.5 : 1;
                return (
                  <div key={item.id} className="flex gap-4 py-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                      <ProductImage
                        src={item.imageUrl}
                        alt={item.productName}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-neutral-900">
                            {item.productName}
                          </h3>
                          <p className="mt-0.5 font-mono tabular-nums text-xs text-neutral-500">
                            {formatCurrency(item.unitPrice)} /{' '}
                            {formatUnitShort(item.unitMode)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => handleRemove(item.id)}
                          className="cursor-pointer p-1 text-neutral-400 hover:text-red-700"
                          aria-label={`Remover ${item.productName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-lg border border-neutral-200">
                          <button
                            type="button"
                            disabled={
                              busyId === item.id || item.quantity <= step
                            }
                            onClick={() =>
                              handleQty(
                                item.id,
                                Number((item.quantity - step).toFixed(3))
                              )
                            }
                            className="flex h-8 w-8 cursor-pointer items-center justify-center text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                            aria-label="Diminuir quantidade"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[46px] px-2 text-center font-mono tabular-nums text-xs font-medium text-neutral-900">
                            {item.quantity} {formatUnitShort(item.unitMode)}
                          </span>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() =>
                              handleQty(
                                item.id,
                                Number((item.quantity + step).toFixed(3))
                              )
                            }
                            className="flex h-8 w-8 cursor-pointer items-center justify-center text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                            aria-label="Aumentar quantidade"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="font-mono tabular-nums text-sm font-bold text-emerald-950">
                          {formatCurrency(item.lineTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>

        {user && cart.items.length > 0 && (
          <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">Subtotal dos produtos</span>
              <span className="font-mono tabular-nums text-lg font-bold text-emerald-950">
                {formatCurrency(cart.subtotal)}
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Frete calculado na próxima etapa (R$ 4,99 fixo para Irati-PR).
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onProceedToCheckout();
              }}
              className="mt-4 min-h-[46px] w-full cursor-pointer rounded-lg bg-emerald-900 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-950"
            >
              Finalizar compra
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
