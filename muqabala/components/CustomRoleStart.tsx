'use client';

import Link from 'next/link';
import { useState } from 'react';
import { buildCustomRole, type Role } from '@/lib/roles';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';
import { InterviewFlow, type InterviewMode } from './InterviewFlow';

const MIN_JOB_TEXT_CHARS = 120;
const MAX_JOB_TEXT_CHARS = 12_000;

/** Someone pasted a link instead of the advert text. */
function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) || (/^www\.\S+$/i.test(trimmed) && !trimmed.includes(' '));
}

export function CustomRoleStart() {
  const { t, lang } = useLang();
  const [title, setTitle] = useState('');
  const [jobText, setJobText] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [tailored, setTailored] = useState(false);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [fellBack, setFellBack] = useState(false);
  const [building, setBuilding] = useState(false);
  const [mode, setMode] = useState<InterviewMode | null>(null);

  if (role && mode) {
    const selectedRole = mode === 'guided' ? { ...role, questions: role.questions.slice(0, 5) } : role;
    return (
      <InterviewFlow
        role={selectedRole}
        customTitle={role.title}
        tailored={tailored}
        fellBack={fellBack}
        interviewToken={token}
        mode={mode}
      />
    );
  }

  if (role) {
    return (
      <div className="shell shell-narrow">
        <TopBar showProgressLink={false} />
        <div className="stack-lg question-reveal">
          <div>
            <p className="eyebrow">{t('questionRevealEyebrow')}</p>
            <h1 style={{ fontSize: '1.75rem' }}>{t('questionRevealTitle')}</h1>
            <p className="lede" style={{ marginTop: '0.6rem' }}>{t('questionRevealBody')}</p>
            <span className={`chip ${tailored ? 'chip-gold' : ''}`} style={{ marginTop: '0.7rem' }}>
              {tailored ? t('tailoredBadge') : t('genericBadge')}
            </span>
            {fellBack && !tailored && (
              <p className="notice notice-warn tiny" style={{ marginTop: '0.7rem' }}>{t('genericWhy')}</p>
            )}
          </div>

          <div className="practice-paths">
            <section className="card stack mode-card mode-card-featured">
              <div>
                <p className="eyebrow">{t('guidedLabel')}</p>
                <h2 style={{ fontSize: '1.35rem' }}>{t('guidedTitle')}</h2>
                <p className="muted" style={{ marginTop: '0.45rem' }}>{t('guidedBody')}</p>
              </div>
              <ol className="question-list">
                {role.questions.slice(0, 5).map((question, index) => (
                  <li key={question.id}>
                    <span>{index + 1}</span>
                    {lang === 'ar' ? question.textAr : question.text}
                  </li>
                ))}
              </ol>
              <button type="button" className="btn btn-primary" onClick={() => setMode('guided')}>
                {t('guidedCta')}
              </button>
            </section>

            <section className="card stack mode-card">
              <div>
                <p className="eyebrow">{t('mockLabel')}</p>
                <h2 style={{ fontSize: '1.35rem' }}>{t('mockTitle')}</h2>
                <p className="muted" style={{ marginTop: '0.45rem' }}>{t('mockBody')}</p>
              </div>
              <ul className="mode-facts">
                <li>{t('mockFactQuestions')}</li>
                <li>{t('mockFactFeedback')}</li>
                <li>{t('mockFactTime')}</li>
              </ul>
              <button type="button" className="btn btn-quiet" onClick={() => setMode('mock')}>
                {t('mockCta')}
              </button>
            </section>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setRole(null);
              setMode(null);
              setToken(undefined);
              setTailored(false);
              setFellBack(false);
            }}
          >
            {t('changeJobAdvert')}
          </button>
        </div>
      </div>
    );
  }

  const trimmedTitle = title.trim();
  const trimmedJob = jobText.trim();
  const pastedLink = looksLikeUrl(trimmedJob);
  const usableJob = !pastedLink && trimmedJob.length >= MIN_JOB_TEXT_CHARS;
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
      // They pasted an advert but we could not build from it — say so.
      setFellBack(usableJob && !data.tailored);
      setRole(data.role);
    } catch {
      // Never strand the candidate: fall back to the generic interview.
      setTailored(false);
      setFellBack(usableJob);
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
              maxLength={120}
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
              maxLength={MAX_JOB_TEXT_CHARS}
              placeholder={t('jdPlaceholder')}
              onChange={(e) => setJobText(e.target.value)}
            />
            <span className="tiny" style={{ textAlign: 'end' }}>
              {jobText.length.toLocaleString()} / {MAX_JOB_TEXT_CHARS.toLocaleString()} {t('jdCount')}
            </span>
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
