'use client';

import { useLang } from './LanguageProvider';

export function AccountTitle() {
  const { t } = useLang();
  return <div><p className="eyebrow">{t('privateAccount')}</p><h1>{t('yourInterviews')}</h1></div>;
}
