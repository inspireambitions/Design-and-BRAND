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

/**
 * Signs one recording only when the employer taps play. The report page
 * renders transcript and AI notes without any media request; this keeps the
 * 15 minute signed link out of the initial HTML and off the network until
 * it is wanted.
 */
export async function signEmployerVideo(interviewId: string, questionIndex: number): Promise<{ url: string } | { error: string }> {
  if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 50) return { error: 'This recording is not available.' };
  const owned = await ownedSubmittedInterview(interviewId);
  if (!owned) return { error: 'This recording is not available.' };

  const admin = createAdminClient();
  if (!admin) return { error: 'Employer video storage is not configured.' };
  const { data: answer } = await admin
    .from('interview_answers')
    .select('video_path')
    .eq('interview_id', owned.interviewId)
    .eq('question_index', questionIndex)
    .maybeSingle();
  if (!answer?.video_path) return { error: 'This recording is not available.' };

  const { data } = await admin.storage.from('screening-videos').createSignedUrl(answer.video_path, 15 * 60);
  if (!data?.signedUrl) return { error: 'The recording could not be opened. Try again.' };
  return { url: data.signedUrl };
}

/** Section 3: the Reminders toggle on the role card. Ownership is enforced by RLS on the update. */
export async function setRemindersEnabled(formData: FormData) {
  const roleId = String(formData.get('roleId') ?? '');
  const enabled = String(formData.get('enabled') ?? '') === 'true';
  if (!UUID_PATTERN.test(roleId)) return;
  const client = await createClient();
  if (!client) return;
  await client.from('screening_packs').update({ reminders_enabled: enabled }).eq('id', roleId);
  revalidatePath('/employer');
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
