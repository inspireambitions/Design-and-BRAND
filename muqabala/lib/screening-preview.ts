const cleanPreviewText = (value: string | null | undefined, fallback: string, maxLength: number) => {
  const cleaned = (value || '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
  return cleaned || fallback;
};

const questionWord = (count: number) => {
  if (count === 3) return 'Three';
  return String(count);
};

export type ScreeningPreviewCopy = {
  companyName: string;
  jobTitle: string;
  questionCount: number;
  headline: string;
  invitationTitle: string;
  roleLine: string;
  timingLine: string;
  reviewLine: string;
  trustLine: string;
  description: string;
};

export function screeningPreviewCopy({
  companyName,
  jobTitle,
  questionCount = 3,
}: {
  companyName?: string | null;
  jobTitle?: string | null;
  questionCount?: number;
}): ScreeningPreviewCopy {
  const safeCompany = cleanPreviewText(companyName, 'A hiring team', 80);
  const safeJobTitle = cleanPreviewText(jobTitle, 'Job', 120);
  const safeQuestionCount = Number.isInteger(questionCount) && questionCount > 0 && questionCount <= 12
    ? questionCount
    : 3;
  const headline = 'Show how you would handle the job.';
  const invitationTitle = `${safeCompany} invites you to show how you would handle the job.`;
  const roleLine = `${safeJobTitle} work sample from ${safeCompany}.`;
  const timingLine = `${questionWord(safeQuestionCount)} questions. About 12 minutes.`;
  const reviewLine = 'Your answers will be reviewed by the hiring team.';
  const trustLine = 'No face scoring. No automatic rejection.';

  return {
    companyName: safeCompany,
    jobTitle: safeJobTitle,
    questionCount: safeQuestionCount,
    headline,
    invitationTitle,
    roleLine,
    timingLine,
    reviewLine,
    trustLine,
    description: `${safeJobTitle} work sample. ${timingLine} ${reviewLine} ${trustLine}`,
  };
}
