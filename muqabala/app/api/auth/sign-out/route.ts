import { hasTrustedOrigin } from '@/lib/server/security';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const client = await createClient();
  if (client) await client.auth.signOut();
  return Response.json({ signedOut: true });
}
