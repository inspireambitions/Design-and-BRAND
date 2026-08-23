import { z } from 'zod';

export const RatingFeedbackSchema = z
  .object({
    attemptId: z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),
    roleId: z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/),
    stars: z.number().int().min(1).max(5),
    confidence: z.enum(['more', 'same', 'less']),
    overallScore: z.number().int().min(0).max(100).nullable(),
    questionsAnswered: z.number().int().min(1).max(12),
    language: z.enum(['en', 'ar']),
  })
  .strict();

export type RatingFeedback = z.infer<typeof RatingFeedbackSchema>;

export function confidenceLabel(value: RatingFeedback['confidence']): string {
  if (value === 'more') return 'More ready';
  if (value === 'less') return 'Less ready';
  return 'About the same';
}

