'use client';

import { useState } from 'react';
import type { Attempt } from '@/lib/scoring';
import { reportPayloadFromAttempt } from '@/lib/saved-report';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { useLang } from './LanguageProvider';

type State = 'idle' | 'saving' | 'sent' | 'saved' | 'error';

const copy = {
  en: {
    title: 'Keep this report on another device',
    body: 'Email yourself a private sign-in link. We save the questions, scores and feedback for 90 days. We never save your full answers or video.',
    email: 'Email address',
    action: 'Email my private link',
    saving: 'Preparing your link…',
    sent: 'Check your email. Open the link on any device to claim this report.',
    saved: 'This report is saved. You can open it from My saved reports.',
    error: 'We could not send the link. Your report is still available in this browser. Try again later.',
    reports: 'My saved reports',
  },
  ar: {
    title: 'احتفظ بهذا التقرير على جهاز آخر',
    body: 'أرسل لنفسك رابط دخول خاصاً. نحفظ الأسئلة والدرجات والملاحظات لمدة 90 يوماً، ولا نحفظ إجاباتك الكاملة أو الفيديو.',
    email: 'البريد الإلكتروني',
    action: 'أرسل رابطاً خاصاً إلى بريدي',
    saving: 'جارٍ تجهيز الرابط…',
    sent: 'تحقق من بريدك وافتح الرابط على أي جهاز لحفظ هذا التقرير.',
    saved: 'تم حفظ التقرير. يمكنك فتحه من تقاريري المحفوظة.',
    error: 'تعذر إرسال الرابط. ما زال تقريرك متاحاً في هذا المتصفح. حاول لاحقاً.',
    reports: 'تقاريري المحفوظة',
  },
} as const;

export function SaveReportAcrossDevices({ attempt }: { attempt: Attempt }) {
  const { lang } = useLang();
  const c = copy[lang];
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'saving') return;
    setState('saving');

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, report: reportPayloadFromAttempt(attempt), website: '' }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.claimToken !== 'string') throw new Error('prepare');

      const supabase = createBrowserSupabaseClient();
      if (!supabase) throw new Error('configuration');
      const { data: userData } = await supabase.auth.getUser();

      if (userData.user?.email?.toLowerCase() === email.trim().toLowerCase()) {
        const claim = await fetch('/api/reports/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: result.claimToken }),
        });
        if (!claim.ok) throw new Error('claim');
        setState('saved');
        return;
      }

      const emailRedirectTo = `${window.location.origin}/auth/confirm?claim=${encodeURIComponent(result.claimToken)}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true, emailRedirectTo },
      });
      if (error) throw error;
      setState('sent');
    } catch {
      setState('error');
    }
  }

  return (
    <section className="save-report-card no-print" aria-labelledby="save-report-title">
      <h2 id="save-report-title">{c.title}</h2>
      <p className="muted">{c.body}</p>
      <form onSubmit={submit} className="save-report-form">
        <label htmlFor="report-email">{c.email}</label>
        <input
          id="report-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={state === 'saving' || state === 'sent' || state === 'saved'}
        />
        <button className="btn btn-primary" type="submit" disabled={state === 'saving' || state === 'sent' || state === 'saved'}>
          {state === 'saving' ? c.saving : c.action}
        </button>
      </form>
      {state === 'sent' && <p className="status-success" role="status">{c.sent}</p>}
      {state === 'saved' && <p className="status-success" role="status">{c.saved}</p>}
      {state === 'error' && <p className="status-error" role="alert">{c.error}</p>}
      <a className="text-link" href="/reports">{c.reports}</a>
    </section>
  );
}
