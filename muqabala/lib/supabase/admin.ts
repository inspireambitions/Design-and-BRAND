import { createClient } from '@supabase/supabase-js';
import { serverSupabaseConfig } from './config';

export function createSupabaseAdminClient() {
  const config = serverSupabaseConfig();
  if (!config) return null;
  return createClient(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
