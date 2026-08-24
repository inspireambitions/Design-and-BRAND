import { interviewAccess } from '@/lib/server/interview-access';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const { id } = await params;
  const access = await interviewAccess(id);
  if (!access.interview || !access.owner) return Response.json({ error: 'Not found.' }, { status: 404 });
  const { error } = await access.admin!.from('interviews')
    .update({ saved: true, expires_at: 'infinity' })
    .eq('id', id).eq('user_id', access.user!.id);
  if (error) return Response.json({ error: 'Report could not be saved.' }, { status: 500 });
  return Response.json({ saved: true }, { headers: privateNoStoreHeaders() });
}
