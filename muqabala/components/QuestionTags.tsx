import type { CSSProperties } from 'react';
import { getQuestionTag } from '@/lib/roles/question-tags';

const rowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.4rem',
  margin: 0,
  padding: 0,
  listStyle: 'none',
};

/* Sentence-case chips: the shared .chip is uppercase and single-line, which does not suit a short phrase in either script. */
const chipStyle: CSSProperties = {
  textTransform: 'none',
  letterSpacing: 0,
  whiteSpace: 'normal',
  fontSize: '0.74rem',
  lineHeight: 1.3,
};

/**
 * Small chips naming where a question is known to come up in the Gulf. Mounted
 * by the parent directly under the question. Renders nothing when a question
 * has no tags, so the layout never shows an empty row.
 */
export function QuestionTags({ tags, lang, className }: {
  tags: readonly string[] | undefined;
  lang: 'en' | 'ar';
  className?: string;
}) {
  const items = (tags ?? [])
    .map((id) => getQuestionTag(id))
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
    .slice(0, 2);
  if (!items.length) return null;
  const ar = lang === 'ar';
  return (
    <ul
      className={className ? `question-tags ${className}` : 'question-tags'}
      style={rowStyle}
      dir={ar ? 'rtl' : 'ltr'}
      lang={lang}
      aria-label={ar ? 'أين يُطرح هذا السؤال' : 'Where this question comes up'}
    >
      {items.map((tag) => (
        <li key={tag.id} className="chip chip-jade" style={chipStyle}>
          {ar ? tag.labelAr : tag.label}
        </li>
      ))}
    </ul>
  );
}
