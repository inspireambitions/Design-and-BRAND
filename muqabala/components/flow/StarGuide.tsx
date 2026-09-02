'use client';

import { useLang } from '../LanguageProvider';

/** Switch in the answer box header. Off by default; the flow remembers it locally. */
export function StarGuideToggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  const { t } = useLang();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`star-toggle${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="star-toggle-track" aria-hidden="true">
        <span className="star-toggle-thumb" />
      </span>
      <span>{t('starGuideToggle')}</span>
    </button>
  );
}

/**
 * Four prompt lines shown inside an empty answer box. They sit over the box
 * and never catch a tap, so the first word the candidate types lands in the
 * box and the lines disappear. The box points at them with aria-describedby.
 */
export function StarGuideLines({ id }: { id: string }) {
  const { t } = useLang();
  return (
    <div className="star-lines" id={id}>
      <span>{t('starSituation')}</span>
      <span>{t('starTask')}</span>
      <span>{t('starAction')}</span>
      <span>{t('starResult')}</span>
    </div>
  );
}
