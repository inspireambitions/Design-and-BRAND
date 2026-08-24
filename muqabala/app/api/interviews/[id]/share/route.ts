import { z } from 'zod';
import { limitShare } from '@/lib/rate-limit';
import { interviewAccess } from '@/lib/server/interview-access';
import { configuredOrigin, hasTrustedOrigin, newOpaqueToken, privateNoStoreHeaders, tokenHash } from '@/lib/server/security';

const ShareSchema = z.object({ days: z.number().int().min(1).max(30).default(7) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = ShareSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: 'Invalid expiry.' }, { status: 400 });
  const { id } = await params;
  const access = await interviewAccess(id);
  if (!access.interview || !access.owner) return Response.json({ error: 'Not found.' }, { status: 404 });
  const limited = await limitShare(request, access.user!.id);
  if (limited.limited) {
    return Response.json(
      { error: 'Too many share links requested. Please wait and try again.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }
  const token = newOpaqueToken();
  const expires = new Date(Date.now() + parsed.data.days * 86_400_000).toISOString();
  const { data, error } = await access.admin!.rpc('create_report_share', {
    p_interview_id: id,
    p_user_id: access.user!.id,
    p_token_hash: tokenHash(token),
    p_expires_at: expires,
  });
  if (error) return Response.json({ error: 'Share link could not be created.' }, { status: 500 });
  if (typeof data !== 'string') return Response.json({ error: 'Revoke an active link before creating another.' }, { status: 409 });
  return Response.json(
    { id: data, url: `${configuredOrigin()}/share/${token}`, expiresAt: expires },
    { status: 201, headers: privateNoStoreHeaders() },
  );
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const shareId = new URL(request.url).searchParams.get('shareId');
  if (!shareId || !z.string().uuid().safeParse(shareId).success) return Response.json({ error: 'Invalid share.' }, { status: 400 });
  const { id } = await params;
  const access = await interviewAccess(id);
  if (!access.interview || !access.owner) return Response.json({ error: 'Not found.' }, { status: 404 });
  const { data, error } = await access.admin!.from('report_shares').update({ revoked_at: new Date().toISOString() })
    .eq('id', shareId).eq('interview_id', id).eq('user_id', access.user!.id).is('revoked_at', null)
    .select('id').maybeSingle();
  if (error) return Response.json({ error: 'Share link could not be revoked.' }, { status: 500 });
  if (!data) return Response.json({ error: 'Share link was not found or was already revoked.' }, { status: 404 });
  return Response.json({ revoked: true }, { headers: privateNoStoreHeaders() });
}
