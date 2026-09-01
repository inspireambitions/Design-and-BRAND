'use client';

import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { t, type Lang } from '@/lib/i18n';
import {
  loadConsentState,
  recordAsked,
  recordConsent,
  recordDecline,
  saveConsentState,
  shouldAskForEmail,
  updateConsentState,
  type ConsentSource,
} from '@/lib/practice-plan/ask-policy';
import { CONSENT_VERSION, normalizeEmail, PLAN_MODES, type PlanMode } from '@/lib/practice-plan/schema';

type State = 'idle' | 'submitting' | 'invalid' | 'sent' | 'limited' | 'unavailable';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DONE_DELAY_MS = 2_500;

export type KeepFeedbackCardProps = {
  roleId: string;
  questionId: string;
  /** Lets the email carry the candidate's own feedback when the server can confirm they own the interview. */
  interviewId?: string;
  lang: Lang;
  source: ConsentSource;
  /**
   * Called when the card has finished: straight away on "Continue without
   * saving", and shortly after "Sent. Check your inbox." has been shown.
   */
  onDone: () => void;
  /** Mode for the daily deep links. Falls back to the page's `mode` query parameter, then to typing. */
  mode?: PlanMode;
};

function modeFromLocation(): PlanMode {
  if (typeof window === 'undefined') return 'type';
  const value = new URLSearchParams(window.location.search).get('mode');
  return PLAN_MODES.includes(value as PlanMode) ? (value as PlanMode) : 'type';
}

/**
 * Inline card shown directly under the first full feedback. Self-gating: it
 * reads the shared consent record and renders nothing when the candidate has
 * already been asked this session, has consented, or declined recently.
 */
export function KeepFeedbackCard({ roleId, questionId, interviewId, lang, source, onDone, mode }: KeepFeedbackCardProps) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const requestId = useRef<string | null>(null);
  const doneTimer = useRef<number | null>(null);
  const ar = lang === 'ar';

  useEffect(() => {
    const current = loadConsentState();
    if (!shouldAskForEmail(current, Date.now())) return;
    saveConsentState(recordAsked(current));
    setVisible(true);
  }, []);

  useEffect(() => () => {
    if (doneTimer.current !== null) window.clearTimeout(doneTimer.current);
  }, []);

  if (!visible) return null;

  const busy = state === 'submitting';
  const errorId = 'keep-feedback-error';

  function decline() {
    updateConsentState((current) => recordDecline(current, Date.now()));
    onDone();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || state === 'sent') return;
    const normalised = normalizeEmail(email);
    if (!EMAIL.test(normalised) || normalised.length > 320) {
      setState('invalid');
      return;
    }
    requestId.current ??= crypto.randomUUID();
    setState('submitting');
    try {
      const response = await fetch('/api/practice-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleId,
          questionId,
          ...(interviewId && UUID.test(interviewId) ? { interviewId } : {}),
          email: normalised,
          locale: lang,
          mode: mode ?? modeFromLocation(),
          clientRequestId: requestId.current,
          consentVersion: CONSENT_VERSION,
          consentSource: source,
        }),
      });
      if (response.status === 202) {
        updateConsentState((current) => recordConsent(current, source, Date.now()));
        track('email_submitted', { source, role_id: roleId, lang });
        setState('sent');
        doneTimer.current = window.setTimeout(onDone, DONE_DELAY_MS);
        return;
      }
      if (response.status === 429) setState('limited');
      else if (response.status === 400) setState('invalid');
      else setState('unavailable');
    } catch {
      setState('unavailable');
    }
  }

  if (state === 'sent') {
    return (
      <section className="card stack-sm keep-feedback-card no-print" lang={lang} dir={ar ? 'rtl' : 'ltr'} aria-live="polite">
        <p className="notice" role="status"><strong>{t(lang, 'keepSent')}</strong></p>
      </section>
    );
  }

  const error = state === 'invalid'
    ? t(lang, 'keepInvalid')
    : state === 'limited'
      ? t(lang, 'keepLimited')
      : state === 'unavailable'
        ? t(lang, 'keepUnavailable')
        : '';

  return (
    <section
      className="card stack keep-feedback-card no-print"
      lang={lang}
      dir={ar ? 'rtl' : 'ltr'}
      aria-labelledby="keep-feedback-title"
      aria-busy={busy}
    >
      <div className="stack-sm">
        <h2 id="keep-feedback-title" style={{ fontSize: '1.35rem' }}>{t(lang, 'keepTitle')}</h2>
        <p className="muted">{t(lang, 'keepBody')}</p>
      </div>
      <form className="stack-sm" onSubmit={submit} noValidate>
        <label className="stack-sm" htmlFor="keep-feedback-email">
          <span className="rate-label">{t(lang, 'keepEmailLabel')}</span>
        </label>
        <input
          id="keep-feedback-email"
          className="answer-box"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          dir="ltr"
          value={email}
          onChange={(event) => { setEmail(event.target.value); if (state === 'invalid') setState('idle'); }}
          placeholder="you@example.com"
          aria-invalid={state === 'invalid' || undefined}
          aria-describedby={error ? errorId : undefined}
          disabled={busy}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !email}>
          {busy ? t(lang, 'keepSending') : t(lang, 'keepSend')}
        </button>
        {error && <p id={errorId} className="notice notice-warn tiny" role="alert">{error}</p>}
        <p className="tiny">{t(lang, 'keepPrivacy')}</p>
        <button type="button" className="btn btn-ghost" onClick={decline} disabled={busy} style={{ alignSelf: ar ? 'flex-end' : 'flex-start' }}>
          {t(lang, 'keepSkip')}
        </button>
      </form>
    </section>
  );
}
