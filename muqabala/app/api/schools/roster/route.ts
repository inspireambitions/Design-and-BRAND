import { z } from 'zod';
import { schoolsUnavailable } from '@/lib/schools/access';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasTrustedOrigin } from '@/lib/server/security';
import { touchSchoolsSession } from '@/lib/schools/session';
import { newSchoolsSecret, schoolsEmailHash, schoolsInternalEmail, schoolsSecretHash } from '@/lib/schools/access-secrets';
import { parseStudentRosterCsv } from '@/lib/schools/roster-import';

const studentSchema = z.object({
  studentIdentifier: z.string().trim().max(64).optional(),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().optional(),
});

const schema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('preview'),
    csv: z.string().min(1).max(500_000),
  }),
  z.object({
    operation: z.literal('commit'),
    cohortId: z.string().uuid(),
    students: z.array(studentSchema).min(1).max(500),
  }),
]);

export async function POST(request: Request) {
  const unavailable = schoolsUnavailable();
  if (unavailable) return unavailable;
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Request not allowed' }, { status: 403 });

  const client = await createClient();
  if (!client) return Response.json({ error: 'Service unavailable' }, { status: 503 });

  const identity = await touchSchoolsSession(client);
  if (!identity) return Response.json({ error: 'Sign in again' }, { status: 401 });

  const text = await request.text();
  if (text.length > 600_000) return Response.json({ error: 'Payload too large' }, { status: 413 });

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'Check your request data and try again.' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return Response.json({ error: 'Service unavailable' }, { status: 503 });

  if (parsed.data.operation === 'preview') {
    const previewResult = parseStudentRosterCsv(parsed.data.csv);
    return Response.json({ result: previewResult }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Operation: commit
  const { cohortId, students } = parsed.data;

  // Verify educator or admin authorization for this cohort
  const { data: cohort, error: cohortError } = await admin
    .from('schools_cohorts')
    .select('id, institution_id')
    .eq('id', cohortId)
    .maybeSingle();

  if (cohortError || !cohort) {
    return Response.json({ error: 'Cohort not found' }, { status: 404 });
  }

  const { data: isAuth, error: authError } = await admin
    .from('schools_institution_members')
    .select('role')
    .eq('institution_id', cohort.institution_id)
    .eq('user_id', identity.user.id)
    .maybeSingle();

  if (authError || !isAuth) {
    return Response.json({ error: 'Institutional access required' }, { status: 403 });
  }

  const enrolled: { studentIdentifier?: string; name: string; email?: string; enrolmentPath: string }[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const student of students) {
    try {
      const secret = newSchoolsSecret();
      const secretHash = schoolsSecretHash(secret);
      const recipientHash = student.email ? schoolsEmailHash(student.email) : null;
      const mode = student.email ? 'email' : 'pseudonymous';

      const { data: grant, error: grantError } = await admin.rpc('schools_issue_access', {
        actor: identity.user.id,
        cohort: cohortId,
        purpose: 'enrolment',
        mode,
        secret_hash: secretHash,
        recipient_hash: recipientHash,
        student: null,
        student_name: student.name,
        identity_checked: false,
      });

      if (grantError || !grant) {
        failed.push({ name: student.name, error: grantError?.message || 'Could not issue grant' });
        continue;
      }

      if (mode === 'pseudonymous') {
        const generated = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email: schoolsInternalEmail(grant.id),
        });
        if (generated.data?.user) {
          await admin.rpc('schools_bind_pseudonym', {
            actor: identity.user.id,
            grant_id: grant.id,
            student: generated.data.user.id,
          });
        }
      }

      enrolled.push({
        studentIdentifier: student.studentIdentifier,
        name: student.name,
        email: student.email,
        enrolmentPath: `/schools/enrol#${secret}`,
      });
    } catch (err) {
      failed.push({
        name: student.name,
        error: err instanceof Error ? err.message : 'Provisioning failed',
      });
    }
  }

  return Response.json(
    {
      result: {
        enrolledCount: enrolled.length,
        failedCount: failed.length,
        enrolled,
        failed,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export function GET() {
  return schoolsUnavailable() ?? Response.json({ error: 'Not found' }, { status: 404 });
}
