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

export function getStoreConfig() {
  return {
    storeName: getEnv('STORE_NAME') || getEnv('VITE_STORE_NAME') || 'AgroMarconato',
    storeDescription:
      getEnv('VITE_STORE_DESCRIPTION') ||
      'Nutrição animal, rações selecionadas e itens agropecuários com atendimento próximo e entrega rápida em Irati e região.',
    whatsappNumber:
      getEnv('WHATSAPP_NUMBER') ||
      getEnv('VITE_WHATSAPP_NUMBER') ||
      '+55 42 98809-3611',
    paymentConfigured: Boolean(getEnv('PAYMENT_PROVIDER_SECRET_KEY')),
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
