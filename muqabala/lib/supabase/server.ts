import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicSupabaseConfig } from './config';

export async function createClient() {
  const config = publicSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // A Server Component cannot write cookies. proxy.ts refreshes them.
        }
      },
    },
  });
}

export async function currentUser() {
  const client = await createClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}
