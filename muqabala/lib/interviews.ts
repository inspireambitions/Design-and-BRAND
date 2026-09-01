import { z } from 'zod';
import type { AnswerFeedback } from './scoring';
import type { Role } from './roles';

export const QuestionSnapshotSchema = z.object({
  id: z.string().min(1).max(160),
  text: z.string().min(1).max(2000),
  textAr: z.string().min(1).max(2000),
  competencies: z.array(z.string().min(1).max(80)).max(12).default([]),
  hint: z.string().max(2000).default(''),
  hintAr: z.string().max(2000).default(''),
  prepSeconds: z.number().int().min(0).max(300),
  answerSeconds: z.number().int().min(15).max(900),
});

export const CreateInterviewSchema = z.object({
  roleId: z.string().min(1).max(160),
  roleTitle: z.string().min(1).max(200),
  language: z.enum(['en', 'ar']),
  mode: z.enum(['guided', 'mock', 'screening']),
  questions: z.array(QuestionSnapshotSchema).min(1).max(20),
  interviewToken: z.string().max(64_000).optional(),
  focusQuestionId: z.string().min(1).max(160).optional(),
  candidateName: z.string().trim().min(2).max(100).optional(),
});

export const ScreeningUploadRequestSchema = z.object({
  questionIndex: z.number().int().min(0).max(19),
  mimeType: z.enum(['video/webm', 'video/mp4', 'video/quicktime']),
}).strict();

export const ScreeningAnswerSchema = z.object({
  questionIndex: z.number().int().min(0).max(19),
  transcript: z.string().max(6000).default(''),
  videoPath: z.string().min(8).max(500),
  mimeType: z.enum(['video/webm', 'video/mp4', 'video/quicktime']),
  sizeBytes: z.number().int().min(1).max(50 * 1024 * 1024),
  durationSeconds: z.number().int().min(1).max(125),
}).strict();

export const ScreeningSubmitSchema = z.object({
  consent: z.literal(true),
  consentVersion: z.literal('employer-video-v1'),
}).strict();

export const SaveAnswerSchema = z.object({
  questionIndex: z.number().int().min(0).max(19),
  transcript: z.string().max(6000),
  currentQuestion: z.number().int().min(0).max(20),
  status: z.enum(['in_progress', 'completed']).default('in_progress'),
});

export const AuthRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  next: z.string().max(500).optional(),
  lang: z.enum(['en', 'ar']).default('en'),
});

export const OtpVerifySchema = AuthRequestSchema.extend({
  token: z.string().regex(/^\d{6}$/),
});

export type StoredAnswer = {
  question_index: number;
  question_id: string;
  question_text: string;
  transcript: string;
  feedback: AnswerFeedback | null;
  scoring_status: 'pending' | 'scored' | 'unscored' | 'failed';
  video_path?: string | null;
  video_mime_type?: string | null;
  video_size_bytes?: number | null;
  video_duration_seconds?: number | null;
  video_upload_status?: 'none' | 'pending' | 'uploaded';
  response_saved_at?: string | null;
};

export type StoredInterview = {
  id: string;
  user_id: string | null;
  anonymous_token_hash: string | null;
  role_id: string;
  role_title: string;
  language: 'en' | 'ar';
  mode: 'guided' | 'mock' | 'screening';
  status: 'in_progress' | 'completed';
  current_question: number;
  question_snapshot: z.infer<typeof QuestionSnapshotSchema>[];
  role_snapshot: Role | null;
  overall_score: number | null;
  saved: boolean;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  expires_at: string;
  screening_pack_id?: string | null;
  candidate_name?: string | null;
  candidate_user_id?: string | null;
  consent_version?: string | null;
  consented_at?: string | null;
  submitted_at?: string | null;
  locked_at?: string | null;
};

export function reportProjection(
  interview: StoredInterview,
  answers: StoredAnswer[],
  unlocked: boolean,
) {
  const visible = unlocked ? answers : answers.filter((answer) => answer.question_index === 0);
  return {
    id: interview.id,
    roleId: interview.role_id,
    roleTitle: interview.role_title,
    language: interview.language,
    mode: interview.mode,
    status: interview.status,
    currentQuestion: interview.current_question,
    questionSnapshot: interview.question_snapshot,
    startedAt: interview.started_at,
    updatedAt: interview.updated_at,
    unlocked,
    lockedQuestionCount: unlocked ? 0 : Math.max(0, answers.length - visible.length),
    overallScore: unlocked ? interview.overall_score : null,
    saved: unlocked ? interview.saved : false,
    answers: visible.map((answer) => ({
      questionIndex: answer.question_index,
      questionId: answer.question_id,
      questionText: answer.question_text,
      transcript: answer.transcript,
      feedback: answer.feedback,
      scoringStatus: answer.scoring_status,
    })),
  };
}
