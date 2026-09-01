import { z } from 'zod';
import { CONSENT_SOURCES, CONSENT_VERSION, PLAN_MODES, PLAN_VERSION } from './constants';

export {
  CONSENT_SOURCES, CONSENT_VERSION, PLAN_MODES, PLAN_VERSION, maskEmail, normalizeEmail,
  type ConsentSource, type PlanMode,
} from './constants';

export const PracticePlanRequestSchema = z.object({
  roleId: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
  questionId: z.string().trim().min(1).max(160),
  interviewId: z.string().uuid().optional(),
  email: z.string().trim().min(3).max(320).email(),
  locale: z.enum(['en', 'ar']),
  mode: z.enum(PLAN_MODES),
  clientRequestId: z.string().uuid(),
  consentVersion: z.literal(CONSENT_VERSION),
  consentSource: z.enum(CONSENT_SOURCES),
}).strict();

const DaySchema = z.object({
  day: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]),
  questionId: z.string().trim().min(1).max(160),
  questionText: z.string().trim().min(3).max(600),
  hint: z.string().trim().max(600),
  tags: z.array(z.string().max(60)).max(2),
}).strict();

/** The candidate's own feedback, kept to the coaching fields and never the transcript. */
export const PlanReportSchema = z.object({
  headline: z.string().trim().max(300),
  score: z.number().int().min(0).max(100).nullable(),
  strengths: z.array(z.string().trim().max(400)).max(3),
  improvements: z.array(z.string().trim().max(400)).max(3),
  coachTip: z.string().trim().max(600),
}).strict();

export const SevenDayPlanSchema = z.object({
  version: z.literal(PLAN_VERSION),
  locale: z.enum(['en', 'ar']),
  mode: z.enum(PLAN_MODES),
  roleId: z.string().trim().min(1).max(80),
  roleTitle: z.string().trim().min(1).max(160),
  focusQuestionId: z.string().trim().min(1).max(160),
  focusQuestionText: z.string().trim().min(3).max(600),
  sampleAnswer: z.array(z.string().trim().min(1).max(700)).min(1).max(8),
  report: PlanReportSchema.nullable(),
  days: z.array(DaySchema).length(7),
}).strict().superRefine((plan, context) => {
  plan.days.forEach((item, index) => {
    if (item.day !== index + 1) {
      context.addIssue({ code: 'custom', path: ['days', index, 'day'], message: 'Days must be ordered 1 through 7.' });
    }
  });
});

export type SevenDayPlan = z.infer<typeof SevenDayPlanSchema>;
export type PlanDay = SevenDayPlan['days'][number];
export type PlanReport = z.infer<typeof PlanReportSchema>;
export type PracticePlanRequest = z.infer<typeof PracticePlanRequestSchema>;
