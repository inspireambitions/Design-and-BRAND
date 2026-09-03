'use client';

import { useEffect, useRef, useState } from 'react';
import { takeHeroDraft } from '@/lib/hero-draft';
import type {
  CoverageStatus,
  DiscoveredCompetency,
  ExperienceLevel,
  FinalFeedback,
  GeneratedQuestion,
} from '@/lib/universal-interview/types';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';
import { UniversalVideoAnswer } from './UniversalVideoAnswer';

type Stage = 'SETUP' | 'CONFIRM' | 'INTERVIEW' | 'FEEDBACK_LOADING' | 'FEEDBACK' | 'DELETED';

type DiscoverResponse = {
  interview_id: string;
  role_summary: string;
  competencies: DiscoveredCompetency[];
  suggested_competency_ids: string[];
  notice: string;
};

type InterviewResponse = {
  interview_id: string;
  phase: 'AWAITING_CONFIRMATION' | 'ACTIVE' | 'COMPLETE';
  question_number: number;
  question_total: number;
  current_question: GeneratedQuestion | null;
  coverage: Record<string, { status: CoverageStatus; evidence_ids: string[] }>;
  retry_used: boolean;
  role_pack: { found: boolean; assessment_type: 'COMPETENCY' | 'PRACTICAL' | 'PORTFOLIO'; technical_accuracy_verified: boolean };
  action?: string;
};

type FeedbackResponse = FinalFeedback & { retry_question_text?: string };

type RetryResponse = {
  question_number: number;
  before: Record<string, CoverageStatus>;
  after: Record<string, CoverageStatus>;
  feedback: FinalFeedback['competencies'];
};

const SAVED_INTERVIEW_KEY = 'muqabala.universalInterview.v2';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!response.ok) throw new Error(data?.error?.message || '');
  return data as T;
}

