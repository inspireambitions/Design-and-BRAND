'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { configuredOrigin, newOpaqueToken, tokenHash } from '@/lib/server/security';
import { generateCandidateEvaluationReport, loadOwnedEvaluationReport, recordEvaluationAccess } from '@/lib/server/evaluation-report';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';

const UUID = z.string().uuid();
const ShareInput = z.object({ interviewId: UUID, days: z.number().int().min(1).max(30) }).strict();

function userName(user: NonNullable<Awaited<ReturnType<typeof currentUser>>>): string {
  const value = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name;
  if (typeof value === 'string' && value.trim()) return value.replace(/\s+/g, ' ').trim().slice(0, 100);
  return user.email?.split('@')[0]?.replace(/[._-]+/g, ' ').slice(0, 100) || 'Employer';
}

export async function addEvaluationNote(input: { interviewId: string; text: string }): Promise<{ ok: true } | { error: string }> {
  const parsed = z.object({ interviewId: UUID, text: z.string().trim().min(1).max(1000) }).strict().safeParse(input);
  if (!parsed.success) return { error: 'Enter a note of 1,000 characters or fewer.' };
  const user = await currentUser();
  if (!user) return { error: 'Sign in again to add a note.' };
  const current = await loadOwnedEvaluationReport(parsed.data.interviewId, user.id);
  if (!current) return { error: 'This evaluation is not available.' };
  const admin = createAdminClient();
  if (!admin) return { error: 'Note storage is not configured.' };
  const { error } = await admin.from('evaluation_report_notes').insert({
    report_id: current.databaseId,
    author_id: user.id,
    author_name: userName(user),
    note_text: parsed.data.text.replace(/\s+/g, ' ').trim(),
  });
  if (error) return { error: 'The note could not be added. Try again.' };
  revalidatePath(`/employer/candidates/${parsed.data.interviewId}/evaluation`);
  return { ok: true };
}

export async function createEvaluationShare(input: { interviewId: string; days: number }): Promise<{ url: string; id: string; expiresAt: string } | { error: string }> {
  const parsed = ShareInput.safeParse(input);
  if (!parsed.success) return { error: 'Choose between 1 and 30 days.' };
  const user = await currentUser();
  if (!user) return { error: 'Sign in again to share this evaluation.' };
  const current = await loadOwnedEvaluationReport(parsed.data.interviewId, user.id);
  if (!current) return { error: 'This evaluation is not available.' };
  if (!current.report.decision) return { error: 'Record a decision before sharing.' };
  const admin = createAdminClient();
  if (!admin) return { error: 'Sharing is not configured.' };
  const token = newOpaqueToken();
  const expiresAt = new Date(Date.now() + parsed.data.days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin.from('evaluation_report_shares').insert({
    report_id: current.databaseId,
    token_hash: tokenHash(token),
    created_by: user.id,
    expires_at: expiresAt,
  }).select('id').single();
  if (error || !data) return { error: 'The share link could not be created.' };
  await recordEvaluationAccess({
    reportDatabaseId: current.databaseId,
    reportVersion: current.report.report_version,
    action: 'SHARE_CREATED',
    actorUserId: user.id,
  });
  revalidatePath(`/employer/candidates/${parsed.data.interviewId}/evaluation`);
  return { url: `${configuredOrigin()}/evaluation-share/${token}`, id: data.id, expiresAt };
}

export async function revokeEvaluationShare(input: { interviewId: string; shareId: string }): Promise<{ ok: true } | { error: string }> {
  const parsed = z.object({ interviewId: UUID, shareId: UUID }).strict().safeParse(input);
  if (!parsed.success) return { error: 'Share not found.' };
  const user = await currentUser();
  if (!user) return { error: 'Sign in again to close this link.' };
  const current = await loadOwnedEvaluationReport(parsed.data.interviewId, user.id);
  if (!current) return { error: 'This evaluation is not available.' };
  const admin = createAdminClient();
  if (!admin) return { error: 'Sharing is not configured.' };
  const { data, error } = await admin.from('evaluation_report_shares').update({ revoked_at: new Date().toISOString() })
    .eq('id', parsed.data.shareId)
    .eq('report_id', current.databaseId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (error || !data) return { error: 'This link is already closed.' };
  await recordEvaluationAccess({
    reportDatabaseId: current.databaseId,
    reportVersion: current.report.report_version,
    action: 'SHARE_REVOKED',
    actorUserId: user.id,
  });
  revalidatePath(`/employer/candidates/${parsed.data.interviewId}/evaluation`);
  return { ok: true };
}

export async function regenerateEvaluationReport(interviewId: string): Promise<{ version: number } | { error: string }> {
  const parsed = UUID.safeParse(interviewId);
  if (!parsed.success) return { error: 'This evaluation is not available.' };
  const user = await currentUser();
  if (!user) return { error: 'Sign in again to create a new version.' };
  const current = await loadOwnedEvaluationReport(interviewId, user.id);
  if (!current) return { error: 'This evaluation is not available.' };
  const report = await generateCandidateEvaluationReport(interviewId, { force: true, generatedBy: user.id });
  if (!report || report.report_version <= current.report.report_version) return { error: 'A new version could not be created.' };
  revalidatePath(`/employer/candidates/${interviewId}/evaluation`);
  return { version: report.report_version };
}
