'use client';

import Link from 'next/link';
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

  if (!interviews.length) return <div className="card"><p>{t('noSavedInterviews')}</p></div>;

  return interviews.map((item) => (
    <article className="card stack-sm" key={item.id}>
      <h2 style={{ fontSize: '1.15rem' }}>{item.role_title}</h2>
      <p className="tiny">
        {item.status === 'completed'
          ? t('completed')
          : `${t('continueFromQuestion')} ${item.current_question + 1}`}
        {' · '}
        {new Date(item.updated_at).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-GB')}
      </p>
      <div className="row">
        {item.status === 'completed' ? (
          <Link className="btn btn-primary" href={`/account/reports/${item.id}`}>{t('viewReport')}</Link>
        ) : (
          <Link className="btn btn-primary" href={`/practice/${item.role_id}?resume=${item.id}`}>{t('continueInterview')}</Link>
        )}
        {item.saved && <span className="chip chip-gold">{t('saved')}</span>}
      </div>
    </article>
  ));
}
