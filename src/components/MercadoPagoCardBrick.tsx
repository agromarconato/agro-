import { loadMercadoPago } from '@mercadopago/sdk-js';
import { Lock } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export interface MercadoPagoCardFormData {
  token: string;
  payment_method_id: string;
  issuer_id?: string | number | null;
  installments?: number;
  payer?: {
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
}

interface MercadoPagoBrickController {
  unmount: () => Promise<void> | void;
}

interface MercadoPagoInstance {
  bricks: () => {
    create: (
      brickType: 'cardPayment',
      containerId: string,
      settings: Record<string, unknown>
    ) => Promise<MercadoPagoBrickController>;
  };
}

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options?: { locale?: string }
    ) => MercadoPagoInstance;
  }
}

interface MercadoPagoCardBrickProps {
  publicKey: string;
  amount: number;
  cardType: 'credit_card' | 'debit_card';
  payerEmail?: string;
  disabled?: boolean;
  onSubmitCard: (data: MercadoPagoCardFormData) => Promise<void>;
}

export function MercadoPagoCardBrick({
  publicKey,
  amount,
  cardType,
  payerEmail,
  disabled = false,
  onSubmitCard,
}: MercadoPagoCardBrickProps) {
  const reactId = useId().replace(/:/g, '');
  const containerId = `mp-card-brick-${cardType}-${reactId}`;
  const controllerRef = useRef<MercadoPagoBrickController | null>(null);
  const submitHandlerRef = useRef(onSubmitCard);
  submitHandlerRef.current = onSubmitCard;

  const [ready, setReady] = useState(false);
  const [brickError, setBrickError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey || disabled || amount <= 0) {
      return;
    }

    let cancelled = false;
    setReady(false);
    setBrickError(null);

    const mountBrick = async () => {
      try {
        await loadMercadoPago();
        if (cancelled) return;

        if (!window.MercadoPago) {
          setBrickError(
            'Não foi possível carregar o formulário seguro do Mercado Pago.'
          );
          return;
        }

        if (controllerRef.current) {
          try {
            await controllerRef.current.unmount();
          } catch {
            // ignora erro ao desmontar instância anterior
          }
          controllerRef.current = null;
        }

        const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
        const bricksBuilder = mp.bricks();

        const excludedTypes =
          cardType === 'credit_card' ? ['debit_card'] : ['credit_card'];

        const controller = await bricksBuilder.create(
          'cardPayment',
          containerId,
          {
            initialization: {
              amount: Number(amount.toFixed(2)),
              ...(payerEmail ? { payer: { email: payerEmail } } : {}),
            },
            customization: {
              paymentMethods: {
                minInstallments: 1,
                maxInstallments: cardType === 'credit_card' ? 12 : 1,
                types: {
                  excluded: excludedTypes,
                },
              },
              visual: {
                texts: {
                  formTitle:
                    cardType === 'credit_card'
                      ? 'Dados do cartão de crédito'
                      : 'Dados do cartão de débito',
                  formSubmit:
                    cardType === 'credit_card'
                      ? 'Pagar com cartão de crédito'
                      : 'Pagar com cartão de débito',
                },
              },
            },
            callbacks: {
              onReady: () => {
                if (!cancelled) setReady(true);
              },
              onSubmit: (formData: MercadoPagoCardFormData) =>
                new Promise<void>((resolve, reject) => {
                  submitHandlerRef
                    .current(formData)
                    .then(() => resolve())
                    .catch(() => reject());
                }),
              onError: (err: unknown) => {
                if (!cancelled) {
                  const message =
                    typeof err === 'object' &&
                    err !== null &&
                    'message' in err &&
                    typeof (err as { message?: unknown }).message === 'string'
                      ? (err as { message: string }).message
                      : 'Verifique os dados informados no formulário seguro.';
                  setBrickError(message);
                }
              },
            },
          }
        );

        if (cancelled) {
          await controller.unmount();
          return;
        }

        controllerRef.current = controller;
      } catch {
        if (!cancelled) {
          setBrickError(
            'Não foi possível inicializar o pagamento seguro com cartão. Tente novamente.'
          );
        }
      }
    };

    mountBrick();

    return () => {
      cancelled = true;
      const current = controllerRef.current;
      controllerRef.current = null;
      if (current) {
        Promise.resolve(current.unmount()).catch(() => undefined);
      }
    };
  }, [publicKey, amount, cardType, payerEmail, disabled, containerId]);

  return (
    <div className="mt-4 rounded-xl border border-emerald-900/20 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-emerald-950">
        <Lock className="h-3.5 w-3.5 text-emerald-800" />
        <span>
          Ambiente criptografado Mercado Pago — os dados do cartão são
          tokenizados diretamente pelo provedor e nunca passam pelo servidor da
          loja.
        </span>
      </div>

      {!ready && !brickError && (
        <p className="py-4 text-center text-xs text-neutral-600">
          Carregando formulário seguro de cartão...
        </p>
      )}

      {brickError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {brickError}
        </p>
      )}

      <div id={containerId} />
    </div>
  );
}
