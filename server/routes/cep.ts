import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import {
  IRATI_SHIPPING_FEE,
  digitsOnly,
  isIratiParana,
} from '../utils/validation.ts';

const router = Router();

const cepRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyPrefix: 'cep',
});

router.get('/:cep', cepRateLimit, async (req, res) => {
  try {
    const cep = digitsOnly(String(req.params.cep || ''));
    if (!/^\d{8}$/.test(cep)) {
      res.status(400).json({ error: 'Informe um CEP válido com 8 dígitos.' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        res.status(502).json({
          error: 'Não foi possível consultar o CEP no momento. Preencha os campos manualmente.',
        });
        return;
      }

      const data = (await response.json()) as {
        erro?: boolean;
        cep?: string;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };

      if (data.erro) {
        res.status(404).json({
          error: 'CEP não encontrado. Você pode preencher o endereço manualmente.',
        });
        return;
      }

      const city = (data.localidade || '').trim();
      const state = (data.uf || '').trim().toUpperCase();
      const isIrati = isIratiParana(city, state);

      res.json({
        cep,
        street: (data.logradouro || '').trim(),
        neighborhood: (data.bairro || '').trim(),
        city,
        state,
        isIrati,
        shippingFee: isIrati ? IRATI_SHIPPING_FEE : null,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    res.status(502).json({
      error: 'Falha ao consultar CEP. Preencha o endereço manualmente.',
    });
  }
});

export default router;
