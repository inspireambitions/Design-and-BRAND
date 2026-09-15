import type { Coverage } from '@/lib/employer-volume/coverage';

export type EmployerReviewAnswer = {
  questionIndex: number;
  questionText: string;
  transcript: string;
  scoringStatus: 'pending' | 'scored' | 'unscored' | 'failed';
  hasVideo: boolean;
  durationSeconds: number | null;
};

/** The deliberately small, employer-authorized payload used by the dashboard panel. */
export type EmployerCandidateReviewPayload = {
  interviewId: string;
  roleId: string;
  displayName: string;
  roleTitle: string;
  workplace: string;
  submittedAt: string;
  reviewedAt: string | null;
  currentDecision: string | null;
  coverage: Coverage;
  answers: EmployerReviewAnswer[];
};
