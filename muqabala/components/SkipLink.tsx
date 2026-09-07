'use client';

import { useLang } from './LanguageProvider';

export function SkipLink() {
  const { lang } = useLang();
  return <a className="skip-link" href="#main-content">{lang === 'ar' ? 'انتقل إلى المحتوى' : 'Skip to content'}</a>;
}
