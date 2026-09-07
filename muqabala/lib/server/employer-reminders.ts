import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { dueReminder, type InviteForReminder, type RoleForReminder } from '@/lib/employer-volume/reminders';

type InviteRow = InviteForReminder & { id: string; role_id: string; email: string | null };

/**
 * Hourly: expire invites for closed roles, then queue any reminder that is due.
 * Queueing is idempotent through the outbox unique index on (invite, kind, channel).
 */
export async function scheduleEmployerReminders(now = new Date()) {
  const admin = createAdminClient();
  if (!admin) return { configured: false, expired: 0, queued: 0 };

  const nowIso = now.toISOString();
  const { data: closedRoles, error: closedError } = await admin
    .from('screening_packs')
    .select('id')
    .lte('expires_at', nowIso);
  if (closedError) throw new Error('reminder_roles_unavailable');
  const closedIds = (closedRoles ?? []).map((row) => row.id as string);
  let expired = 0;
  if (closedIds.length) {
    const { data, error } = await admin
      .from('role_invites')
      .update({ status: 'expired' })
      .in('role_id', closedIds)
      .in('status', ['invited', 'started'])
      .select('id');
    if (error) throw new Error('invite_expiry_failed');
    expired = data?.length ?? 0;
  }

  const { data: candidates, error: candidateError } = await admin
    .from('role_invites')
    .select('id,role_id,email,status,invited_at,first_reminder_at,second_reminder_at,completion_reminder_at,started_at')
    .in('status', ['invited', 'started'])
    .not('invited_at', 'is', null)
    .limit(2000);
  if (candidateError) throw new Error('reminder_candidates_unavailable');
  const invites = (candidates ?? []) as (Omit<InviteRow, 'last_activity_at'>)[];
  if (invites.length === 0) return { configured: true, expired, queued: 0 };

  const roleIds = Array.from(new Set(invites.map((invite) => invite.role_id)));
  const { data: roleRows, error: roleError } = await admin
    .from('screening_packs')
    .select('id,expires_at,reminders_enabled')
    .in('id', roleIds);
  if (roleError) throw new Error('reminder_roles_unavailable');
  const roles = new Map<string, RoleForReminder>();
  for (const row of roleRows ?? []) roles.set(row.id as string, { expires_at: row.expires_at as string, reminders_enabled: Boolean(row.reminders_enabled) });

  const startedIds = invites.filter((invite) => invite.status === 'started').map((invite) => invite.id);
  const activity = new Map<string, string>();
  if (startedIds.length) {
    const { data: interviews, error: activityError } = await admin
      .from('interviews')
      .select('invite_id,updated_at')
      .in('invite_id', startedIds);
    if (activityError) throw new Error('reminder_activity_unavailable');
    for (const row of interviews ?? []) if (row.invite_id) activity.set(row.invite_id as string, row.updated_at as string);
  }

  const outbox: { role_id: string; invite_id: string; kind: 'reminder_1' | 'reminder_2' | 'completion'; channel: 'email' }[] = [];
  for (const invite of invites) {
    const role = roles.get(invite.role_id);
    if (!role || !invite.email) continue;
    const kind = dueReminder({ ...invite, last_activity_at: activity.get(invite.id) ?? invite.started_at }, role, now);
    if (kind) outbox.push({ role_id: invite.role_id, invite_id: invite.id, kind, channel: 'email' });
  }
  if (outbox.length === 0) return { configured: true, expired, queued: 0 };

  const { data: queued, error } = await admin.rpc('queue_employer_reminders', { p_rows: outbox });
  if (error) throw new Error('reminder_queue_failed');
  return { configured: true, expired, queued: Number(queued ?? 0) };
}
