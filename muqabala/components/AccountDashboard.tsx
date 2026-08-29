'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CaretDown,
  FileText,
  SignOut,
  Sparkle,
  UserCircle,
} from '@phosphor-icons/react';
import { AccountInterviews, type AccountInterview } from './AccountInterviews';
import { SignOutButton } from './SignOutButton';
import { useLang } from './LanguageProvider';

export function AccountDashboard({
  email,
  interviews,
  marketingOptIn,
}: {
  email: string;
  interviews: AccountInterview[];
  marketingOptIn: boolean;
}) {
  const { lang, setLang, t } = useLang();
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initial = email.trim().charAt(0).toUpperCase() || 'M';
  const [emailUpdates, setEmailUpdates] = useState(marketingOptIn);
  const [savingEmailUpdates, setSavingEmailUpdates] = useState(false);
  const [emailUpdateMessage, setEmailUpdateMessage] = useState('');

  async function saveEmailUpdates() {
    setSavingEmailUpdates(true);
    setEmailUpdateMessage('');
    const nextValue = !emailUpdates;
    try {
      const response = await fetch('/api/account/email-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketingOptIn: nextValue, lang }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json() as { scheduled?: boolean; suppressed?: boolean };
      setEmailUpdates(data.suppressed ? false : nextValue);
      setEmailUpdateMessage(nextValue
        ? data.suppressed ? t('emailUpdatesSuppressed') : data.scheduled ? t('emailUpdatesSaved') : t('emailUpdatesSubscribed')
        : t('emailUpdatesStopped'));
    } catch {
      setEmailUpdateMessage(t('emailUpdatesFailed'));
    } finally {
      setSavingEmailUpdates(false);
    }
  }

  useEffect(() => {
    if (!accountOpen) return;

    function closeMenu(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setAccountOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountOpen(false);
    }

    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountOpen]);

  return (
    <main className="account-page">
      <aside className="account-sidebar" aria-label={t('accountNavigation')}>
        <div className="account-sidebar-top">
          <Link href="/" className="account-brand">
            <span className="account-brand-mark" aria-hidden="true">م</span>
            <span>Muqabala</span>
          </Link>
          <button
            type="button"
            className="account-language-mobile"
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            aria-label={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
          >
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
        </div>

        <div className="account-profile-wrap" ref={menuRef}>
          <button
            type="button"
            className="account-profile"
            aria-expanded={accountOpen}
            aria-controls="account-menu"
            onClick={() => setAccountOpen((open) => !open)}
          >
            <span className="account-avatar" aria-hidden="true">
              {initial}
              <span className="account-online-dot" />
            </span>
            <span className="account-profile-copy">
              <strong>{email}</strong>
              <small>{t('signedIn')}</small>
            </span>
            <CaretDown size={18} weight="bold" aria-hidden="true" />
          </button>

          {accountOpen && (
            <div className="account-menu" id="account-menu">
              <p>{t('accountMenuBody')}</p>
              <SignOutButton className="account-sign-out">
                <SignOut size={18} aria-hidden="true" />
                {t('signOut')}
              </SignOutButton>
            </div>
          )}
        </div>

        <nav className="account-navigation">
          <Link href="/account" className="account-nav-item is-active" aria-current="page">
            <FileText size={22} weight="duotone" aria-hidden="true" />
            <span>{t('yourInterviews')}</span>
          </Link>
          <button
            type="button"
            className="account-nav-item"
            onClick={() => setAccountOpen(true)}
          >
            <UserCircle size={22} weight="duotone" aria-hidden="true" />
            <span>{t('accountNavLabel')}</span>
          </button>
        </nav>
      </aside>

      <section className="account-workspace">
        <header className="account-workspace-topbar">
          <button
            type="button"
            className="account-language"
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            aria-label={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
          >
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
        </header>

        <div className="account-workspace-inner">
          <div className="account-intro">
            <p className="account-eyebrow">{t('privateAccount')}</p>
            <h1>{t('accountReadyTitle')}</h1>
            <p className="account-lede">{t('accountReadyBody')}</p>
          </div>

          <Link href="/practice" className="account-primary-action">
            <Sparkle size={23} weight="fill" aria-hidden="true" />
            <span>{t('startNewInterview')}</span>
          </Link>

          <AccountInterviews interviews={interviews} />

          <section className="account-email-preferences" aria-labelledby="email-preferences-heading">
            <div>
              <h2 id="email-preferences-heading">{t('emailUpdatesTitle')}</h2>
              <p>{t('emailMarketingOptIn')}</p>
            </div>
            <button className="btn btn-quiet" type="button" onClick={() => void saveEmailUpdates()} disabled={savingEmailUpdates}>
              {savingEmailUpdates ? t('saving') : emailUpdates ? t('stopEmailUpdates') : t('getEmailUpdates')}
            </button>
            {emailUpdateMessage && <p className="tiny" role="status">{emailUpdateMessage}</p>}
          </section>
        </div>
      </section>
    </main>
  );
}
