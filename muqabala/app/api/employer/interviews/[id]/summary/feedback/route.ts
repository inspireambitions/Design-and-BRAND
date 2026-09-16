import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, currentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const employer = await currentUser();
  if (!employer) return Response.json({ error: 'Sign in to report this summary.' }, { status: 401 });
  const client = await createClient();
  const admin = createAdminClient();
  if (!client || !admin) return Response.json({ error: 'Feedback storage is unavailable.' }, { status: 503 });
  const { id } = await context.params;
  const { data: interview } = await client.from('interviews').select('id,screening_pack_id').eq('id', id).not('submitted_at', 'is', null).maybeSingle();
  if (!interview?.screening_pack_id) return Response.json({ error: 'Interview not found.' }, { status: 404 });
  const { data: role } = await client.from('screening_packs').select('id').eq('id', interview.screening_pack_id).eq('employer_id', employer.id).maybeSingle();
  if (!role) return Response.json({ error: 'Interview not found.' }, { status: 404 });
  const { data: summary } = await client.from('employer_answer_summaries').select('generation_version').eq('interview_id', interview.id).maybeSingle();
  if (!summary) return Response.json({ error: 'Summary not found.' }, { status: 404 });
  const { error } = await admin.from('employer_summary_feedback').upsert({
    interview_id: interview.id,
    role_id: interview.screening_pack_id,
    reported_by: employer.id,
    summary_version: summary.generation_version,
  }, { onConflict: 'interview_id,reported_by,summary_version', ignoreDuplicates: true });
  if (error) return Response.json({ error: 'The report could not be saved.' }, { status: 503 });
  return Response.json({ reported: true }, { headers: privateNoStoreHeaders() });
}
