import express, { type NextFunction, type Request, type Response } from 'express';
import { getStoreConfig } from './supabase.ts';
import authRoutes from './routes/auth.ts';
import productsRoutes from './routes/products.ts';
import cartRoutes from './routes/cart.ts';
import cepRoutes from './routes/cep.ts';
import ordersRoutes from './routes/orders.ts';
import reviewsRoutes from './routes/reviews.ts';
import adminRoutes from './routes/admin.ts';
import paymentsRoutes from './routes/payments.ts';
import webhooksRoutes from './routes/webhooks.ts';
import { ensureInitialSuperAdminProvisioned } from './services/superAdminProvisioning.ts';

export function createApiApp() {
  const app = express();
  void ensureInitialSuperAdminProvisioned().catch(() => undefined);

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    const method = req.method.toUpperCase();
    const isMutation =
      method === 'POST' ||
      method === 'PUT' ||
      method === 'PATCH' ||
      method === 'DELETE';

    if (
      isMutation &&
      req.path.startsWith('/api/') &&
      !req.headers.authorization &&
      req.headers.cookie?.includes('agro_session=')
    ) {
      const requestedWith = req.headers['x-requested-with'];
      const origin = req.headers.origin;
      const expectedHost = req.headers['x-forwarded-host'] || req.headers.host;

      let originMatches = false;
      if (typeof origin === 'string' && typeof expectedHost === 'string') {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }

      if (requestedWith !== 'XMLHttpRequest' && !originMatches) {
        res.status(403).json({ error: 'Requisição bloqueada pela proteção CSRF.' });
        return;
      }
    }

    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      ...getStoreConfig(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/cep', cepRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/webhooks', webhooksRoutes);
  app.use('/api/reviews', reviewsRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rota de API não encontrada.' });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err.message?.includes('File too large')) {
      res.status(413).json({ error: 'Arquivo muito grande. O limite máximo é 4MB.' });
      return;
    }
    res.status(500).json({ error: 'Erro interno no servidor.' });
  });

  return app;
}
