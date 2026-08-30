'use client';

import { useRef, useState } from 'react';
import { maskEmail, normalizeEmail } from '@/lib/practice-plan/schema';
import { track } from '@/lib/analytics';

type State = 'idle' | 'submitting' | 'validationError' | 'success' | 'alreadyRequested' | 'rateLimited' | 'retryableError';

const copy = {
  en: {
    title: 'Get your personalised 7-day practice plan',
    body: 'We will email the complete plan once. No account and no marketing list.',
    label: 'Email address',
    placeholder: 'you@example.com',
    submit: 'Email my 7-day plan',
    submitting: 'Queuing your plan…',
    invalid: 'Enter a valid email address.',
    success: (email: string) => `Your plan is queued for ${email}.`,
    already: (email: string) => `A plan has already been requested for this practice. It is queued for ${email}.`,
    limited: 'Too many requests. Your feedback remains available. Try again later.',
    retry: 'The plan could not be queued right now. Your feedback is safe. Try again.',
  },
  ar: {
    title: 'احصل على خطة تدريب شخصية لمدة 7 أيام',
    body: 'سنرسل الخطة كاملة في رسالة واحدة. لا حساب ولا قائمة تسويقية.',
    label: 'البريد الإلكتروني',
    placeholder: 'you@example.com',
    submit: 'أرسل خطة الأيام السبعة',
    submitting: 'جارٍ تجهيز طلبك…',
    invalid: 'أدخل عنوان بريد إلكتروني صحيحاً.',
    success: (email: string) => `تم إدراج خطتك للإرسال إلى ${email}.`,
    already: (email: string) => `طُلبت خطة لهذا التدريب من قبل. سيتم إرسالها إلى ${email}.`,
    limited: 'عدد الطلبات كبير الآن. ملاحظاتك ما زالت متاحة. حاول لاحقاً.',
    retry: 'تعذّر إدراج الخطة الآن. ملاحظاتك محفوظة. حاول مرة أخرى.',
  },
} as const;

export function PracticePlanCapture({ sessionId, sessionProof, locale }: {
  sessionId: string;
  sessionProof: string;
  locale: 'en' | 'ar';
}) {
  const c = copy[locale];
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [maskedEmail, setMaskedEmail] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const errorId = 'practice-plan-email-error';
  const statusId = 'practice-plan-email-status';
  const busy = state === 'submitting';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const normalized = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 320) {
      setState('validationError');
      return;
    }
    setState('submitting');
    try {
      const response = await fetch('/api/practice-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sessionProof,
          email: normalized,
          locale,
          clientRequestId: requestId.current,
          consentVersion: 'practice-plan-delivery-v1',
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 202) {
        setMaskedEmail(typeof result.maskedEmail === 'string' ? result.maskedEmail : maskEmail(normalized));
        setState(result.status === 'alreadyRequested' ? 'alreadyRequested' : 'success');
        track('practice_plan_requested', { lang: locale });
        return;
      }
      if (response.status === 429) setState('rateLimited');
      else if (response.status === 400) setState('validationError');
      else setState('retryableError');
    } catch {
      setState('retryableError');
    }
  }

  const error = state === 'validationError' ? c.invalid : state === 'rateLimited' ? c.limited : state === 'retryableError' ? c.retry : '';
  const status = state === 'success' ? c.success(maskedEmail) : state === 'alreadyRequested' ? c.already(maskedEmail) : '';

  return (
    <section className="card stack practice-plan-capture no-print" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} aria-labelledby="practice-plan-title">
      <div className="stack-sm">
        <p className="eyebrow">{locale === 'ar' ? 'خطوتك التالية' : 'Your next step'}</p>
        <h2 id="practice-plan-title">{c.title}</h2>
        <p className="muted">{c.body}</p>
      </div>
      <form className="stack-sm" onSubmit={submit} noValidate>
        <label htmlFor="practice-plan-email">{c.label}</label>
        <input
          id="practice-plan-email"
          className="input"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          dir="ltr"
          value={email}
          onChange={(event) => { setEmail(event.target.value); if (state === 'validationError') setState('idle'); }}
          placeholder={c.placeholder}
          aria-invalid={state === 'validationError' || undefined}
          aria-describedby={error ? errorId : status ? statusId : undefined}
          disabled={state === 'success' || state === 'alreadyRequested'}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || state === 'success' || state === 'alreadyRequested'}>
          {busy ? c.submitting : c.submit}
        </button>
      </form>
      <div aria-live="polite" aria-atomic="true">
        {error && <p id={errorId} className="notice notice-warn" role="alert">{error}</p>}
        {status && <p id={statusId} className="notice">{status}</p>}
      </div>
    </section>
  );
}
