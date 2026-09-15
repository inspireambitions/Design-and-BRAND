import { z } from 'zod';

export const ScreeningQuestionDraftSchema = z.object({
  id: z.string().trim().min(1).max(80),
  text: z.string().trim().min(15).max(500),
  textAr: z.string().trim().min(10).max(500),
}).strict();

const PublishedFactsSchema = z.object({
  salary: z.string().trim().max(500).optional(),
  accommodation: z.string().trim().max(500).optional(),
  interviewDetails: z.string().trim().max(1000).optional(),
}).strict();

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const ScreeningPackRequestSchema = z.object({
  companyName: z.string().trim().min(2).max(80).optional(),
  workplace: z.string().trim().min(2).max(80).optional(),
  recruiterName: z.string().trim().max(80).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  jobText: z.string().trim().max(12_000).optional(),
  location: z.string().trim().min(2).max(160).optional(),
  timezone: z.string().trim().min(3).max(64).refine(validTimezone).default('Asia/Dubai'),
  publishedFacts: PublishedFactsSchema.optional(),
  questions: z.array(ScreeningQuestionDraftSchema).min(3).max(8).optional(),
  publishKey: z.string().uuid().optional(),
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
