import { z } from 'zod';
import { employerVolumeEnabled } from '@/lib/employer-volume';
import { hasTrustedOrigin, isOpaqueToken, tokenHash } from '@/lib/server/security';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Schema = z.object({ response: z.enum(['recommend', 'not_this_one']) });

/** Public: the colleague who holds the share link records one response. Later responses replace it. */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!employerVolumeEnabled()) return Response.json({ error: 'Not available.' }, { status: 404 });
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const { token } = await context.params;
  if (!isOpaqueToken(token)) return Response.json({ error: 'Not found.' }, { status: 404 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid response.' }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return Response.json({ configured: false }, { status: 503 });

  const { data } = await admin
    .from('candidate_shares')
    .update({ response: parsed.data.response, responded_at: new Date().toISOString() })
    .eq('token_hash', tokenHash(token))
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('id');
  if (!data?.length) return Response.json({ error: 'This link has closed.' }, { status: 410 });
  return Response.json({ ok: true });
}
