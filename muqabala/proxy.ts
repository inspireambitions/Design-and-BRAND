import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { publicSupabaseConfig } from '@/lib/supabase/config';

export async function proxy(request: NextRequest) {
  const config = publicSupabaseConfig();
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresh expired tokens. Authorisation still happens in each route and in RLS.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/reports/:path*', '/auth/:path*', '/api/reports/:path*'],
};
