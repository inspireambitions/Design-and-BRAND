'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { browserStores, recordEmailConsent, recordEmailDeclined } from '@/lib/landing/email-consent';
import { looksLikeEmail } from '@/lib/landing/interview-pack';
import { useLang } from '../LanguageProvider';

/**
 * The one-time email ask on the advert path. Both routes out of it continue
 * to the interview: the email is optional and never blocks generation.
 *
 * Rendered inline in place of the paste box, never as a pop-up. Focus moves to
 * the email field on mount so keyboard and screen reader users are not left on
 * a control that has just disappeared.
 */
export function InterviewPackAsk({ onContinue }: { onContinue: () => void }) {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const errorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = async () => {
    const trimmed = email.trim();
    if (!looksLikeEmail(trimmed)) {
      setError(t('landingPackInvalidEmail'));
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setSending(true);
    try {
      const response = await fetch('/api/interview-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'advert_pack' }),
      });
      if (response.ok) {
        recordEmailConsent(browserStores().local, 'advert_pack');
        void import('@/lib/analytics').then(({ track }) => track('email_submitted', { source: 'advert_pack' }));
      }
    } catch {
      // The pack is a bonus. A failed request must never hold up the interview.
    } finally {
      setSending(false);
      onContinue();
    }
  };

  const skip = () => {
    recordEmailDeclined(browserStores().session);
    onContinue();
  };

  return (
    <form
      className="card stack landing-pack"
      aria-labelledby={headingId}
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <div className="stack-sm">
        <h2 id={headingId} className="landing-pack-heading">{t('landingPackHeading')}</h2>
        <p className="muted" style={{ margin: 0 }}>{t('landingPackBody')}</p>
      </div>

      <div className="landing-pack-row">
        <label className="landing-pack-field" htmlFor="interview-pack-email">
          <span className="eyebrow" style={{ marginBottom: 0 }}>{t('landingPackEmailLabel')}</span>
          <input
            ref={inputRef}
            id="interview-pack-email"
            className="text-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            enterKeyHint="send"
            dir="ltr"
            value={email}
            placeholder={t('landingPackEmailPlaceholder')}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(null);
            }}
          />
        </label>
        <button type="submit" className="btn btn-primary landing-pack-send" disabled={sending}>
          {sending ? t('landingPackSending') : t('landingPackSend')}
        </button>
      </div>

      {error && (
        <p id={errorId} className="notice notice-warn tiny" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}

      <p className="tiny" style={{ margin: 0 }}>{t('landingPackConsent')}</p>

      <button type="button" className="landing-link-btn" disabled={sending} onClick={skip}>
        {t('landingPackShowHere')}
      </button>
    </form>
  );
}
