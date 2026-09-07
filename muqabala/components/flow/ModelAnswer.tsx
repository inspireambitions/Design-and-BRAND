'use client';

import type { Competency, Question } from '@/lib/roles';
import { modelAnswerFor } from '@/lib/flow/model-answers';
import { useLang } from '../LanguageProvider';

/**
 * A collapsed worked example, shown only after two attempts at a question.
 * The text is editorial and fixed; nothing is generated. Renders nothing when
 * the question has no model answer. Loaded on demand with its text.
 */
export function ModelAnswer({
  roleId,
  question,
  criteria,
  lang,
}: {
  roleId: string;
  question: Question;
  criteria: Array<Pick<Competency, 'id' | 'label' | 'labelAr'>>;
  lang: 'en' | 'ar';
}) {
  const { t } = useLang();
  const answer = modelAnswerFor(roleId, question, lang);
  if (!answer || criteria.length === 0) return null;

  const parts = [answer.relevance, answer.evidence, answer.structure, answer.clarity];
  const sections = criteria.map((criterion, criterionIndex) => ({
    id: criterion.id,
    label: lang === 'ar' ? criterion.labelAr : criterion.label,
    text: parts.filter((_, partIndex) => partIndex % criteria.length === criterionIndex).join(' '),
  })).filter((section) => section.text);

  return (
    <details className="disclosure model-answer card-flat">
      <summary>{t('showStrongAnswer')}</summary>
      <div className="stack-sm" style={{ marginTop: '0.6rem' }}>
        <p className="tiny muted">{t('modelAnswerNote')}</p>
        <div className="model-answer-body" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
          {sections.map((section) => (
            <p key={section.id} className="model-answer-part">
              <span className="model-answer-label">{section.label}</span>
              {' '}
              {section.text}
            </p>
          ))}
        </div>
      </div>
    </details>
  );
}
