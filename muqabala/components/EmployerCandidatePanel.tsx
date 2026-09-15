'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Check, Play, X } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { markInterviewReviewed, recordDecision } from '@/app/employer/actions';
import { normaliseEmployerDecision, type DashboardDecision } from '@/lib/employer-dashboard';
import { track } from '@/lib/analytics';
import type { EmployerCandidateReviewPayload } from '@/lib/employer-review';
import { EmployerReportVideo } from './EmployerReportVideo';
import { useLang } from './LanguageProvider';
import styles from './EmployerCandidatePanel.module.css';

type OpenReview = (interviewId: string, candidateLabel: string, opener: HTMLElement) => void;
const ReviewPanelContext = createContext<OpenReview | null>(null);

type SelectedReview = { interviewId: string; candidateLabel: string };
type LoadState = 'loading' | 'ready' | 'error';
type SummaryState = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
export type EmployerSummaryPoint = { text: string; questionIndex: number; sourceLabel: string };

function formatDate(value: string, lang: 'en' | 'ar') {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function EmployerReviewPanelProvider({
  children,
  fixtureData,
  fixtureSummaryPoints,
}: {
  children: ReactNode;
  fixtureData?: EmployerCandidateReviewPayload;
  fixtureSummaryPoints?: EmployerSummaryPoint[];
}) {
  const { lang, t } = useLang();
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedReview | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [data, setData] = useState<EmployerCandidateReviewPayload | null>(null);
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState<DashboardDecision>(null);
  const [saving, setSaving] = useState<DashboardDecision>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [summaryReloadKey, setSummaryReloadKey] = useState(0);
  const [summaryState, setSummaryState] = useState<SummaryState>('idle');
  const [summaryPoints, setSummaryPoints] = useState<EmployerSummaryPoint[]>([]);
  const [summaryReported, setSummaryReported] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const scrollPositionRef = useRef({ x: 0, y: 0 });
  const trackedReviewsRef = useRef(new Set<string>());

  const openReview = useCallback<OpenReview>((interviewId, candidateLabel, opener) => {
    openerRef.current = opener;
    scrollPositionRef.current = { x: window.scrollX, y: window.scrollY };
    setSelected({ interviewId, candidateLabel });
    setLoadState('loading');
    setData(null);
    setNote('');
    setDecision(null);
    setSaving(null);
    setStatus('');
    setError('');
    setSummaryState('idle');
    setSummaryPoints([]);
    setSummaryReported(false);
  }, []);

  const close = useCallback(() => {
    if (note.trim() && !window.confirm(t('employerReviewUnsaved'))) return;
    setSelected(null);
    setData(null);
    setNote('');
    window.requestAnimationFrame(() => {
      openerRef.current?.focus({ preventScroll: true });
      window.scrollTo(scrollPositionRef.current.x, scrollPositionRef.current.y);
    });
  }, [note, t]);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selected]);

  useEffect(() => {
    if (!selected || !note.trim()) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [note, selected]);

  useEffect(() => {
    if (!selected) return;
    if (fixtureData) {
      setData(fixtureData);
      setDecision(normaliseEmployerDecision(fixtureData.currentDecision));
      setLoadState('ready');
      return;
    }
    const controller = new AbortController();
    setLoadState('loading');
    setError('');
    void fetch(`/api/employer/interviews/${encodeURIComponent(selected.interviewId)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as EmployerCandidateReviewPayload & { error?: string };
        if (!response.ok) throw new Error(body.error || 'load_failed');
        setData(body);
        setDecision(normaliseEmployerDecision(body.currentDecision));
        setLoadState('ready');
        if (!trackedReviewsRef.current.has(body.interviewId)) {
          trackedReviewsRef.current.add(body.interviewId);
          track('review_started', {
            role_id: body.roleId,
            duration_ms: Math.max(0, Date.now() - Date.parse(body.submittedAt)),
          });
        }
        if (!body.reviewedAt) {
          const marked = await markInterviewReviewed(body.interviewId);
          if ('error' in marked) setError(marked.error);
          else router.refresh();
        }
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setLoadState('error');
        setError(reason instanceof Error && reason.message !== 'load_failed'
          ? reason.message
          : t('employerReviewLoadFailed'));
      });
    return () => controller.abort();
  }, [fixtureData, reloadKey, router, selected, t]);

  useEffect(() => {
    if (!data || loadState !== 'ready') return;
    if (fixtureSummaryPoints) {
      setSummaryPoints(fixtureSummaryPoints);
      setSummaryState(fixtureSummaryPoints.length > 0 ? 'ready' : 'unavailable');
      return;
    }
    const controller = new AbortController();
    setSummaryState('loading');
    void fetch(`/api/employer/interviews/${encodeURIComponent(data.interviewId)}/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang }),
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json().catch(() => ({})) as { points?: EmployerSummaryPoint[]; unavailable?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error || 'summary_failed');
      const points = Array.isArray(body.points) ? body.points : [];
      setSummaryPoints(points);
      setSummaryState(body.unavailable || points.length === 0 ? 'unavailable' : 'ready');
    }).catch(() => {
      if (!controller.signal.aborted) setSummaryState('error');
    });
    return () => controller.abort();
  }, [data, fixtureSummaryPoints, lang, loadState, summaryReloadKey]);

  async function reportSummary() {
    if (!data || summaryReported) return;
    try {
      const response = await fetch(`/api/employer/interviews/${encodeURIComponent(data.interviewId)}/summary/feedback`, { method: 'POST' });
      if (!response.ok) throw new Error('report_failed');
      setSummaryReported(true);
      track('summary_inaccuracy_reported', { role_id: data.roleId });
    } catch {
      setError(t('employerActionInterrupted'));
    }
  }

  function onDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), summary, video[controls], [tabindex]:not([tabindex="-1"])',
    )].filter((element) => !element.hasAttribute('hidden') && element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function saveDecision(next: 'shortlist' | 'pass' | 'later') {
    if (!data || saving) return;
    const normalised: Exclude<DashboardDecision, null> = next === 'shortlist'
      ? 'shortlisted'
      : next === 'pass'
        ? 'not_proceeding'
        : 'hold';
    if (decision === normalised) return;
    setSaving(normalised);
    setStatus(t('employerSaving'));
    setError('');
    try {
      const result = await recordDecision({ interviewId: data.interviewId, decision: next, note });
      if ('error' in result) {
        setStatus('');
        setError(result.error);
        return;
      }
      setDecision(normalised);
      setNote('');
      setStatus(next === 'shortlist' ? t('employerAddedShortlist') : t('employerDecisionSaved'));
      router.refresh();
    } catch {
      setStatus('');
      setError(t('employerActionInterrupted'));
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  function onBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) close();
  }

  return (
    <ReviewPanelContext.Provider value={openReview}>
      {children}
      {selected && (
        <div className={styles.backdrop} onMouseDown={onBackdropMouseDown}>
          <div
            ref={dialogRef}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="candidate-review-title"
            aria-describedby="candidate-review-status"
            onKeyDown={onDialogKeyDown}
          >
            <header className={styles.header}>
              <div>
                <p>{t('employerReviewPanelTitle')}</p>
                <h2 id="candidate-review-title"><bdi dir="auto">{data?.displayName || selected.candidateLabel}</bdi></h2>
              </div>
              <button ref={closeRef} type="button" className={styles.close} onClick={close} aria-label={t('employerReviewClose')}>
                <X aria-hidden="true" />
              </button>
            </header>

            <div className={styles.scroll}>
              {loadState === 'loading' && (
                <div className={styles.loading} id="candidate-review-status" role="status" aria-live="polite" aria-busy="true">
                  <strong>{t('employerReviewLoading')}</strong>
                  <span /><span /><span />
                </div>
              )}

              {loadState === 'error' && (
                <div className={styles.failure} id="candidate-review-status" role="alert">
                  <p>{error || t('employerReviewLoadFailed')}</p>
                  <button type="button" onClick={() => setReloadKey((value) => value + 1)}>{t('employerReviewRetry')}</button>
                </div>
              )}

              {loadState === 'ready' && data && (
                <>
                  <section className={styles.summary} id="candidate-review-status">
                    <p><bdi dir="auto">{data.workplace}</bdi> · <bdi dir="auto">{data.roleTitle}</bdi></p>
                    <small>{t('employerReviewSubmitted')} {formatDate(data.submittedAt, lang)}</small>
                    <ul aria-label={t('employerRubricCoverage')}>
                      {data.coverage.items.map((item) => (
                        <li key={item.id} data-state={item.status}>
                          <span aria-hidden="true">{item.status === 'unavailable' ? '?' : item.covered ? '✓' : '×'}</span>
                          <bdi dir="auto">{lang === 'ar' ? item.labelAr : item.label}</bdi>
                          <span className={styles.srOnly}>
                            {item.status === 'unavailable'
                              ? t('employerAnalysisUnavailable')
                              : item.covered
                                ? t('employerEvidenceFound')
                                : t('employerEvidenceMissing')}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Link href={`/employer/candidates/${data.interviewId}/evaluation`} className={styles.evaluation}>
                      {t('employerViewEvaluation')}
                    </Link>
                  </section>

                  <section className={styles.answerSummary} aria-labelledby="answer-summary-title">
                    <div className={styles.answerSummaryHeading}>
                      <div><h3 id="answer-summary-title">{t('employerAnswerSummary')}</h3><small>{t('employerAnswerSummaryGenerated')}</small></div>
                      {summaryState === 'ready' && <button type="button" onClick={() => void reportSummary()} disabled={summaryReported}>{summaryReported ? t('employerAnswerSummaryReported') : t('employerAnswerSummaryReport')}</button>}
                    </div>
                    {summaryState === 'loading' && <p role="status" aria-busy="true">{t('employerAnswerSummaryLoading')}</p>}
                    {summaryState === 'unavailable' && <p>{t('employerAnswerSummaryUnavailable')}</p>}
                    {summaryState === 'error' && <div className={styles.summaryError} role="status"><p>{t('employerAnswerSummaryFailed')}</p><button type="button" onClick={() => setSummaryReloadKey((value) => value + 1)}>{t('employerAnswerSummaryRetry')}</button></div>}
                    {summaryState === 'ready' && <ul>{summaryPoints.map((point) => <li key={`${point.questionIndex}-${point.text}`}><p dir="auto">{point.text}</p><a href={`#candidate-answer-${point.questionIndex}`}>{point.sourceLabel}</a></li>)}</ul>}
                  </section>

                  <section className={styles.answers} aria-label={t('employerReviewPanelTitle')}>
                    {data.answers.map((answer, index) => (
                      <details id={`candidate-answer-${answer.questionIndex}`} className={styles.answer} key={answer.questionIndex} open={index === 0 || summaryPoints.some((point) => point.questionIndex === answer.questionIndex)}>
                        <summary>
                          <span>{index + 1}</span>
                          <bdi dir="auto">{answer.questionText}</bdi>
                        </summary>
                        <div>
                          {answer.hasVideo && (
                            <EmployerReportVideo
                              interviewId={data.interviewId}
                              questionIndex={answer.questionIndex}
                              durationSeconds={answer.durationSeconds}
                              label={`${t('question')} ${answer.questionIndex + 1}`}
                            />
                          )}
                          <p dir="auto">{answer.transcript || t('employerTranscriptMissing')}</p>
                          <small>{t('employerTranscriptNote')}</small>
                        </div>
                      </details>
                    ))}
                    {data.answers.length === 0 && <p className={styles.empty}>{t('employerReviewEmptyAnswers')}</p>}
                  </section>
                </>
              )}
            </div>

            {loadState === 'ready' && data && (
              <footer className={styles.footer}>
                <label>
                  <span className={styles.srOnly}>{t('employerOptionalNote')}</span>
                  <input
                    type="text"
                    maxLength={280}
                    value={note}
                    placeholder={t('employerOptionalNote')}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
                <div className={styles.decisions}>
                  <button type="button" data-kind="shortlist" aria-pressed={decision === 'shortlisted'} disabled={Boolean(saving) || decision === 'shortlisted'} onClick={() => void saveDecision('shortlist')}>
                    <Check aria-hidden="true" />{t('employerShortlist')}
                  </button>
                  <button type="button" aria-pressed={decision === 'not_proceeding'} disabled={Boolean(saving) || decision === 'not_proceeding'} onClick={() => void saveDecision('pass')}>
                    <X aria-hidden="true" />{t('employerNotProceeding')}
                  </button>
                  <button type="button" aria-pressed={decision === 'hold'} disabled={Boolean(saving) || decision === 'hold'} onClick={() => void saveDecision('later')}>
                    {t('employerHoldStatus')}
                  </button>
                </div>
                {(status || error) && <p role={error ? 'alert' : 'status'} className={error ? styles.error : styles.status}>{error || status}</p>}
              </footer>
            )}
          </div>
        </div>
      )}
    </ReviewPanelContext.Provider>
  );
}

export function EmployerReviewTrigger({
  interviewId,
  candidateLabel,
  className,
  children,
}: {
  interviewId: string;
  candidateLabel: string;
  className?: string;
  children?: ReactNode;
}) {
  const openReview = useContext(ReviewPanelContext);
  const { t } = useLang();
  return (
    <button
      type="button"
      className={className}
      onClick={(event) => openReview?.(interviewId, candidateLabel, event.currentTarget)}
      aria-label={`${t('employerReviewOpen')}: ${candidateLabel}`}
    >
      {children ?? <><Play aria-hidden="true" weight="fill" />{t('employerReviewOpen')}</>}
    </button>
  );
}
