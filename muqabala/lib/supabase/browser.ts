'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicSupabaseConfig } from './config';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createBrowserSupabaseClient() {
  const config = publicSupabaseConfig();
  if (!config) return null;
  browserClient ??= createBrowserClient(config.url, config.key);
  return browserClient;
}
