import { z } from 'zod';

export const ScreeningPackRequestSchema = z.object({
  companyName: z.string().trim().min(2).max(80).optional(),
  workplace: z.string().trim().min(2).max(80).optional(),
  recruiterName: z.string().trim().max(80).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  jobText: z.string().trim().max(12_000).optional(),
  // Kept optional for a safe rolling deployment. Old browser bundles can send
  // a generated token while new bundles ask the server for the catalogue pack.
  interviewToken: z.string().min(1).max(64_000).optional(),
  maxCandidates: z.number().int().min(1).max(1000).default(100),
  expiryDays: z.number().int().min(1).max(30).default(14),
}).strict().refine((value) => Boolean(value.companyName || value.workplace), {
  message: 'Company name is required.',
}).refine((value) => Boolean(value.interviewToken || value.jobTitle), {
  message: 'Job title or signed interview token is required.',
});
