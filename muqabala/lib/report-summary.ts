import type { AnswerFeedback } from '@/lib/scoring';

export const REPORT_SUMMARY_VERSION = 1;

export type ReportAnswer = {
  question_index: number;
  question_text: string;
  transcript: string;
  feedback: AnswerFeedback | null;
  scoring_status: 'pending' | 'scored' | 'unscored' | 'failed';
  video_path: string | null;
  video_duration_seconds: number | null;
  response_saved_at: string | null;
};

export type ReportSummary = {
  version: number;
  answer_count: number;
  recordings_ready: number;
  total_duration_seconds: number;
  scoring_settled: boolean;
  answers: ReportAnswer[];
};

/**
 * Builds the one-row copy of an employer report from its answers. It copies
 * what the report page renders and nothing else: no candidate identity beyond
 * what the interviews row already holds, and no derived verdicts.
 */
export function buildReportSummary(answers: ReportAnswer[]): ReportSummary {
  const ordered = [...answers].sort((a, b) => a.question_index - b.question_index);
  return {
    version: REPORT_SUMMARY_VERSION,
    answer_count: ordered.length,
    recordings_ready: ordered.filter((answer) => Boolean(answer.video_path)).length,
    total_duration_seconds: ordered.reduce((total, answer) => total + (answer.video_duration_seconds || 0), 0),
    scoring_settled: ordered.every((answer) => answer.scoring_status !== 'pending'),
    answers: ordered.map((answer) => ({
      question_index: answer.question_index,
      question_text: answer.question_text,
      transcript: answer.transcript,
      feedback: answer.feedback,
      scoring_status: answer.scoring_status,
      video_path: answer.video_path,
      video_duration_seconds: answer.video_duration_seconds,
      response_saved_at: answer.response_saved_at,
    })),
  };
}

/**
 * Returns the stored answers when the summary is usable for rendering, or null
 * when the page must fall back to interview_answers: no summary yet (older
 * submissions), an unknown shape, or AI notes that were still pending when the
 * summary was written.
 */
export function usableReportSummary(value: unknown): ReportSummary | null {
  if (!value || typeof value !== 'object') return null;
  const summary = value as Partial<ReportSummary>;
  if (summary.version !== REPORT_SUMMARY_VERSION || !Array.isArray(summary.answers)) return null;
  if (summary.scoring_settled !== true) return null;
  return summary as ReportSummary;
}
