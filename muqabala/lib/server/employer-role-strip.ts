import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { roleStrip, type ExportRow, type Strip, type StripInvite } from '@/lib/employer-volume/strip';
import { rankedCandidates, type RankedCandidate } from '@/lib/server/employer-candidates';

export type RoleStripData = {
  strip: Strip;
  invites: StripInvite[];
  candidates: RankedCandidate[];
};

export async function loadRoleStrip(client: SupabaseClient, roleId: string): Promise<RoleStripData> {
  const [{ data: inviteRows }, candidates] = await Promise.all([
    client.from('role_invites').select('id,channel,status').eq('role_id', roleId),
    rankedCandidates(client, roleId),
  ]);
  const invites = (inviteRows ?? []) as StripInvite[];
  const strip = roleStrip(invites, candidates.map((candidate) => ({
    interviewId: candidate.interviewId,
    inviteId: candidate.inviteId,
    coverageFull: candidate.coverage.full,
    reviewedAt: candidate.reviewedAt,
    decision: candidate.decision,
  })));
  return { strip, invites, candidates };
}

type InviteDetail = {
  id: string;
  candidate_ref: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  channel: string;
  invited_at: string | null;
  first_reminder_at: string | null;
  second_reminder_at: string | null;
  submitted_at: string | null;
};

/** Full export rows: one per invite, joined to the interview, latest decision and latest share response. */
export async function loadExportRows(client: SupabaseClient, roleId: string, reviewerEmails: Map<string, string>): Promise<ExportRow[]> {
  const [{ data: inviteRows }, candidates, { data: decisionRows }, { data: shareRows }] = await Promise.all([
    client.from('role_invites').select('id,candidate_ref,name,email,phone,channel,invited_at,first_reminder_at,second_reminder_at,submitted_at').eq('role_id', roleId).order('created_at'),
    rankedCandidates(client, roleId),
    client.from('employer_decisions').select('interview_id,reviewer_id,decision,note,created_at').eq('role_id', roleId).order('created_at', { ascending: false }),
    client.from('candidate_shares').select('interview_id,response,responded_at').eq('role_id', roleId).not('response', 'is', null).order('responded_at', { ascending: false }),
  ]);

  const latestDecision = new Map<string, { reviewer_id: string; decision: string; note: string | null; created_at: string }>();
  for (const row of decisionRows ?? []) if (!latestDecision.has(row.interview_id)) latestDecision.set(row.interview_id, row);
  const latestShare = new Map<string, { response: string; responded_at: string }>();
  for (const row of shareRows ?? []) if (!latestShare.has(row.interview_id)) latestShare.set(row.interview_id, row);
  const byInvite = new Map(candidates.filter((candidate) => candidate.inviteId).map((candidate) => [candidate.inviteId as string, candidate]));

  const toRow = (invite: InviteDetail | null, candidate: RankedCandidate | null): ExportRow => {
    const decision = candidate ? latestDecision.get(candidate.interviewId) : undefined;
    const share = candidate ? latestShare.get(candidate.interviewId) : undefined;
    return {
      candidate_ref: invite?.candidate_ref ?? candidate?.candidateRef ?? null,
      name: invite?.name ?? candidate?.displayName ?? null,
      email: invite?.email ?? null,
      phone: invite?.phone ?? null,
      channel: invite?.channel ?? null,
      invited_at: invite?.invited_at ?? null,
      first_reminder_at: invite?.first_reminder_at ?? null,
      second_reminder_at: invite?.second_reminder_at ?? null,
      submitted_at: candidate?.submittedAt ?? invite?.submitted_at ?? null,
      rubric: candidate ? candidate.coverage.items.map((item) => item.covered) : [],
      decision: decision?.decision ?? candidate?.decision ?? null,
      reviewer: decision ? reviewerEmails.get(decision.reviewer_id) ?? decision.reviewer_id : null,
      decided_at: decision?.created_at ?? null,
      note: decision?.note ?? null,
      share_response: share?.response ?? null,
      share_responded_at: share?.responded_at ?? null,
    };
  };

  const rows: ExportRow[] = [];
  for (const invite of (inviteRows ?? []) as InviteDetail[]) rows.push(toRow(invite, byInvite.get(invite.id) ?? null));
  // Candidates who arrived through the plain link, without an invite.
  for (const candidate of candidates) if (!candidate.inviteId) rows.push(toRow(null, candidate));
  return rows;
}
