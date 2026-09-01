'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { buildCustomRole, type Role } from '@/lib/roles';
import { takeHeroDraft } from '@/lib/hero-draft';
import { focusedQuestionFromRole } from '@/lib/focused-question';
import { loadLatestCustomInterviewDraft } from '@/lib/session-draft';
import { trackTiming } from '@/lib/analytics';
import { advertUsable, looksLikeUrl } from '@/lib/landing/advert-text';
import { browserStores, shouldAskForEmail } from '@/lib/landing/email-consent';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';
import { InterviewFlow } from './InterviewFlow';
import { InterviewPackAsk } from './landing/InterviewPackAsk';

/** Use a representative five-question subset for guided practice. */
function guidedRole(fullRole: Role): Role {
  if (fullRole.questions.length < 8) return fullRole;
  const questions = fullRole.questions;
  return {
    ...fullRole,
    questions: [questions[0], questions[1], questions[3], questions[5], questions.at(-1)!],
  };
}

export function CustomRoleStart({ focusQuestionId, initialLanguage }: { focusQuestionId?: string; initialLanguage?: 'en' | 'ar' }) {
  const { lang, setLang, t } = useLang();
  const [title, setTitle] = useState('');
  const [jobText, setJobText] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [tailored, setTailored] = useState(false);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [fellBack, setFellBack] = useState(false);
  const [building, setBuilding] = useState(false);
  const [fromTemplate, setFromTemplate] = useState(false);
  const [askingForEmail, setAskingForEmail] = useState(false);
  const draftHandled = useRef(false);

  useEffect(() => {
    if (initialLanguage && lang !== initialLanguage) setLang(initialLanguage);
  }, [initialLanguage, lang, setLang]);

  const startWith = async (titleArg: string, jobArg: string) => {
    const usable = advertUsable(jobArg);
    setBuilding(true);
    const startedAt = performance.now();
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
      // The role name read from the advert becomes the interview's title, so
      // the saved draft and history are filed under it rather than a generic
      // "custom" label.
      if (data.tailored && data.role.title) setTitle(data.role.title);
      setRole(data.role);
      if (usable) {
        trackTiming('advert_to_first_question_ms', performance.now() - startedAt, {
          outcome: data.tailored ? 'tailored' : 'fallback',
        });
      }
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
    const params = new URLSearchParams(window.location.search);
    const templateId = params.get('template');
    const resumeId = params.get('resume');
    const sourceId = templateId || resumeId;
    if (sourceId) {
      setFromTemplate(Boolean(templateId));
      setBuilding(true);
      fetch(`/api/interviews/${encodeURIComponent(sourceId)}/report`, { cache: 'no-store' })
        .then(async (response) => response.ok ? response.json() : null)
        .then((report) => {
          if (!report || !Array.isArray(report.questionSnapshot) || report.questionSnapshot.length === 0) return;
          const restored = report.roleSnapshot && Array.isArray(report.roleSnapshot.questions)
            ? report.roleSnapshot as Role
            : buildCustomRole(report.roleTitle || t('customTitle'));
          setTitle(report.roleTitle || '');
          setTailored(Boolean(report.tailored));
          setToken(typeof report.interviewToken === 'string' ? report.interviewToken : undefined);
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
    if (advertUsable(job)) {
      void startWith(draft.jobTitle.trim(), job);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, t]);

  if (role) {
    const guided = guidedRole(role);
    const focusedQuestion = focusedQuestionFromRole(role, fromTemplate ? focusQuestionId : undefined);
    return (
      <InterviewFlow
        role={guided}
        mockQuestions={role.questions.length >= 8 ? role.questions : undefined}
        customTitle={role.title}
        tailored={tailored}
        fellBack={fellBack}
        interviewToken={token}
        initialLanguage={initialLanguage}
        ignoreLocalDraft={fromTemplate}
        focusQuestionId={fromTemplate ? focusQuestionId : undefined}
        focusedQuestion={focusedQuestion}
      />
    );
  }

  const trimmedTitle = title.trim();
  const trimmedJob = jobText.trim();
  const pastedLink = looksLikeUrl(trimmedJob);
  const usableJob = advertUsable(trimmedJob);
  const canStart = trimmedTitle.length >= 2 || usableJob;

  const start = () => {
    // Pasting an advert here, rather than on /practice, gets the same single
    // email ask before anything is generated.
    if (usableJob && shouldAskForEmail(browserStores())) {
      setAskingForEmail(true);
      return;
    }
    void startWith(trimmedTitle, trimmedJob);
  };

  // A tailored build in progress: the page is headed by the job, not the form.
  if (building && usableJob) {
    return (
      <div className="shell shell-narrow">
        <TopBar showProgressLink={false} />
        <div className="stack">
          <div>
            <p className="eyebrow">{t('landingBuildingEyebrow')}</p>
            <h1 style={{ fontSize: '1.75rem' }}>
              {trimmedTitle.length >= 2 ? trimmedTitle : t('landingBuildingTitle')}
            </h1>
            <p className="lede" style={{ marginTop: '0.6rem' }} role="status" aria-live="polite">
              {t('jdBuilding')}
            </p>
          </div>
          <p className="notice tiny" style={{ margin: 0 }}>{t('jdBuildingHint')}</p>
        </div>
      </div>
    );
  }

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

        {askingForEmail ? (
          <InterviewPackAsk
            onContinue={() => {
              setAskingForEmail(false);
              void startWith(trimmedTitle, trimmedJob);
            }}
          />
        ) : (
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
        )}

        <p className="notice tiny" style={{ margin: 0 }}>
          {t('scoringPolicy')}
        </p>
      </div>
    </div>
  );
}
