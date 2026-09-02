'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { configuredOrigin, newOpaqueToken, tokenHash } from '@/lib/server/security';
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

type VolumeDecision = 'shortlist' | 'pass' | 'later';

async function ownedSubmittedInterviewWithRole(interviewId: string) {
  const user = await currentUser();
  if (!user || !UUID_PATTERN.test(interviewId)) return null;
  const client = await createClient();
  if (!client) return null;
  const { data } = await client
    .from('interviews')
    .select('id,screening_pack_id,invite_id')
    .eq('id', interviewId)
    .not('submitted_at', 'is', null)
    .maybeSingle();
  if (!data || data.id !== interviewId || !data.screening_pack_id) return null;
  return { interviewId, roleId: data.screening_pack_id as string, inviteId: (data.invite_id as string | null) ?? null, userId: user.id };
}

/**
 * Section 4: one decision per tap, written to the log with reviewer, time and
 * note, and mirrored onto the legacy column so existing counts keep working.
 * Returns the log row id so the client can offer a 10 second undo.
 */
export async function recordDecision(input: { interviewId: string; decision: VolumeDecision; note?: string }): Promise<{ id: string } | { error: string }> {
  if (!['shortlist', 'pass', 'later'].includes(input.decision)) return { error: 'Unknown decision.' };
  const owned = await ownedSubmittedInterviewWithRole(input.interviewId);
  if (!owned) return { error: 'This candidate is not available.' };
  const admin = createAdminClient();
  if (!admin) return { error: 'Decision storage is not configured.' };
  const note = input.note?.replace(/\s+/g, ' ').trim().slice(0, 280) || null;
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('employer_decisions')
    .insert({ interview_id: owned.interviewId, role_id: owned.roleId, reviewer_id: owned.userId, decision: input.decision, note })
    .select('id')
    .single();
  if (error || !data) return { error: 'The decision could not be saved.' };
  await admin
    .from('interviews')
    .update({ employer_reviewed_at: now, employer_decision: input.decision, employer_decided_at: now })
    .eq('id', owned.interviewId);
  revalidatePath('/employer');
  return { id: data.id as string };
}

/** Undo deletes the log row and restores the previous decision, if any, on the legacy column. */
export async function undoDecision(input: { interviewId: string; decisionId: string }): Promise<{ ok: true } | { error: string }> {
  if (!UUID_PATTERN.test(input.decisionId)) return { error: 'Nothing to undo.' };
  const owned = await ownedSubmittedInterviewWithRole(input.interviewId);
  if (!owned) return { error: 'This candidate is not available.' };
  const admin = createAdminClient();
  if (!admin) return { error: 'Decision storage is not configured.' };
  const { data: removed } = await admin
    .from('employer_decisions')
    .delete()
    .eq('id', input.decisionId)
    .eq('interview_id', owned.interviewId)
    .eq('reviewer_id', owned.userId)
    .select('id');
  if (!removed?.length) return { error: 'Nothing to undo.' };
  const { data: previous } = await admin
    .from('employer_decisions')
    .select('decision,created_at')
    .eq('interview_id', owned.interviewId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  await admin
    .from('interviews')
    .update({ employer_decision: previous?.decision ?? null, employer_decided_at: previous?.created_at ?? null })
    .eq('id', owned.interviewId);
  revalidatePath('/employer');
  return { ok: true };
}

/** Creates a 7 day public share link for one candidate. Contact details never appear on the shared page. */
export async function createCandidateShare(interviewId: string): Promise<{ url: string; expiresAt: string } | { error: string }> {
  const owned = await ownedSubmittedInterviewWithRole(interviewId);
  if (!owned) return { error: 'This candidate is not available.' };
  const admin = createAdminClient();
  if (!admin) return { error: 'Sharing is not configured.' };
  const token = newOpaqueToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin.from('candidate_shares').insert({
    role_id: owned.roleId,
    interview_id: owned.interviewId,
    invite_id: owned.inviteId,
    token_hash: tokenHash(token),
    created_by: owned.userId,
    expires_at: expiresAt,
  });
  if (error) return { error: 'The share link could not be created.' };
  return { url: `${configuredOrigin()}/c/${token}`, expiresAt };
}

export async function revokeCandidateShare(input: { interviewId: string; shareId: string }): Promise<{ ok: true } | { error: string }> {
  if (!UUID_PATTERN.test(input.shareId)) return { error: 'Share not found.' };
  const owned = await ownedSubmittedInterviewWithRole(input.interviewId);
  if (!owned) return { error: 'This candidate is not available.' };
  const admin = createAdminClient();
  if (!admin) return { error: 'Sharing is not configured.' };
  await admin
    .from('candidate_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', input.shareId)
    .eq('interview_id', owned.interviewId)
    .is('revoked_at', null);
  revalidatePath(`/employer/interviews/${owned.interviewId}`);
  return { ok: true };
}

/** Section 5: inline edit of the minutes-per-CV figure behind "Time saved". */
export async function setMinutesPerCv(formData: FormData) {
  const roleId = String(formData.get('roleId') ?? '');
  const minutes = Number(formData.get('minutes'));
  if (!UUID_PATTERN.test(roleId) || !Number.isInteger(minutes) || minutes < 0 || minutes > 120) return;
  const client = await createClient();
  if (!client) return;
  await client.from('screening_packs').update({ minutes_per_cv: minutes }).eq('id', roleId);
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
