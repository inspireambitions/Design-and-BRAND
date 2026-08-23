'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { StoredReport } from '@/lib/saved-report';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';

const copy = {
  en: {
    title: 'My saved reports', intro: 'Private reports you chose to keep. They are deleted automatically after 90 days.',
    email: 'Email address', send: 'Email me a sign-in link', sent: 'Check your email to finish signing in.',
    empty: 'You have no saved reports yet.', start: 'Start an interview', signOut: 'Sign out', delete: 'Delete report',
    deleting: 'Deleting…', error: 'Reports could not be loaded. Try again.', notScored: 'Not scored', question: 'Question',
    worked: 'What worked', improve: 'What to improve', expires: 'Available until', privacy: 'Full answers and video are not stored here.',
  },
  ar: {
    title: 'تقاريري المحفوظة', intro: 'تقارير خاصة اخترت الاحتفاظ بها، وتُحذف تلقائياً بعد 90 يوماً.',
    email: 'البريد الإلكتروني', send: 'أرسل رابط الدخول إلى بريدي', sent: 'تحقق من بريدك لإكمال تسجيل الدخول.',
    empty: 'لا توجد تقارير محفوظة بعد.', start: 'ابدأ مقابلة', signOut: 'تسجيل الخروج', delete: 'حذف التقرير',
    deleting: 'جارٍ الحذف…', error: 'تعذر تحميل التقارير. حاول مرة أخرى.', notScored: 'لم يتم التقييم', question: 'السؤال',
    worked: 'ما الذي نجح', improve: 'ما الذي يحتاج إلى تحسين', expires: 'متاح حتى', privacy: 'لا تُحفظ إجاباتك الكاملة أو الفيديو هنا.',
  },
} as const;

export function SavedReportsView() {
  const { lang } = useLang();
  const c = copy[lang];
  const [email, setEmail] = useState('');
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'sent' | 'error'>('loading');
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { setSignedIn(false); setStatus('error'); return; }
    const { data } = await supabase.auth.getUser();
    if (!data.user) { setSignedIn(false); setStatus('ready'); return; }
    setSignedIn(true);
    const response = await fetch('/api/reports', { cache: 'no-store' });
    if (!response.ok) { setStatus('error'); return; }
    const result = await response.json();
    setReports(Array.isArray(result.reports) ? result.reports : []);
    setStatus('ready');
  }

  useEffect(() => { void load(); }, []);

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { setStatus('error'); return; }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/confirm?next=/reports` },
    });
    setStatus(error ? 'error' : 'sent');
  }

  async function remove(id: string) {
    setDeleting(id);
    const response = await fetch(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (response.ok) setReports((current) => current.filter((report) => report.id !== id));
    else setStatus('error');
    setDeleting(null);
  }

  async function signOut() {
    await createBrowserSupabaseClient()?.auth.signOut();
    setReports([]); setSignedIn(false); setStatus('ready');
  }

  return (
    <div className="shell shell-narrow">
      <TopBar />
      <main className="stack-lg">
        <header><p className="eyebrow">Muqabala</p><h1>{c.title}</h1><p className="muted">{c.intro}</p></header>
        {signedIn === false && (
          <section className="card stack">
            <form className="save-report-form" onSubmit={sendLink}>
              <label htmlFor="saved-report-email">{c.email}</label>
              <input id="saved-report-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn btn-primary" type="submit">{c.send}</button>
            </form>
            {status === 'sent' && <p className="status-success" role="status">{c.sent}</p>}
          </section>
        )}
        {signedIn && <div className="row"><button className="btn btn-quiet" type="button" onClick={signOut}>{c.signOut}</button></div>}
        {status === 'error' && <p className="status-error" role="alert">{c.error}</p>}
        {signedIn && status === 'ready' && reports.length === 0 && <section className="card stack"><p>{c.empty}</p><Link href="/practice" className="btn btn-primary">{c.start}</Link></section>}
        {signedIn && reports.map((report) => (
          <article className="card stack saved-report" key={report.id}>
            <header><h2>{report.roleTitle}</h2><p className="muted">{report.overallScore === null ? c.notScored : `${report.overallScore}/100`} · {c.expires} {new Date(report.expiresAt).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-GB')}</p></header>
            <p className="tiny">{c.privacy}</p>
            {report.answers.map((answer, index) => (
              <details key={`${answer.questionId}-${index}`} className="report-answer">
                <summary className="report-answer-summary"><span className="report-question-number">{index + 1}</span><span className="report-answer-verdict"><span className="report-answer-label">{c.question} {index + 1}</span><strong dir="auto">{answer.headline}</strong></span><span className="report-answer-score">{answer.score === null ? c.notScored : `${answer.score}/100`}</span></summary>
                <div className="report-answer-body"><h3 dir="auto">{answer.questionText}</h3>{answer.strengths.length > 0 && <div><strong>{c.worked}</strong><ul>{answer.strengths.map((item) => <li key={item} dir="auto">{item}</li>)}</ul></div>}{answer.improvements.length > 0 && <div><strong>{c.improve}</strong><ul>{answer.improvements.map((item) => <li key={item} dir="auto">{item}</li>)}</ul></div>}</div>
              </details>
            ))}
            <button className="btn btn-quiet" type="button" disabled={deleting === report.id} onClick={() => void remove(report.id)}>{deleting === report.id ? c.deleting : c.delete}</button>
          </article>
        ))}
      </main>
    </div>
  );
}
