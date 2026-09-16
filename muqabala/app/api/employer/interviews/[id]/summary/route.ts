import { createHash } from 'node:crypto';
import { z } from 'zod';
import { buildEvidenceLinkedSummary, RECRUITER_SUMMARY_VERSION } from '@/lib/recruiter-suite';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, currentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RequestSchema = z.object({ lang: z.enum(['en', 'ar']).default('en') }).strict();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const employer = await currentUser();
  if (!employer) return Response.json({ error: 'Sign in to generate this summary.' }, { status: 401 });
  const parsed = RequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: 'Invalid summary request.' }, { status: 400 });
  const { id } = await context.params;
  if (!UUID.test(id)) return Response.json({ error: 'Interview not found.' }, { status: 404 });
  const client = await createClient();
  const admin = createAdminClient();
  if (!client || !admin) return Response.json({ error: 'Summary storage is unavailable.' }, { status: 503 });

  const { data: interview } = await client.from('interviews')
    .select('id,screening_pack_id')
    .eq('id', id)
    .not('submitted_at', 'is', null)
    .maybeSingle();
  if (!interview?.screening_pack_id) return Response.json({ error: 'Interview not found.' }, { status: 404 });
  const { data: ownedRole } = await client.from('screening_packs')
    .select('id')
    .eq('id', interview.screening_pack_id)
    .eq('employer_id', employer.id)
    .maybeSingle();
  if (!ownedRole) return Response.json({ error: 'Interview not found.' }, { status: 404 });

  const { data: rows, error: answerError } = await client.from('interview_answers')
    .select('question_index,transcript,updated_at')
    .eq('interview_id', interview.id)
    .order('question_index');
  if (answerError) return Response.json({ error: 'The submitted answers could not be loaded.' }, { status: 503 });
  const answers = (rows ?? []).map((row) => ({
    questionIndex: Number(row.question_index),
    transcript: String(row.transcript || ''),
    updatedAt: String(row.updated_at || ''),
  }));
  const generationVersion = `${RECRUITER_SUMMARY_VERSION}-${parsed.data.lang}`;
  const sourceVersion = createHash('sha256').update(JSON.stringify(answers)).digest('hex');
  const { data: cached } = await client.from('employer_answer_summaries')
    .select('source_version,generation_version,summary_points,source_references,generated_at')
    .eq('interview_id', interview.id)
    .maybeSingle();
  if (cached?.source_version === sourceVersion && cached.generation_version === generationVersion) {
    return Response.json({
      points: cached.summary_points,
      sourceReferences: cached.source_references,
      generationVersion: cached.generation_version,
      generatedAt: cached.generated_at,
      cached: true,
    }, { headers: privateNoStoreHeaders() });
  }

  const points = buildEvidenceLinkedSummary(answers, parsed.data.lang);
  if (points.length === 0) return Response.json({ points: [], unavailable: true }, { headers: privateNoStoreHeaders() });
  const sourceReferences = points.map((point) => ({ questionIndex: point.questionIndex, sourceLabel: point.sourceLabel }));
  const generatedAt = new Date().toISOString();
  const { error } = await admin.from('employer_answer_summaries').upsert({
    interview_id: interview.id,
    role_id: interview.screening_pack_id,
    source_version: sourceVersion,
    generation_version: generationVersion,
    summary_points: points,
    source_references: sourceReferences,
    generated_at: generatedAt,
  }, { onConflict: 'interview_id' });
  if (error) return Response.json({ error: 'The answer summary could not be saved.' }, { status: 503 });
  return Response.json({ points, sourceReferences, generationVersion, generatedAt, cached: false }, { status: 201, headers: privateNoStoreHeaders() });
}
