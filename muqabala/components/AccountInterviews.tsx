'use client';

import Link from 'next/link';
import { ArrowRight, ChatCircleDots, FileText } from '@phosphor-icons/react';
import { useLang } from './LanguageProvider';

export type AccountInterview = {
  id: string;
  role_id: string;
  role_title: string;
  status: string;
  current_question: number;
  saved: boolean;
  updated_at: string;
};

export function AccountInterviews({ interviews }: { interviews: AccountInterview[] }) {
  const { lang, t } = useLang();

  if (!interviews.length) {
    return (
      <section className="account-interviews-panel" aria-labelledby="account-interviews-title">
        <h2 id="account-interviews-title">{t('yourInterviews')}</h2>
        <div className="account-empty-state">
          <div className="account-empty-visual" aria-hidden="true">
            <FileText size={160} weight="thin" />
            <ChatCircleDots size={80} weight="thin" />
          </div>
          <div className="account-empty-copy">
            <h3>{t('nothingSavedYet')}</h3>
            <p>{t('accountEmptyBody')}</p>
            <Link href="/interview-roles" className="account-secondary-action">
              <span>{t('accountBrowseRoles')}</span>
              <ArrowRight size={18} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="account-interviews-panel" aria-labelledby="account-interviews-title">
      <h2 id="account-interviews-title">{t('yourInterviews')}</h2>
      <div className="account-interview-list">
        {interviews.map((item) => (
          <article className="account-interview-card" key={item.id}>
            <div className="account-interview-card-copy">
              <h3>{item.role_title}</h3>
              <p>
                {item.status === 'completed'
                  ? t('completed')
                  : `${t('continueFromQuestion')} ${item.current_question + 1}`}
                {' · '}
                {new Date(item.updated_at).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-GB')}
              </p>
            </div>
            <div className="account-interview-card-actions">
              {item.saved && <span className="chip chip-gold">{t('saved')}</span>}
              {item.status === 'completed' ? (
                <Link className="account-card-action" href={`/account/reports/${item.id}`}>{t('viewReport')}</Link>
              ) : (
                <Link className="account-card-action" href={`/practice/${item.role_id}?resume=${item.id}`}>{t('continueInterview')}</Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
