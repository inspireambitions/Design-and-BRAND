import { z } from 'zod';

export const rubricElementSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(200),
  description: z.string().min(1).max(600),
}).strict();
export const questionRubricSchema = z.array(rubricElementSchema).length(4)
  .refine(items => new Set(items.map(item => item.id)).size === 4, 'Rubric elements must be distinct');
export const schoolsFeedbackSchema = z.object({
  questions: z.array(z.object({
    questionIndex: z.number().int().min(0).max(2),
    elements: z.array(z.object({
      id: z.string().min(1).max(80),
      present: z.boolean(),
      supportingText: z.string().max(6000),
      confidence: z.enum(['high', 'medium', 'low']),
    }).strict()).length(4),
    improvement: z.string().min(1).max(600),
  }).strict()).length(3),
}).strict();
export type SchoolsFeedback = z.infer<typeof schoolsFeedbackSchema>;
export type SchoolRubric = z.infer<typeof questionRubricSchema>;

/** Only validated answer excerpts can contribute to the count. Client totals are never read. */
export function calculateEvidence(raw: unknown, answers: string[], rubrics: SchoolRubric[]) {
  if (answers.length !== 3 || rubrics.length !== 3) throw new Error('Three answers and rubrics are required');
  const feedback = schoolsFeedbackSchema.parse(raw);
  const indices = new Set(feedback.questions.map(question => question.questionIndex));
  if (indices.size !== 3) throw new Error('Each question must occur once');
  let covered = 0;
  const detail = feedback.questions.slice().sort((a, b) => a.questionIndex - b.questionIndex).map(question => {
    const rubric = questionRubricSchema.parse(rubrics[question.questionIndex]);
    const required = new Set(rubric.map(element => element.id));
    const seen = new Set<string>();
    const elements = question.elements.map(element => {
      if (!required.has(element.id) || seen.has(element.id)) throw new Error('Unexpected rubric element');
      seen.add(element.id);
      const quote = element.supportingText.trim();
      const start = quote ? answers[question.questionIndex].indexOf(quote) : -1;
      if (element.present && (quote.length === 0 || start < 0)) throw new Error('Supporting text is not in the answer');
      if (!element.present && quote) throw new Error('Absent elements must not claim supporting text');
      if (element.present) covered++;
      return { ...element, supportingText: quote, start: element.present ? start : null, end: element.present ? start + quote.length : null };
    });
    return { ...question, elements };
  });
  return { covered, detail };
}
export function lowestEvidenceQuestion(feedback: SchoolsFeedback): number {
  return feedback.questions.slice().sort((a, b) =>
    a.elements.filter(e => e.present).length - b.elements.filter(e => e.present).length
    || a.questionIndex - b.questionIndex)[0].questionIndex;
}
