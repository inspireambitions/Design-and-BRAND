import { z } from 'zod';
import { catalogueInterviewRole } from '@/lib/interview-catalogue';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { currentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RequestSchema = z.object({
  jobTitle: z.string().trim().min(2).max(120),
}).strict();

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const employer = await currentUser();
  if (!employer?.email_confirmed_at) return Response.json({ error: 'Sign in to prepare role questions.' }, { status: 401 });
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Enter a valid role title.' }, { status: 400 });

  const role = catalogueInterviewRole(parsed.data.jobTitle);
  return Response.json({
    source: 'reviewed_templates',
    questions: role.questions.slice(0, 8).map((question) => ({
      id: question.id,
      text: question.text,
      textAr: question.textAr,
    })),
  }, { headers: privateNoStoreHeaders() });
}
