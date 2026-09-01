import type { AnswerFeedback } from './scoring';

export type ReportAnswer = {
  questionId: string;
  questionText: string;
  transcript: string;
  feedback: AnswerFeedback;
};

export type ReportTextLabels = {
  report: string;
  score: string;
  question: string;
  yourAnswer: string;
  worked: string;
  improve: string;
};

/** The whole interview as plain text: copyable, sendable, readable anywhere. */
export function buildReportText(
  roleTitle: string,
  overall: number | null,
  answers: ReportAnswer[],
  labels: ReportTextLabels,
): string {
  const lines: string[] = [`${labels.report}: ${roleTitle}`];
  if (overall !== null) lines.push(`${labels.score}: ${overall}/100`);
  lines.push('');
  answers.forEach((a, i) => {
    lines.push(`${labels.question} ${i + 1}: ${a.questionText}`);
    if (a.feedback.status === 'scored') lines.push(`${labels.score}: ${a.feedback.score}/100`);
    lines.push(`${labels.yourAnswer}: ${a.transcript || '(no answer)'}`);
    if (a.feedback.strengths.length) lines.push(`${labels.worked}: ${a.feedback.strengths.join(' | ')}`);
    if (a.feedback.improvements.length) lines.push(`${labels.improve}: ${a.feedback.improvements.join(' | ')}`);
    lines.push('');
  });
  return lines.join('\n');
}
