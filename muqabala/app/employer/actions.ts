'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, currentUser } from '@/lib/supabase/server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function ownedSubmittedInterview(interviewId: string) {
  const user = await currentUser();
  if (!user || !UUID_PATTERN.test(interviewId)) return null;

  const client = await createClient();
  if (!client) return null;
  const { data } = await client
    .from('interviews')
    .select('id')
    .eq('id', interviewId)
    .not('submitted_at', 'is', null)
    .maybeSingle();

  return data?.id === interviewId ? { interviewId, userId: user.id } : null;
}

export async function reviewInterview(formData: FormData) {
  const interviewId = String(formData.get('interviewId') ?? '');
  const owned = await ownedSubmittedInterview(interviewId);
  if (!owned) redirect('/employer');

  const admin = createAdminClient();
  if (!admin) throw new Error('Employer review storage is not configured.');
  await admin
    .from('interviews')
    .update({ employer_reviewed_at: new Date().toISOString() })
    .eq('id', owned.interviewId)
    .is('employer_reviewed_at', null);

  revalidatePath('/employer');
  redirect(`/employer/interviews/${owned.interviewId}`);
}

export async function setEmployerDecision(formData: FormData) {
  const interviewId = String(formData.get('interviewId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  if (decision !== 'shortlisted' && decision !== 'not_proceeding') return;

  const owned = await ownedSubmittedInterview(interviewId);
  if (!owned) return;

  const admin = createAdminClient();
  if (!admin) throw new Error('Employer decision storage is not configured.');
  const now = new Date().toISOString();
  await admin
    .from('interviews')
    .update({
      employer_reviewed_at: now,
      employer_decision: decision,
      employer_decided_at: now,
    })
    .eq('id', owned.interviewId);

  revalidatePath('/employer');
}
