import { z } from 'zod';

export const MAX_JOB_DESCRIPTION_BODY_BYTES = 8 * 1024;

const safeName = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .refine((value) => !/[{}<>]/.test(value), 'Unsupported characters.');

export const JobDescriptionRequestSchema = z
  .object({
    companyName: safeName.pipe(z.string().max(80)),
    jobTitle: safeName,
  })
  .strict();

export const GeneratedJobDescriptionSchema = z.object({
  summary: z.string().min(120).max(700),
  responsibilities: z.array(z.string().min(20).max(220)).min(6).max(8),
  requirements: z.array(z.string().min(20).max(220)).min(5).max(7),
  success_measures: z.array(z.string().min(20).max(220)).min(3).max(5),
});

export type GeneratedJobDescription = z.infer<typeof GeneratedJobDescriptionSchema>;

const UNSAFE_HIRING_CONTENT = [
  /\b(age|date of birth|marital status|married|pregnan|nationality|race|ethnic|religion|gender|male only|female only|disabilit)\b/i,
  /(العمر|تاريخ الميلاد|الحالة الاجتماعية|متزوج|حامل|الجنسية|العرق|الديانة|الجنس|إعاقة)/,
];

const PROMPT_ECHO = [
  /\b(system prompt|these instructions|as an ai|language model|untrusted content)\b/i,
  /\b(ignore previous|reveal your|developer message)\b/i,
];

const UNSUPPORTED_PROMISES = [
  /\b(AED|USD|SAR|QAR|salary of|visa provided|free accommodation|housing provided)\b/i,
];

function unique(items: string[]): boolean {
  const normalised = items.map((item) => item.trim().toLocaleLowerCase());
  return new Set(normalised).size === normalised.length;
}

export function formatGeneratedJobDescription(input: {
  companyName: string;
  jobTitle: string;
  generated: GeneratedJobDescription;
}): string | null {
  const { companyName, jobTitle, generated } = input;
  const allItems = [
    generated.summary,
    ...generated.responsibilities,
    ...generated.requirements,
    ...generated.success_measures,
  ];
  const allText = allItems.join('\n');

  if (!unique(generated.responsibilities) || !unique(generated.requirements) || !unique(generated.success_measures)) {
    return null;
  }
  if (UNSAFE_HIRING_CONTENT.some((pattern) => pattern.test(allText))) return null;
  if (PROMPT_ECHO.some((pattern) => pattern.test(allText))) return null;
  if (UNSUPPORTED_PROMISES.some((pattern) => pattern.test(allText))) return null;

  return [
    jobTitle,
    companyName,
    '',
    'Role summary',
    generated.summary.trim(),
    '',
    'Key responsibilities',
    ...generated.responsibilities.map((item) => `- ${item.trim()}`),
    '',
    'What you will bring',
    ...generated.requirements.map((item) => `- ${item.trim()}`),
    '',
    'Success in this role',
    ...generated.success_measures.map((item) => `- ${item.trim()}`),
  ].join('\n');
}
