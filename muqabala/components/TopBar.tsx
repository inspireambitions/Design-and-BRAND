'use client';

import Link from 'next/link';
import { useLang } from './LanguageProvider';

export function TopBar({ showProgressLink = true }: { showProgressLink?: boolean }) {
  const { lang, setLang, t } = useLang();

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="brand-mark" aria-hidden="true">
          م
        </span>
        Muqabala
      </Link>
      <div className="topbar-actions">
        {showProgressLink && (
          <Link href="/progress" className="btn-ghost" style={{ textDecoration: 'none' }}>
            {t('seeProgress')}
          </Link>
        )}
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          aria-label={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
        >
          {lang === 'en' ? 'العربية' : 'English'}
        </button>
      </div>
    </header>
  );
}
