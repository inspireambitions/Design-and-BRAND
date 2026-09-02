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

  const { data: packs } = await admin
    .from('screening_packs')
    .select('id,expires_at,shortlist_48h_sent_at,shortlist_close_sent_at')
    .or('shortlist_48h_sent_at.is.null,shortlist_close_sent_at.is.null');
  let queued = 0;

  for (const pack of packs ?? []) {
    const { count: submissions } = await admin
      .from('interviews')
      .select('id', { count: 'exact', head: true })
      .eq('screening_pack_id', pack.id)
      .not('submitted_at', 'is', null);
    if (!submissions) continue;

    const { data: firstInvite } = await admin
      .from('role_invites')
      .select('invited_at')
      .eq('role_id', pack.id)
      .not('invited_at', 'is', null)
      .order('invited_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!firstInvite?.invited_at) continue;

    const closed = new Date(pack.expires_at as string).getTime() <= now.getTime();
    const due48 = !pack.shortlist_48h_sent_at
      && now.getTime() - new Date(firstInvite.invited_at as string).getTime() >= SHORTLIST_AFTER_HOURS * HOUR_MS;
    const dueClose = closed && !pack.shortlist_close_sent_at;
    if (!due48 && !dueClose) continue;

    const stamp = dueClose ? { shortlist_close_sent_at: now.toISOString() } : { shortlist_48h_sent_at: now.toISOString() };
    // Stamp first so a concurrent run does not queue twice; the message itself
    // reads live data when it sends.
    const { data: stamped } = await admin
      .from('screening_packs')
      .update(stamp)
      .eq('id', pack.id)
      .is(dueClose ? 'shortlist_close_sent_at' : 'shortlist_48h_sent_at', null)
      .select('id');
    if (!stamped?.length) continue;
    await admin.from('employer_message_outbox').insert({ role_id: pack.id, invite_id: null, kind: 'shortlist', channel: 'email' });
    queued += 1;
  }
  return { queued };
}
