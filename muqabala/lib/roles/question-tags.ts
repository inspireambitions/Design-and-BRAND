/**
 * Gulf-specific question tags. A controlled list: every tag a question carries
 * must come from here, and a question carries at most two. Labels are shown as
 * small chips under the question in both languages.
 */
export const QUESTION_TAGS = [
  {
    id: 'uae_hotel',
    label: 'Common in UAE hotel interviews',
    labelAr: 'شائع في مقابلات فنادق الإمارات',
  },
  {
    id: 'saudi_agency',
    label: 'Asked by Saudi agencies',
    labelAr: 'تطرحه وكالات التوظيف السعودية',
  },
  {
    id: 'qatar_healthcare',
    label: 'Typical for Qatar healthcare',
    labelAr: 'معتاد في الرعاية الصحية في قطر',
  },
  {
    id: 'oman_bahrain_kuwait_retail',
    label: 'Common in Oman, Bahrain and Kuwait retail',
    labelAr: 'شائع في قطاع التجزئة في عُمان والبحرين والكويت',
  },
  {
    id: 'gulf_general',
    label: 'Asked across the Gulf',
    labelAr: 'يُطرح في كل دول الخليج',
  },
] as const;

export type QuestionTagId = (typeof QUESTION_TAGS)[number]['id'];
export type QuestionTag = (typeof QUESTION_TAGS)[number];

export const QUESTION_TAG_IDS: readonly QuestionTagId[] = QUESTION_TAGS.map((tag) => tag.id);

/** Two tags is the ceiling: more than that turns a coaching hint into noise. */
export const MAX_TAGS_PER_QUESTION = 2;

export function getQuestionTag(id: string): QuestionTag | undefined {
  return QUESTION_TAGS.find((tag) => tag.id === id);
}

export function isQuestionTagId(id: string): id is QuestionTagId {
  return QUESTION_TAG_IDS.includes(id as QuestionTagId);
}

export function questionTagLabel(id: string, lang: 'en' | 'ar'): string | undefined {
  const tag = getQuestionTag(id);
  if (!tag) return undefined;
  return lang === 'ar' ? tag.labelAr : tag.label;
}
