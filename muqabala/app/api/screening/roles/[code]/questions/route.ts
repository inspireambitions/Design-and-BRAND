import { createHash } from 'node:crypto';
import { z } from 'zod';
import { verifyStoredInterview } from '@/lib/interview-token';
import { answerCandidateRoleQuestion, type CandidateFactIntent, type PublishedRoleFacts } from '@/lib/recruiter-suite';
import { limitRoleQuestion } from '@/lib/rate-limit';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CODE = /^[A-Za-z0-9_-]{6,16}$/;
const QuestionSchema = z.object({
  question: z.string().trim().min(4).max(500),
  lang: z.enum(['en', 'ar']).default('en'),
  intent: z.enum(['deadline', 'format', 'location', 'salary', 'accommodation', 'interview']).optional(),
  escalate: z.boolean().default(false),
}).strict();

async function loadRole(code: string) {
  if (!CODE.test(code)) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from('screening_packs')
    .select('id,employer_id,workplace,signed_token,location,timezone,published_facts,expires_at')
    .eq('public_code', code)
    .not('employer_id', 'is', null)
    .maybeSingle();
  if (!data?.employer_id) return null;
  if (Date.parse(data.expires_at) <= Date.now()) return null;
  const payload = verifyStoredInterview(data.signed_token);
  if (!payload || payload.kind !== 'proof') return null;
  const published = (data.published_facts && typeof data.published_facts === 'object' ? data.published_facts : {}) as Record<string, unknown>;
  const facts: PublishedRoleFacts = {
    roleTitle: payload.title,
    workplace: data.workplace || 'Employer',
    location: typeof data.location === 'string' ? data.location : null,
    timezone: typeof data.timezone === 'string' ? data.timezone : 'Asia/Dubai',
    expiresAt: data.expires_at,
    questionCount: payload.questions.length,
    salary: typeof published.salary === 'string' ? published.salary : null,
    accommodation: typeof published.accommodation === 'string' ? published.accommodation : null,
    interviewDetails: typeof published.interviewDetails === 'string' ? published.interviewDetails : null,
    faqs: Array.isArray(published.faqs)
      ? published.faqs.filter((item): item is { question: string; answer: string } => Boolean(item && typeof item.question === 'string' && typeof item.answer === 'string')).slice(0, 20)
      : [],
  };
  return { admin, pack: data, facts };
}

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const candidate = await currentUser();
  if (!candidate) return Response.json({ error: 'Sign in to view your role questions.' }, { status: 401 });
  const { code } = await context.params;
  const loaded = await loadRole(code);
  if (!loaded) return Response.json({ error: 'Role not found.' }, { status: 404 });
  const { data, error } = await loaded.admin.from('candidate_role_questions')
    .select('id,question_text,reply_text,replied_at,resolved_at,created_at')
    .eq('role_id', loaded.pack.id)
    .eq('candidate_id', candidate.id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return Response.json({ error: 'Your questions could not be loaded.' }, { status: 503 });
  return Response.json({ questions: data ?? [] }, { headers: privateNoStoreHeaders() });
}

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const candidate = await currentUser();
  if (!candidate?.email || !candidate.email_confirmed_at) return Response.json({ error: 'Sign in to ask about this role.' }, { status: 401 });
  const limited = await limitRoleQuestion(request, candidate.id);
  if (limited.limited) return Response.json({ error: 'Please wait before asking another question.' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } });
  const parsed = QuestionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Enter a shorter question.' }, { status: 400 });
  const { code } = await context.params;
  const loaded = await loadRole(code);
  if (!loaded) return Response.json({ error: 'Role not found.' }, { status: 404 });

  const factAnswer = answerCandidateRoleQuestion(parsed.data.question, loaded.facts, parsed.data.lang, parsed.data.intent as CandidateFactIntent | undefined);
  if (!parsed.data.escalate) {
    return Response.json({
      ...factAnswer,
      sourceHref: factAnswer.sourceId ? `/s/${code}#${factAnswer.sourceId}` : null,
      canEscalate: !factAnswer.supported,
    }, { headers: privateNoStoreHeaders() });
  }

  const normalised = parsed.data.question.replace(/\s+/g, ' ').trim();
  const questionHash = createHash('sha256').update(normalised.toLocaleLowerCase()).digest('hex');
  const { data, error } = await loaded.admin.from('candidate_role_questions').insert({
    role_id: loaded.pack.id,
    candidate_id: candidate.id,
    candidate_email: candidate.email.toLowerCase(),
    question_text: normalised,
    question_hash: questionHash,
    answer_already_shown: factAnswer.answer,
  }).select('id,created_at').single();
  if (error?.code === '23505') return Response.json({ queued: true, duplicate: true }, { headers: privateNoStoreHeaders() });
  if (error || !data) return Response.json({ error: 'Your question could not be sent. Try again.' }, { status: 503 });
  await loaded.admin.from('recruiter_audit_events').insert({
    actor_id: candidate.id,
    employer_id: loaded.pack.employer_id,
    role_id: loaded.pack.id,
    record_type: 'candidate_question',
    record_id: data.id,
    action: 'question_escalated',
    result: 'succeeded',
    metadata: { answer_supported: factAnswer.supported },
  });
  return Response.json({ queued: true, id: data.id, createdAt: data.created_at }, { status: 201, headers: privateNoStoreHeaders() });
}
