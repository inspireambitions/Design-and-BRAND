'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { buildCustomRole } from '@/lib/roles';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';
import { InterviewFlow } from './InterviewFlow';

export function CustomRoleStart() {
  const { t } = useLang();
  const [draft, setDraft] = useState('');
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const role = useMemo(
    () => (confirmed === null ? null : buildCustomRole(confirmed)),
    [confirmed],
  );

  if (role) {
    return <InterviewFlow role={role} customTitle={confirmed ?? undefined} />;
  }

  const trimmed = draft.trim();

  return (
    <div className="shell shell-narrow">
      <TopBar showProgressLink={false} />

      <div className="stack">
        <div>
          <p className="eyebrow">{t('customEyebrow')}</p>
          <h1 style={{ fontSize: '1.75rem' }}>{t('customTitle')}</h1>
          <p className="lede" style={{ marginTop: '0.6rem' }}>
            {t('customBody')}
          </p>
        </div>

        <div className="card stack">
          <label className="stack-sm" htmlFor="job-title">
            <span className="eyebrow" style={{ marginBottom: 0 }}>
              {t('customLabel')}
            </span>
            <input
              id="job-title"
              className="text-input"
              type="text"
              value={draft}
              placeholder={t('customPlaceholder')}
              autoComplete="organization-title"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && trimmed.length > 1) setConfirmed(trimmed);
              }}
            />
          </label>
          <p className="tiny">{t('customHint')}</p>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={trimmed.length < 2}
              onClick={() => setConfirmed(trimmed)}
            >
              {t('customStart')}
            </button>
            <Link href="/" className="btn btn-quiet" style={{ textDecoration: 'none' }}>
              {t('back')}
            </Link>
          </div>
        </div>

        <p className="notice tiny" style={{ margin: 0 }}>
          {t('scoringPolicy')}
        </p>
      </div>
    </div>
  );
}
