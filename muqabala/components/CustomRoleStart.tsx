'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { buildCustomRole, type Role } from '@/lib/roles';
import { takeHeroDraft } from '@/lib/hero-draft';
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
  const [fellBack, setFellBack] = useState(false);
  const [building, setBuilding] = useState(false);
  const draftHandled = useRef(false);

  const startWith = async (titleArg: string, jobArg: string) => {
    const usable = !looksLikeUrl(jobArg) && jobArg.length >= 120;
    setBuilding(true);
    try {
      const response = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: titleArg,
          jobText: usable ? jobArg : '',
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { role: Role; tailored: boolean; token?: string };
      setTailored(Boolean(data.tailored));
      setToken(data.token);
      // They pasted an advert but we could not build from it — say so.
      setFellBack(usable && !data.tailored);
      setRole(data.role);
    } catch {
      // Never strand the candidate: fall back to the generic interview.
      setTailored(false);
      setFellBack(usable);
      setRole(buildCustomRole(titleArg));
    } finally {
      setBuilding(false);
    }
  };

  // A draft handed over from the landing-page advert form: prefill, and when
  // the advert is complete enough to tailor from, start building immediately.
  useEffect(() => {
    if (draftHandled.current) return;
    draftHandled.current = true;
    const draft = takeHeroDraft();
    if (!draft) return;
    setTitle(draft.jobTitle);
    setJobText(draft.jobText);
    const job = draft.jobText.trim();
    if (!looksLikeUrl(job) && job.length >= 120) {
      void startWith(draft.jobTitle.trim(), job);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (role) {
    return (
      <InterviewFlow
        role={role}
        customTitle={role.title}
        tailored={tailored}
        fellBack={fellBack}
        interviewToken={token}
      />
    );
  }

  const trimmedTitle = title.trim();
  const trimmedJob = jobText.trim();
  const pastedLink = looksLikeUrl(trimmedJob);
  const usableJob = !pastedLink && trimmedJob.length >= 120;
  const canStart = trimmedTitle.length >= 2 || usableJob;

  const start = () => startWith(trimmedTitle, trimmedJob);

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