export function UniversalInterview() {
  const { t } = useLang();
  const [stage, setStage] = useState<Stage>('SETUP');
  const [targetRole, setTargetRole] = useState('');
  const [level, setLevel] = useState<ExperienceLevel>('PROFESSIONAL');
  const [years, setYears] = useState(3);
  const [previousRole, setPreviousRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [careerChange, setCareerChange] = useState(false);
  const [managementExperience, setManagementExperience] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [discovery, setDiscovery] = useState<DiscoverResponse | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [interview, setInterview] = useState<InterviewResponse | null>(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null);
  const [retryAnswer, setRetryAnswer] = useState('');
  const [retryResult, setRetryResult] = useState<RetryResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    const restore = async () => {
      const savedId = window.localStorage.getItem(SAVED_INTERVIEW_KEY);
      if (savedId) {
        try {
          const response = await fetch(`/api/universal-interview/${encodeURIComponent(savedId)}`, { cache: 'no-store' });
          if (response.ok) {
            const restored = await response.json() as {
              interview: InterviewResponse;
              discovery: DiscoverResponse;
              feedback: FeedbackResponse | null;
              retry_result: RetryResponse | null;
            };
            setDiscovery(restored.discovery);
            setSelected(restored.discovery.suggested_competency_ids);
            setInterview(restored.interview);
            setRetryResult(restored.retry_result);
            if (restored.interview.phase === 'AWAITING_CONFIRMATION') setStage('CONFIRM');
            if (restored.interview.phase === 'ACTIVE') setStage('INTERVIEW');
            if (restored.interview.phase === 'COMPLETE' && restored.feedback) {
              setFeedback(restored.feedback);
              setStage('FEEDBACK');
            } else if (restored.interview.phase === 'COMPLETE') {
              setStage('FEEDBACK_LOADING');
              await loadFeedback(restored.interview.interview_id);
            }
            return;
          }
        } catch {
          // A saved interview must never prevent a fresh start.
        }
        window.localStorage.removeItem(SAVED_INTERVIEW_KEY);
      }
      const draft = takeHeroDraft();
      if (!draft) return;
      setTargetRole(draft.jobTitle);
      setJobDescription(draft.jobText);
    };
    void restore();
  }, []);

  const loadFeedback = async (interviewId: string) => {
    const result = await postJson<FeedbackResponse>('/api/universal-interview/feedback', { interview_id: interviewId });
    setFeedback(result);
    setStage('FEEDBACK');
  };

  const buildBlueprint = async () => {
    if (targetRole.trim().length < 2) return;
    setBusy(true);
    setError('');
    try {
      const result = await postJson<DiscoverResponse>('/api/universal-interview/discover', {
        profile: {
          experience_level: level,
          years_experience: years,
          current_or_previous_role: previousRole,
          target_role: targetRole,
          industry_background: industry,
          career_change: careerChange,
          management_experience: managementExperience,
          language: 'en',
        },
        job_description: jobDescription,
      });
      setDiscovery(result);
      window.localStorage.setItem(SAVED_INTERVIEW_KEY, result.interview_id);
      setSelected(result.suggested_competency_ids);
      setStage('CONFIRM');
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : t('brainError'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!discovery || selected.length !== 5) return;
    setBusy(true);
    setError('');
    try {
      const result = await postJson<InterviewResponse>('/api/universal-interview/confirm', {
        interview_id: discovery.interview_id,
        competency_ids: selected,
      });
      setInterview(result);
      setStage('INTERVIEW');
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : t('brainError'));
    } finally {
      setBusy(false);
    }
  };

  const sendAnswer = async () => {
    if (!interview || !answer.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await postJson<InterviewResponse>('/api/universal-interview/turn', {
        interview_id: interview.interview_id,
        answer,
      });
      setInterview(result);
      setAnswer('');
      if (result.phase === 'COMPLETE') {
        setStage('FEEDBACK_LOADING');
        await loadFeedback(result.interview_id);
      }
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : t('brainError'));
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    if (!interview || !feedback || !retryAnswer.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await postJson<RetryResponse>('/api/universal-interview/retry', {
        interview_id: interview.interview_id,
        question_number: feedback.retry_recommended_question,
        answer: retryAnswer,
      });
      setRetryResult(result);
      setInterview({ ...interview, retry_used: true });
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : t('brainError'));
    } finally {
      setBusy(false);
    }
  };

  const deleteData = async () => {
    if (!interview && !discovery) return;
    if (!window.confirm(t('brainDeleteConfirm'))) return;
    const interviewId = interview?.interview_id ?? discovery!.interview_id;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/universal-interview/${encodeURIComponent(interviewId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(t('brainError'));
      setStage('DELETED');
      window.localStorage.removeItem(SAVED_INTERVIEW_KEY);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : t('brainError'));
    } finally {
      setBusy(false);
    }
  };

  const competencyName = (id: string) => discovery?.competencies.find((item) => item.id === id)?.name ?? id;
  const displayBand = (band: FinalFeedback['competencies'][number]['band']) => band;

  const startNew = () => {
    window.localStorage.removeItem(SAVED_INTERVIEW_KEY);
    window.location.reload();
  };

  return (
    <main className="shell shell-narrow universal-brain">
      <TopBar showProgressLink={false} />

      {stage !== 'DELETED' && <header className="stack-sm">
        <p className="eyebrow">{t('brainEyebrow')}</p>
        <h1>{t('brainTitle')}</h1>
        <p className="lede">{t('brainBody')}</p>
        <p className="notice tiny">{t('brainEnglishOnly')}</p>
      </header>}

      {error && <p ref={errorRef} className="notice notice-warn" role="alert" tabIndex={-1}>{error}</p>}

      {stage === 'SETUP' && <form className="card stack" onSubmit={(event) => { event.preventDefault(); void buildBlueprint(); }}>
        <label className="stack-sm" htmlFor="brain-target-role">
          <span className="rate-label">{t('brainTargetRole')}</span>
          <input id="brain-target-role" className="text-input" value={targetRole} maxLength={120} required
            placeholder={t('brainTargetPlaceholder')} onChange={(event) => setTargetRole(event.target.value)} />
        </label>
        <div className="brain-form-grid">
          <label className="stack-sm" htmlFor="brain-level">
            <span className="rate-label">{t('brainExperienceLevel')}</span>
            <select id="brain-level" className="text-input" value={level} onChange={(event) => setLevel(event.target.value as ExperienceLevel)}>
              <option value="ENTRY">{t('brainEntry')}</option>
              <option value="PROFESSIONAL">{t('brainProfessional')}</option>
              <option value="MANAGER">{t('brainManager')}</option>
              <option value="SENIOR_MANAGER">{t('brainSeniorManager')}</option>
              <option value="EXECUTIVE">{t('brainExecutive')}</option>
            </select>
          </label>
          <label className="stack-sm" htmlFor="brain-years">
            <span className="rate-label">{t('brainYears')}</span>
            <input id="brain-years" className="text-input" type="number" min={0} max={60} value={years}
              onChange={(event) => setYears(Math.max(0, Math.min(60, Number(event.target.value))))} />
          </label>
        </div>
        <div className="brain-form-grid">
          <label className="stack-sm" htmlFor="brain-previous-role">
            <span className="rate-label">{t('brainPreviousRole')}</span>
            <input id="brain-previous-role" className="text-input" value={previousRole} maxLength={120}
              onChange={(event) => setPreviousRole(event.target.value)} />
          </label>
          <label className="stack-sm" htmlFor="brain-industry">
            <span className="rate-label">{t('brainIndustry')}</span>
            <input id="brain-industry" className="text-input" value={industry} maxLength={120}
              onChange={(event) => setIndustry(event.target.value)} />
          </label>
        </div>
        <div className="brain-check-row">
          <label><input type="checkbox" checked={careerChange} onChange={(event) => setCareerChange(event.target.checked)} /> {t('brainCareerChange')}</label>
          <label><input type="checkbox" checked={managementExperience} onChange={(event) => setManagementExperience(event.target.checked)} /> {t('brainManagementExperience')}</label>
        </div>
        <label className="stack-sm" htmlFor="brain-jd">
          <span className="rate-label">{t('brainJobDescription')}</span>
          <textarea id="brain-jd" className="answer-box" value={jobDescription} maxLength={20000}
            onChange={(event) => setJobDescription(event.target.value)} />
          <span className="tiny">{t('brainJobDescriptionHint')}</span>
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy || targetRole.trim().length < 2}>
          {busy ? t('brainBuildingBlueprint') : t('brainBuildBlueprint')}
        </button>
      </form>}

      {stage === 'CONFIRM' && discovery && <section className="card stack" aria-labelledby="brain-confirm-heading">
        <div>
          <h2 id="brain-confirm-heading">{t('brainConfirmTitle')}</h2>
          <p className="muted">{t('brainConfirmBody')}</p>
        </div>
        <p className="notice tiny">{discovery.notice}</p>
        <div className="brain-competency-list">
          {discovery.competencies.map((competency) => {
            const checked = selected.includes(competency.id);
            return <label key={competency.id} className={checked ? 'brain-competency selected' : 'brain-competency'}>
              <input type="checkbox" checked={checked} disabled={!checked && selected.length >= 5}
                onChange={(event) => setSelected((current) => event.target.checked
                  ? [...current, competency.id]
                  : current.filter((id) => id !== competency.id))} />
              <span><strong>{competency.name}</strong><small>{competency.source === 'EXPLICIT' ? competency.source_text : competency.family}</small></span>
            </label>;
          })}
        </div>
        <p className="tiny">{selected.length}/5 · {selected.length !== 5 ? t('brainChooseFive') : discovery.role_summary}</p>
        <button type="button" className="btn btn-primary" disabled={busy || selected.length !== 5} onClick={() => void confirm()}>
          {busy ? t('brainPlanning') : t('brainConfirmBlueprint')}
        </button>
      </section>}

      {stage === 'INTERVIEW' && interview?.current_question && <section className="stack-lg">
        {interview.role_pack.assessment_type !== 'COMPETENCY' && <p className="notice tiny">
          {interview.role_pack.assessment_type === 'PRACTICAL' ? t('brainPracticalCaveat') : t('brainPortfolioCaveat')}
        </p>}
        <div className="flow-progress" aria-label={`${t('brainQuestion')} ${interview.question_number} of ${interview.question_total}`}>
          {Array.from({ length: interview.question_total }, (_, index) => <span key={index} className={index < interview.question_number ? 'done' : ''} />)}
        </div>
        <div className="card stack">
          <p className="eyebrow">{t('brainQuestion')} {interview.question_number} / {interview.question_total}</p>
          <h2 className="brain-question">{interview.current_question.text}</h2>
          <UniversalVideoAnswer
            key={`${interview.question_number}:${interview.current_question.text}`}
            disabled={busy}
            onTranscript={setAnswer}
          />
          <label className="stack-sm" htmlFor="brain-answer">
            <span className="rate-label">{t('brainAnswerLabel')}</span>
            <textarea id="brain-answer" className="answer-box brain-answer" value={answer}
              placeholder={t('brainAnswerPlaceholder')} onChange={(event) => setAnswer(event.target.value)} />
          </label>
          <button type="button" className="btn btn-primary" disabled={busy || !answer.trim()} onClick={() => void sendAnswer()}>
            {busy ? t('brainReadingAnswer') : t('brainSendAnswer')}
          </button>
        </div>
      </section>}

      {stage === 'FEEDBACK_LOADING' && <section className="card stack" aria-live="polite">
        <h2>{t('brainPreparingFeedback')}</h2>
        <p className="muted">{t('brainReadingAnswer')}</p>
      </section>}

      {stage === 'FEEDBACK' && feedback && interview && <section className="stack-lg" aria-labelledby="brain-feedback-heading">
        <div className="card stack">
          <p className="eyebrow">{t('brainCoverage')}</p>
          <h2 id="brain-feedback-heading">{t('brainFeedbackTitle')}</h2>
          {feedback.competencies.map((competency) => <article key={competency.id} className="brain-feedback-block stack-sm">
            <div className="row-between"><h3>{competencyName(competency.id)}</h3><span className="chip chip-jade">{displayBand(competency.band)}</span></div>
            {competency.what_worked && <p><strong>{t('brainWhatWorked')}:</strong> {competency.what_worked}</p>}
            {competency.what_is_missing && <p><strong>{t('brainWhatMissing')}:</strong> {competency.what_is_missing}</p>}
            <p><strong>{t('brainImprove')}:</strong> {competency.improve_this}</p>
          </article>)}
          <div className="notice"><strong>{t('brainHighestImprovement')}</strong><p>{feedback.single_highest_value_improvement}</p></div>
          {feedback.caveats.map((caveat) => <p key={caveat} className="tiny">{caveat}</p>)}
        </div>

        {!interview.retry_used && !retryResult && <div className="card stack">
          <div><p className="eyebrow">{t('brainRetryTitle')}</p><h3>{t('brainQuestion')} {feedback.retry_recommended_question}</h3></div>
          <p className="muted">{feedback.retry_question_text || t('brainRetryBody')}</p>
          <UniversalVideoAnswer key={`retry:${feedback.retry_recommended_question}`} disabled={busy} onTranscript={setRetryAnswer} />
          <textarea className="answer-box" value={retryAnswer} placeholder={t('brainAnswerPlaceholder')}
            onChange={(event) => setRetryAnswer(event.target.value)} />
          <button type="button" className="btn btn-primary" disabled={busy || !retryAnswer.trim()} onClick={() => void retry()}>
            {busy ? t('brainRetrying') : t('brainRetrySend')}
          </button>
        </div>}

        {retryResult && <div className="card stack">
          <h3>{t('brainQuestion')} {retryResult.question_number}</h3>
          {Object.keys(retryResult.after).map((id) => <div key={id} className="row-between brain-before-after">
            <strong>{competencyName(id)}</strong>
            <span>{t('brainBefore')}: {retryResult.before[id]} · {t('brainAfter')}: {retryResult.after[id]}</span>
          </div>)}
          {retryResult.feedback.map((item) => <p key={item.id}><strong>{t('brainImprove')}:</strong> {item.improve_this}</p>)}
        </div>}

        <div className="row">
          <button type="button" className="btn btn-primary" onClick={startNew}>{t('brainStartNew')}</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void deleteData()}>{t('brainDeleteData')}</button>
        </div>
      </section>}

      {stage === 'DELETED' && <section className="card stack">
        <h1>{t('brainDeleted')}</h1>
        <button type="button" className="btn btn-primary" onClick={startNew}>{t('brainStartNew')}</button>
      </section>}
    </main>
  );
}
