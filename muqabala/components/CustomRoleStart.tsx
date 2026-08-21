'use client';

import Link from 'next/link';
import { useState } from 'react';
import { buildCustomRole, type Role } from '@/lib/roles';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';
import { InterviewFlow } from './InterviewFlow';

/** Someone pasted a link instead of the advert text. */
function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) || (/^www\.\S+$/i.test(trimmed) && !trimmed.includes(' '));
}

export function CustomRoleStart() {
  const { t } = useLang();
  const [title, setTitle] = useState('');
  const [jobText, setJobText] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [tailored, setTailored] = useState(false);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [building, setBuilding] = useState(false);

  if (role) {
    return <InterviewFlow role={role} customTitle={role.title} tailored={tailored} interviewToken={token} />;
  }

  const trimmedTitle = title.trim();
  const trimmedJob = jobText.trim();
  const pastedLink = looksLikeUrl(trimmedJob);
  const usableJob = !pastedLink && trimmedJob.length >= 120;
  const canStart = trimmedTitle.length >= 2 || usableJob;

  const start = async () => {
    setBuilding(true);
    try {
      const response = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: trimmedTitle,
          jobText: usableJob ? trimmedJob : '',
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { role: Role; tailored: boolean; token?: string };
      setTailored(Boolean(data.tailored));
      setToken(data.token);
      setRole(data.role);
    } catch {
      // Never strand the candidate: fall back to the generic interview.
      setTailored(false);
      setRole(buildCustomRole(trimmedTitle));
    } finally {
      setBuilding(false);
    }
  };

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
              value={title}
              placeholder={t('customPlaceholder')}
              autoComplete="organization-title"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="stack-sm" htmlFor="job-ad">
            <span className="eyebrow" style={{ marginBottom: 0, color: 'var(--gold)' }}>
              {t('jdLabel')}
            </span>
            <textarea
              id="job-ad"
              className="answer-box"
              value={jobText}
              placeholder={t('jdPlaceholder')}
              onChange={(e) => setJobText(e.target.value)}
            />
          </label>

          {pastedLink ? (
            <p className="notice notice-warn tiny" style={{ margin: 0 }}>
              {t('jdLinkNotSupported')}
            </p>
          ) : trimmedJob.length > 0 && !usableJob ? (
            <p className="tiny">{t('jdTooShort')}</p>
          ) : usableJob ? (
            <p className="notice tiny" style={{ margin: 0 }}>
              {t('jdReady')}
            </p>
          ) : (
            <p className="tiny">{t('jdHint')}</p>
          )}

          <div className="row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canStart || building}
              onClick={start}
            >
              {building ? t('jdBuilding') : usableJob ? t('jdStartTailored') : t('customStart')}
            </button>
            <Link href="/" className="btn btn-quiet" style={{ textDecoration: 'none' }}>
              {t('back')}
            </Link>
          </div>

          {building && <p className="tiny">{t('jdBuildingHint')}</p>}
        </div>

        <p className="notice tiny" style={{ margin: 0 }}>
          {t('scoringPolicy')}
        </p>
      </div>
    </div>
  );
}
