'use client';

import type { Question } from '@/lib/roles';
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
  lang,
}: {
  roleId: string;
  question: Question;
  lang: 'en' | 'ar';
}) {
  const { t } = useLang();
  const answer = modelAnswerFor(roleId, question, lang);
  if (!answer) return null;

  const parts = [
    { key: 'modelRelevance', text: answer.relevance },
    { key: 'modelEvidence', text: answer.evidence },
    { key: 'modelStructure', text: answer.structure },
    { key: 'modelClarity', text: answer.clarity },
  ] as const;

  return (
    <details className="disclosure model-answer card-flat">
      <summary>{t('showStrongAnswer')}</summary>
      <div className="stack-sm" style={{ marginTop: '0.6rem' }}>
        <p className="tiny muted">{t('modelAnswerNote')}</p>
        <div className="model-answer-body" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
          {parts.map((part) => (
            <p key={part.key} className="model-answer-part">
              <span className="model-answer-label">{t(part.key)}</span>
              {' '}
              {part.text}
            </p>
          ))}
        </div>
      </div>
    </details>
  );
}
