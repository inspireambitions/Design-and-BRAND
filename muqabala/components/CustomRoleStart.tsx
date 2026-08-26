'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { buildCustomRole, type Role } from '@/lib/roles';
import { takeHeroDraft } from '@/lib/hero-draft';
import { loadLatestCustomInterviewDraft } from '@/lib/session-draft';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';
import { InterviewFlow } from './InterviewFlow';

/** Someone pasted a link instead of the advert text. */
function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) || (/^www\.\S+$/i.test(trimmed) && !trimmed.includes(' '));
}

/** Use a representative five-question subset for guided practice. */
function guidedRole(fullRole: Role): Role {
  if (fullRole.questions.length < 8) return fullRole;
  const questions = fullRole.questions;
  return {
    ...fullRole,
    questions: [questions[0], questions[1], questions[3], questions[5], questions.at(-1)!],
  };
}

export function CustomRoleStart() {
  const { lang, t } = useLang();
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
      let candidateSession = window.sessionStorage.getItem('muqabala.candidate.v1');
      if (!candidateSession) {
        candidateSession = window.crypto.randomUUID();
        window.sessionStorage.setItem('muqabala.candidate.v1', candidateSession);
      }
      const response = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Candidate-Session': candidateSession },
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
    const resumeId = new URLSearchParams(window.location.search).get('resume');
    if (resumeId) {
      setBuilding(true);
      fetch(`/api/interviews/${encodeURIComponent(resumeId)}/report`, { cache: 'no-store' })
        .then(async (response) => response.ok ? response.json() : null)
        .then((report) => {
          if (!report || !Array.isArray(report.questionSnapshot) || report.questionSnapshot.length === 0) return;
          const restored = buildCustomRole(report.roleTitle || t('customTitle'));
          setTitle(report.roleTitle || '');
          setRole({ ...restored, questions: report.questionSnapshot });
        })
        .catch(() => {})
        .finally(() => setBuilding(false));
      return;
    }

    const saved = loadLatestCustomInterviewDraft(window.localStorage);
    if (saved) {
      const restored = buildCustomRole(saved.customTitle || t('customTitle'));
      setTitle(saved.customTitle || '');
      setTailored(saved.tailored);
      setFellBack(saved.fellBack);
      setToken(saved.interviewToken);
      setRole({ ...restored, questions: saved.questionSnapshot });
      return;
    }

    const draft = takeHeroDraft();
    if (!draft) return;
    setTitle(draft.jobTitle);
    setJobText(draft.jobText);
    const job = draft.jobText.trim();
    if (!looksLikeUrl(job) && job.length >= 120) {
      void startWith(draft.jobTitle.trim(), job);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, t]);

  if (role) {
    const guided = guidedRole(role);
    return (
      <InterviewFlow
        role={guided}
        mockQuestions={role.questions.length >= 8 ? role.questions : undefined}
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
            <Link href="/practice" className="btn btn-quiet" style={{ textDecoration: 'none' }}>
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
