'use client';

import Link from 'next/link';
import { useLang } from './LanguageProvider';
import { Brand } from './Brand';

export function TopBar({
  showProgressLink = true,
  locked = false,
}: {
  showProgressLink?: boolean;
  /**
   * True while an interview is in progress: the brand stops being a link and
   * the language toggle is disabled, so a stray thumb cannot destroy the
   * candidate's answers or flip the question language mid-dictation.
   */
  locked?: boolean;
}) {
  const { lang, setLang, t } = useLang();

  return (
    <header className="topbar">
      <Brand locked={locked} owner={lang === 'ar' ? 'من إنسباير أمبيشنز' : 'by Inspire Ambitions'} />
      <div className="topbar-actions">
        {showProgressLink && (
          <Link href="/account" className="btn-ghost" style={{ textDecoration: 'none' }}>
            {t('myAccount')}
          </Link>
        )}
        <button
          type="button"
          className="btn-ghost"
          disabled={locked}
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          aria-label={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
        >
          {lang === 'en' ? 'العربية' : 'English'}
        </button>
      </div>
    </header>
  );
}
