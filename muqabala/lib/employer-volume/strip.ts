import { employerDecisionLabel } from '../employer-dashboard.ts';
import type { Coverage } from './coverage';

/**
 * Role card number strip and export shaping. Pure so the reconciliation test
 * can assert the five numbers from fixtures.
 */

export type StripInvite = {
  id: string;
  channel: 'email' | 'whatsapp' | 'both';
  status: 'invited' | 'started' | 'submitted' | 'expired';
};

export type StripCandidate = {
  interviewId: string;
  inviteId: string | null;
  coverageFull: boolean;
  reviewedAt: string | null;
  decision: string | null;
};

export type Strip = {
  invited: number;
  answered: number;
  fullCoverage: number;
  shortlisted: number;
  decided: number;
  unreviewed: number;
  openedInReview: number;
};

export const DEFAULT_MINUTES_PER_CV = 4;

export function isShortlisted(decision: string | null): boolean {
  return decision === 'shortlist' || decision === 'shortlisted';
}

export function roleStrip(invites: StripInvite[], candidates: StripCandidate[]): Strip {
  const decided = candidates.filter((candidate) => candidate.decision !== null && candidate.decision !== undefined).length;
  return {
    invited: invites.length,
    answered: candidates.length,
    fullCoverage: candidates.filter((candidate) => candidate.coverageFull).length,
    shortlisted: candidates.filter((candidate) => isShortlisted(candidate.decision)).length,
    decided,
    unreviewed: candidates.filter((candidate) => !candidate.reviewedAt).length,
    openedInReview: candidates.filter((candidate) => Boolean(candidate.reviewedAt)).length,
  };
}

export function actionLabel(strip: Strip): string {
  return strip.unreviewed > 0
    ? `Review ${strip.unreviewed} new ${strip.unreviewed === 1 ? 'answer' : 'answers'}`
    : 'Add candidates';
}

/** (Invited minus candidates opened in review) times minutes per CV, in hours to one decimal. */
export function timeSavedHours(strip: Strip, minutesPerCv: number = DEFAULT_MINUTES_PER_CV): number {
  const minutes = Math.max(0, strip.invited - strip.openedInReview) * Math.max(0, minutesPerCv);
  return Math.round((minutes / 60) * 10) / 10;
}

export function timeSavedLine(strip: Strip, minutesPerCv?: number): string {
  return `Time saved: ${timeSavedHours(strip, minutesPerCv).toFixed(1)} hours`;
}

/** "Email 22 percent. WhatsApp 41 percent." Only shown when WhatsApp is enabled. */
export function responseRateLine(invites: StripInvite[]): string {
  const rate = (channelMatch: (channel: StripInvite['channel']) => boolean) => {
    const pool = invites.filter((invite) => channelMatch(invite.channel));
    if (pool.length === 0) return 0;
    return Math.round((pool.filter((invite) => invite.status === 'submitted').length / pool.length) * 100);
  };
  return `Email ${rate((channel) => channel === 'email' || channel === 'both')} percent. WhatsApp ${rate((channel) => channel === 'whatsapp' || channel === 'both')} percent.`;
}

export type ExportRow = {
  candidate_ref: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  channel: string | null;
  invited_at: string | null;
  first_reminder_at: string | null;
  second_reminder_at: string | null;
  submitted_at: string | null;
  rubric: (boolean | 'Unknown')[];
  decision: string | null;
  reviewer: string | null;
  decided_at: string | null;
  note: string | null;
  share_response: string | null;
  share_responded_at: string | null;
};

export const EXPORT_COLUMNS = [
  'candidate_ref', 'name', 'email', 'phone', 'channel', 'invited_at', 'first_reminder_at', 'second_reminder_at', 'submitted_at',
  'rubric_1', 'rubric_2', 'rubric_3', 'rubric_4', 'decision', 'reviewer', 'decided_at', 'note', 'share_response', 'share_responded_at',
] as const;

function csvCell(value: string | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'boolean' ? String(value) : value;
  // Neutralise spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function exportCsv(rows: ExportRow[]): string {
  const lines = [EXPORT_COLUMNS.join(',')];
  for (const row of rows) {
    const rubric = [0, 1, 2, 3].map((index) => (row.rubric[index] === undefined ? '' : row.rubric[index]));
    lines.push([
      row.candidate_ref, row.name, row.email, row.phone, row.channel, row.invited_at, row.first_reminder_at, row.second_reminder_at, row.submitted_at,
      ...rubric, employerDecisionLabel(row.decision), row.reviewer, row.decided_at, row.note, row.share_response, row.share_responded_at,
    ].map(csvCell).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function exportCandidateSummaryLine(candidate: { displayName: string; coverage: Coverage; decision: string | null }): string {
  const marks = candidate.coverage.items.map((item) => item.status === 'unavailable' ? 'Unknown' : item.covered ? 'Y' : 'N').join(' ');
  return `${candidate.displayName}   rubric ${marks}   ${employerDecisionLabel(candidate.decision) ?? 'No decision yet'}`;
}
