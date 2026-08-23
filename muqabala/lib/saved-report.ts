import { z } from 'zod';
import type { Attempt } from './scoring';

const shortText = z.string().trim().min(1).max(240);

export const SavedReportAnswerSchema = z.object({
  questionId: z.string().trim().min(1).max(120),
  questionText: z.string().trim().min(1).max(500),
  status: z.enum(['scored', 'unscored']),
  score: z.number().int().min(0).max(100).nullable(),
  headline: z.string().trim().min(1).max(120),
  source: z.enum(['ai', 'structure', 'none']),
  strengths: z.array(shortText).max(3),
  improvements: z.array(shortText).max(3),
  coachTip: z.string().trim().max(300),
  evidence: z.array(z.string().trim().min(1).max(180)).max(5),
}).strict();

export const SavedReportPayloadSchema = z.object({
  roleId: z.string().trim().min(1).max(120),
  roleTitle: z.string().trim().min(1).max(160),
  overallScore: z.number().int().min(0).max(100).nullable(),
  answers: z.array(SavedReportAnswerSchema).min(1).max(12),
}).strict();

export const SaveReportRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  report: SavedReportPayloadSchema,
  website: z.string().max(0).optional().default(''),
}).strict();

export type SavedReportPayload = z.infer<typeof SavedReportPayloadSchema>;

export type StoredReport = SavedReportPayload & {
  id: string;
  createdAt: string;
  expiresAt: string;
};

/**
 * Build the server-safe copy. Full candidate answers never cross this boundary.
 * Evidence is limited to short fragments the scorer already quoted back.
 */
export function reportPayloadFromAttempt(attempt: Attempt): SavedReportPayload {
  return SavedReportPayloadSchema.parse({
    roleId: attempt.roleId,
    roleTitle: attempt.roleTitle,
    overallScore: attempt.overallScore,
    answers: attempt.answers.map((answer) => ({
      questionId: answer.questionId,
      questionText: answer.questionText,
      status: answer.feedback.status,
      score: answer.feedback.status === 'scored' ? answer.feedback.score : null,
      headline: answer.feedback.headline,
      source: answer.feedback.source,
      strengths: answer.feedback.strengths,
      improvements: answer.feedback.improvements,
      coachTip: answer.feedback.coachTip,
      evidence: answer.feedback.competencies
        .map((competency) => competency.evidence)
        .filter((evidence): evidence is string => Boolean(evidence))
        .slice(0, 5),
    })),
  });
}
