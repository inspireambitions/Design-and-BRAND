import { z } from 'zod';

export const PLAN_VERSION = '1' as const;
export const CONSENT_VERSION = 'practice-plan-delivery-v1' as const;

export const PracticePlanRequestSchema = z.object({
  sessionId: z.string().uuid(),
  sessionProof: z.string().min(40).max(2_048),
  email: z.string().trim().min(3).max(320).email(),
  locale: z.enum(['en', 'ar']),
  clientRequestId: z.string().uuid(),
  consentVersion: z.literal(CONSENT_VERSION),
}).strict();

const DaySchema = z.object({
  day: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]),
  focus: z.string().trim().min(3).max(160),
  whyThisMatters: z.string().trim().min(8).max(500),
  exercise: z.string().trim().min(8).max(1_000),
  estimatedMinutes: z.number().int().min(5).max(90),
  successCheck: z.string().trim().min(5).max(500),
}).strict();

export const SevenDayPlanSchema = z.object({
  version: z.literal(PLAN_VERSION),
  summary: z.string().trim().min(8).max(800),
  days: z.array(DaySchema).length(7),
}).strict().superRefine((plan, context) => {
  plan.days.forEach((item, index) => {
    if (item.day !== index + 1) {
      context.addIssue({ code: 'custom', path: ['days', index, 'day'], message: 'Days must be ordered 1 through 7.' });
    }
  });
});

export type SevenDayPlan = z.infer<typeof SevenDayPlanSchema>;
export type PracticePlanRequest = z.infer<typeof PracticePlanRequestSchema>;

export function normalizeEmail(value: string): string {
  const collapsed = value.replace(/\s+/g, '').normalize('NFC');
  const at = collapsed.lastIndexOf('@');
  if (at < 1) return collapsed;
  return `${collapsed.slice(0, at)}@${collapsed.slice(at + 1).toLowerCase()}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '••••';
  return `${local.slice(0, 1)}${'•'.repeat(Math.min(5, Math.max(2, local.length - 1)))}@${domain}`;
}
