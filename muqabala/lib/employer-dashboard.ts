export type DashboardPack = {
  id: string;
  expires_at: string;
  closed_at: string | null;
  max_candidates: number;
  starts_used: number;
};

export type DashboardSubmission = {
  screening_pack_id: string;
  submitted_at: string;
};

export type DashboardAnswer = {
  question_index: number;
  scoring_status: 'pending' | 'scored' | 'unscored' | 'failed';
  video_upload_status: string | null;
  video_duration_seconds: number | null;
};

export type PackHealth = 'active' | 'closing' | 'full' | 'closed';

const DAY_MS = 24 * 60 * 60 * 1000;

export function packHealth(pack: DashboardPack, now = new Date()): PackHealth {
  if (pack.closed_at) return 'closed';
  const expiresAt = new Date(pack.expires_at).getTime();
  if (expiresAt <= now.getTime()) return 'closed';
  if (pack.starts_used >= pack.max_candidates) return 'full';
  if (expiresAt - now.getTime() <= 7 * DAY_MS) return 'closing';
  return 'active';
}

export function dashboardSummary(
  packs: DashboardPack[],
  submissions: DashboardSubmission[],
  now = new Date(),
) {
  const weekAgo = now.getTime() - 7 * DAY_MS;
  const activePacks = packs.filter((pack) => ['active', 'closing'].includes(packHealth(pack, now)));
  const totalStarts = packs.reduce((total, pack) => total + pack.starts_used, 0);
  const placesRemaining = activePacks.reduce(
    (total, pack) => total + Math.max(0, pack.max_candidates - pack.starts_used),
    0,
  );

  return {
    submittedThisWeek: submissions.filter((submission) => new Date(submission.submitted_at).getTime() >= weekAgo).length,
    activeLinks: activePacks.length,
    placesRemaining,
    submissionRate: totalStarts > 0 ? Math.round((submissions.length / totalStarts) * 100) : 0,
  };
}

export function candidateEvidence(answers: DashboardAnswer[]) {
  const ordered = [...answers].sort((a, b) => a.question_index - b.question_index);
  return {
    answers: ordered,
    recordingsReady: ordered.filter((answer) => answer.video_upload_status === 'uploaded').length,
    notesReady: ordered.filter((answer) => answer.scoring_status === 'scored').length,
    notesPending: ordered.some((answer) => answer.scoring_status === 'pending'),
  };
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds < 1) return 'Saved';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
