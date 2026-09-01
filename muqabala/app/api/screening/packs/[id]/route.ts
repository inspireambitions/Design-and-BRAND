import { z } from 'zod';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.string().uuid();
const CloseSchema = z.object({ action: z.literal('close') }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const employer = await currentUser();
  if (!employer?.email || !employer.email_confirmed_at) {
    return Response.json({ error: 'Sign in with your verified employer email.' }, { status: 401 });
  }
  const { id: rawId } = await params;
  const id = ParamsSchema.safeParse(rawId);
  const body = CloseSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return Response.json({ error: 'Invalid close request.' }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return Response.json({ error: 'Interview storage is unavailable.' }, { status: 503 });
  const { data: pack, error: readError } = await admin.from('screening_packs')
    .select('id,closed_at')
    .eq('id', id.data)
    .eq('employer_id', employer.id)
    .maybeSingle();
  if (readError) return Response.json({ error: 'The work sample could not be closed.' }, { status: 503 });
  if (!pack) return Response.json({ error: 'Work sample not found.' }, { status: 404 });
  if (pack.closed_at) {
    return Response.json({ closed: true, alreadyClosed: true, closedAt: pack.closed_at }, { headers: privateNoStoreHeaders() });
  }

  const closedAt = new Date().toISOString();
  const { data: closed, error: closeError } = await admin.from('screening_packs')
    .update({ closed_at: closedAt })
    .eq('id', pack.id)
    .eq('employer_id', employer.id)
    .is('closed_at', null)
    .select('closed_at')
    .maybeSingle();
  if (closeError) return Response.json({ error: 'The work sample could not be closed.' }, { status: 503 });
  if (!closed) {
    const { data: concurrent } = await admin.from('screening_packs')
      .select('closed_at').eq('id', pack.id).eq('employer_id', employer.id).maybeSingle();
    if (!concurrent?.closed_at) return Response.json({ error: 'The work sample could not be closed.' }, { status: 503 });
    return Response.json({ closed: true, alreadyClosed: true, closedAt: concurrent.closed_at }, { headers: privateNoStoreHeaders() });
  }
  return Response.json({ closed: true, alreadyClosed: false, closedAt: closed.closed_at }, { headers: privateNoStoreHeaders() });
}

