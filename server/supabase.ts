import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedAdminClient: SupabaseClient | null = null;

export function getEnv(name: string): string {
  return (process.env[name] || '').trim();
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    getEnv('SUPABASE_URL') &&
      getEnv('SUPABASE_ANON_KEY') &&
      getEnv('SUPABASE_SERVICE_ROLE_KEY')
  );
}

export function getMercadoPagoConfig() {
  const accessToken =
    getEnv('MP_ACCESS_TOKEN') || getEnv('PAYMENT_PROVIDER_SECRET_KEY');
  const publicKey = getEnv('VITE_MP_PUBLIC_KEY');
  const webhookSecret = getEnv('MP_WEBHOOK_SECRET');
  const onlineCardConfigured = Boolean(
    accessToken && publicKey && webhookSecret
  );

  return {
    accessToken,
    publicKey,
    webhookSecret,
    onlineCardConfigured,
    pixConfigured: Boolean(accessToken),
  };
}

export function getStoreConfig() {
  const mp = getMercadoPagoConfig();
  return {
    storeName: getEnv('VITE_STORE_NAME') || 'AgroMarconato',
    storeDescription:
      getEnv('VITE_STORE_DESCRIPTION') ||
      'A Agro Marconato é uma loja de produtos agropecuários, artigos para pets e ponto de coleta e envio do Mercado Livre localizada em Irati, PR.',
    whatsappNumber: getEnv('VITE_WHATSAPP_NUMBER') || '+55 42 98809-3611',
    paymentConfigured: mp.onlineCardConfigured,
    onlineCardConfigured: mp.onlineCardConfigured,
    mpPublicKey: mp.onlineCardConfigured ? mp.publicKey : '',
    paymentProvider: mp.onlineCardConfigured ? 'mercadopago' : null,
    supabaseConfigured: isSupabaseConfigured(),
  };
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = getEnv('SUPABASE_URL');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  if (!cachedAdminClient) {
    cachedAdminClient = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return cachedAdminClient;
}

export function createSupabaseAnonClient(): SupabaseClient {
  const url = getEnv('SUPABASE_URL');
  const anonKey = getEnv('SUPABASE_ANON_KEY');

  if (!url || !anonKey) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
