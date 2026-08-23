import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicSupabaseConfig } from './config';

export async function createServerSupabaseClient() {
  const config = publicSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();

  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // A Server Component cannot write cookies. The proxy refreshes them.
        }
      },
    },
  });
}
