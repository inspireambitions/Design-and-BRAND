/**
 * Reminder scheduling for invites. Pure so it can be tested with a fixed clock.
 *
 * Rules from the brief:
 * - status invited: reminder 1 at 48 hours after invited_at, reminder 2 at 120 hours
 * - status started with no activity for 24 hours: one completion reminder
 * - never more than three messages per invite (the invite itself counts as one)
 * - nothing once the role has closed or reminders are switched off
 */

export const HOUR_MS = 60 * 60 * 1000;
export const FIRST_REMINDER_HOURS = 48;
export const SECOND_REMINDER_HOURS = 120;
export const COMPLETION_REMINDER_HOURS = 24;
export const MAX_MESSAGES_PER_INVITE = 3;

export type ReminderKind = 'reminder_1' | 'reminder_2' | 'completion';

export type InviteForReminder = {
  status: 'invited' | 'started' | 'submitted' | 'expired';
  invited_at: string | null;
  first_reminder_at: string | null;
  second_reminder_at: string | null;
  completion_reminder_at: string | null;
  started_at: string | null;
  /** Most recent candidate activity while started: an answer save or the start itself. */
  last_activity_at: string | null;
};

export type RoleForReminder = {
  expires_at: string;
  reminders_enabled: boolean;
};

export function messagesSent(invite: InviteForReminder): number {
  return [invite.invited_at, invite.first_reminder_at, invite.second_reminder_at, invite.completion_reminder_at]
    .filter(Boolean).length;
}

/** Which reminder, if any, is due right now. Returns at most one kind. */
export function dueReminder(invite: InviteForReminder, role: RoleForReminder, now: Date): ReminderKind | null {
  if (!role.reminders_enabled) return null;
  if (new Date(role.expires_at).getTime() <= now.getTime()) return null;
  if (messagesSent(invite) >= MAX_MESSAGES_PER_INVITE) return null;
  if (!invite.invited_at) return null;

  const invitedAt = new Date(invite.invited_at).getTime();
  const hoursSinceInvite = (now.getTime() - invitedAt) / HOUR_MS;

  if (invite.status === 'invited') {
    if (!invite.first_reminder_at && hoursSinceInvite >= FIRST_REMINDER_HOURS) return 'reminder_1';
    if (invite.first_reminder_at && !invite.second_reminder_at && hoursSinceInvite >= SECOND_REMINDER_HOURS) return 'reminder_2';
    return null;
  }

  if (invite.status === 'started') {
    if (invite.completion_reminder_at) return null;
    const activity = invite.last_activity_at ?? invite.started_at;
    if (!activity) return null;
    const idleHours = (now.getTime() - new Date(activity).getTime()) / HOUR_MS;
    return idleHours >= COMPLETION_REMINDER_HOURS ? 'completion' : null;
  }

  return null;
}

/** "Reminded 112. 19 more answered." */
export function reminderOutcome(invites: Pick<InviteForReminder, 'first_reminder_at' | 'second_reminder_at' | 'completion_reminder_at'>[] & { submitted_at?: string | null }[]) {
  let reminded = 0;
  let answeredAfter = 0;
  for (const invite of invites) {
    const firstReminder = [invite.first_reminder_at, invite.second_reminder_at, invite.completion_reminder_at]
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .sort((a, b) => a - b)[0];
    if (firstReminder === undefined) continue;
    reminded += 1;
    if (invite.submitted_at && new Date(invite.submitted_at).getTime() > firstReminder) answeredAfter += 1;
  }
  return { reminded, answeredAfter };
}

export function reminderOutcomeLine(outcome: { reminded: number; answeredAfter: number }): string {
  return `Reminded ${outcome.reminded}. ${outcome.answeredAfter} more answered.`;
}
