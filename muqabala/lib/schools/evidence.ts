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
      supportingText: z.string().max(12000),
      confidence: z.enum(['high', 'medium', 'low']),
    }).strict()).length(4),
    improvement: z.string().min(1).max(600),
  }).strict()).length(3),
}).strict();
export type SchoolsFeedback = z.infer<typeof schoolsFeedbackSchema>;
export type SchoolRubric = z.infer<typeof questionRubricSchema>;

export const schoolsProviderFeedbackSchema=z.object({questions:z.array(z.object({
  questionIndex:z.number().int().min(0).max(2),
  elements:z.array(z.object({id:z.string().min(1).max(80),present:z.boolean(),
    firstExcerpt:z.number().int().nonnegative().nullable(),lastExcerpt:z.number().int().nonnegative().nullable(),
    confidence:z.enum(['high','medium','low'])}).strict()).length(4),
  improvement:z.string().min(1).max(600),
}).strict()).length(3)}).strict();

/** Offsets always refer to the original stored answer, including its spelling. */
export function answerExcerpts(answer:string){
  const excerpts:{index:number;text:string;start:number;end:number}[]=[];
  for(const part of new Intl.Segmenter('en',{granularity:'sentence'}).segment(answer)){
    for(let offset=0;offset<part.segment.length;){
      let end=Math.min(offset+1200,part.segment.length);
      if(end<part.segment.length){const boundary=part.segment.lastIndexOf(' ',end);if(boundary>offset)end=boundary;}
      const lastUnit=part.segment.charCodeAt(end-1);if(end<part.segment.length&&lastUnit>=0xD800&&lastUnit<=0xDBFF)end--;
      const slice=part.segment.slice(offset,end),text=slice.trim();
      if(text){const start=part.index+offset+slice.indexOf(text);excerpts.push({index:excerpts.length,text,start,end:start+text.length});}
      offset=end;
    }
  }
  return excerpts;
}

/** The provider selects source spans. It never supplies the quotation displayed to a learner. */
export function resolveSchoolsFeedback(raw:unknown,answers:string[]):SchoolsFeedback {
  const provider=schoolsProviderFeedbackSchema.parse(raw);
  const excerpts=answers.map(answerExcerpts);
  return schoolsFeedbackSchema.parse({questions:provider.questions.map(question=>({...question,
    elements:question.elements.map(({firstExcerpt,lastExcerpt,...element})=>{
      if(!element.present){if(firstExcerpt!==null||lastExcerpt!==null)throw new Error('Absent elements must not claim supporting text');return {...element,supportingText:''};}
      const parts=excerpts[question.questionIndex];
      if(firstExcerpt===null||lastExcerpt===null||lastExcerpt<firstExcerpt||!parts?.[firstExcerpt]||!parts[lastExcerpt])throw new Error('Unexpected excerpt selection');
      return {...element,supportingText:answers[question.questionIndex].slice(parts[firstExcerpt].start,parts[lastExcerpt].end)};
    }),
  }))});
}

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
