import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { HOUR_MS } from '@/lib/employer-volume/reminders';

const SHORTLIST_AFTER_HOURS = 48;

/**
 * Queues the shortlist email twice per role: 48 hours after the first invite
 * batch, and again when the role closes. Only when at least one submission
 * exists. The outbox row has no invite, so the pack columns are the guard.
 */
export async function scheduleShortlistEmails(now = new Date()): Promise<{ queued: number }> {
  const admin = createAdminClient();
  if (!admin) return { queued: 0 };

  const { data: packs, error: packError } = await admin
    .from('screening_packs')
    .select('id,expires_at,shortlist_48h_sent_at,shortlist_close_sent_at')
    .or('shortlist_48h_sent_at.is.null,shortlist_close_sent_at.is.null');
  if (packError) throw new Error('shortlist_roles_unavailable');
  let queued = 0;

  for (const pack of packs ?? []) {
    const { count: submissions, error: submissionError } = await admin
      .from('interviews')
      .select('id', { count: 'exact', head: true })
      .eq('screening_pack_id', pack.id)
      .not('submitted_at', 'is', null);
    if (submissionError) throw new Error('shortlist_submissions_unavailable');
    if (!submissions) continue;

    const { data: firstInvite, error: inviteError } = await admin
      .from('role_invites')
      .select('invited_at')
      .eq('role_id', pack.id)
      .not('invited_at', 'is', null)
      .order('invited_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (inviteError) throw new Error('shortlist_invites_unavailable');
    if (!firstInvite?.invited_at) continue;

    const closed = new Date(pack.expires_at as string).getTime() <= now.getTime();
    const due48 = !closed && !pack.shortlist_48h_sent_at
      && now.getTime() - new Date(firstInvite.invited_at as string).getTime() >= SHORTLIST_AFTER_HOURS * HOUR_MS;
    const dueClose = closed && !pack.shortlist_close_sent_at;
    if (!due48 && !dueClose) continue;

    const { data, error } = await admin.rpc('queue_employer_shortlist', {
      p_role_id: pack.id, p_kind: dueClose ? 'close' : '48h',
    });
    if (error) throw new Error('shortlist_queue_failed');
    queued += Number(data ?? 0);
  }
  return { queued };
}
