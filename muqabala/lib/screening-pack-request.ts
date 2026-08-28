import { z } from 'zod';

export const ScreeningPackRequestSchema = z.object({
  companyName: z.string().trim().min(2).max(80).optional(),
  workplace: z.string().trim().min(2).max(80).optional(),
  recruiterName: z.string().trim().max(80).optional(),
  jobTitle: z.string().max(120).optional(),
  interviewToken: z.string().min(1).max(64_000),
  maxCandidates: z.number().int().min(1).max(1000).default(100),
  expiryDays: z.number().int().min(1).max(30).default(14),
}).strict().refine((value) => Boolean(value.companyName || value.workplace), {
  message: 'Company name is required.',
});
