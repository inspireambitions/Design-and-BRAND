'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from './LanguageProvider';

export function EmailSignIn({ next = '/account', compact = false }: { next?: string; compact?: boolean }) {
  const router = useRouter();
  const { lang, t } = useLang();
  const codeRef = useRef<HTMLInputElement | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [hasError, setHasError] = useState(false);

  async function requestCode() {
    setBusy(true);
    setMessage('');
    setHasError(false);
    try {
      const response = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, next, lang }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setHasError(true);
        return setMessage(data.error || t('emailRequestFailed'));
      }
      setSent(true);
      setMessage(t('checkInbox'));
      window.setTimeout(() => codeRef.current?.focus(), 0);
    } catch {
      setHasError(true);
      setMessage(t('emailRequestFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setMessage('');
    setHasError(false);
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: code, next, lang }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setHasError(true);
        return setMessage(data.error || t('emailVerifyFailed'));
      }
      router.push(data.next || next);
      router.refresh();
    } catch {
      setHasError(true);
      setMessage(t('emailVerifyFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? 'stack-sm' : 'card stack'} aria-busy={busy}>
      {!compact && <h1 style={{ fontSize: '1.6rem' }}>{t('signInTitle')}</h1>}
      <p className="muted">{t('signInBody')}</p>
      <form className="stack-sm" onSubmit={(event) => { event.preventDefault(); void requestCode(); }}>
        <label className="stack-sm">
          <span className="rate-label">{t('emailAddress')}</span>
          <input
            className="answer-box"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <p className="tiny">{t('emailServiceNotice')}</p>
        <button className="btn btn-primary" type="submit" disabled={busy || !email}>
          {busy ? t('sending') : sent ? t('sendNewCode') : t('sendSignInCode')}
        </button>
      </form>
      {sent && (
        <form className="stack-sm" onSubmit={(event) => { event.preventDefault(); void verifyCode(); }}>
          <label className="stack-sm">
            <span className="rate-label">{t('sixDigitCode')}</span>
            <input
              ref={codeRef}
              className="answer-box"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
            />
          </label>
          <button className="btn btn-quiet" type="submit" disabled={busy || code.length !== 6}>
            {t('verifyContinue')}
          </button>
        </form>
      )}
      {message && <p className="notice tiny" role={hasError ? 'alert' : 'status'}>{message}</p>}
      <p className="tiny">{t('emailDeliveryHelp')}</p>
    </div>
  );
}
