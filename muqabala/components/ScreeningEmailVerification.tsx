'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { probeScreeningRecordingStore } from '@/lib/screening-draft-store';
import { useLang } from './LanguageProvider';
import styles from './EmployerVideoInterview.module.css';

type Props = {
  publicCode: string;
  companyName: string;
  roleTitle: string;
  roleTitleAr: string;
  availability: 'active' | 'full' | 'closed';
  inviteToken?: string;
  initialError?: string;
};

export function ScreeningEmailVerification({ publicCode, companyName, roleTitle, roleTitleAr, availability, inviteToken, initialError }: Props) {
  const router = useRouter();
  const { lang, setLang, dir } = useLang();
  const codeRef = useRef<HTMLInputElement | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [resumingFullLink, setResumingFullLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(initialError ?? '');

  useEffect(() => {
    void probeScreeningRecordingStore().then((durable) => {
      setSupported(Boolean(durable && typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined'));
    });
  }, []);

  const copy = lang === 'ar' ? {
    invited: 'مقابلة من جهة العمل', title: 'تحقق من بريدك قبل التسجيل',
    body: 'سنرسل رمزاً من ستة أرقام. هذا يؤكد أن المقابلة تخصك ويساعدك على العودة إذا انقطع الرفع.',
    privacy: 'سيصل تأكيد الإرسال إلى هذا البريد. لن يظهر بريدك لجهة العمل في هذه الخطوة.',
    email: 'البريد الإلكتروني', send: 'إرسال الرمز', sending: 'جارٍ الإرسال…',
    code: 'الرمز المكوّن من ستة أرقام', verify: 'تحقق وتابع', checking: 'جارٍ فحص هذا الجهاز…',
    unsupported: 'افتح هذا الرابط في Safari العادي على iPhone أو Chrome على Android قبل المتابعة.',
    sent: 'تم إرسال الرمز. أبقِ هذه الصفحة مفتوحة وأدخل الرمز أدناه.',
    full: 'وصل هذا الرابط إلى الحد الأقصى لعدد المرشحين.', closed: 'أغلقت جهة العمل رابط المقابلة أمام المرشحين الجدد.', alreadyStarted: 'بدأت المقابلة من قبل',
    changeEmail: 'تغيير البريد الإلكتروني', resend: 'إعادة إرسال الرمز',
  } : {
    invited: 'Employer interview', title: 'Verify your email before recording',
    body: 'We will send a six-digit code. This confirms the interview belongs to you and helps you return if an upload is interrupted.',
    privacy: 'Your submission confirmation will go to this email. Your email is not shown to the employer at this stage.',
    email: 'Email address', send: 'Send 6-digit code', sending: 'Sending…',
    code: 'Six-digit code', verify: 'Verify and continue', checking: 'Checking this device…',
    unsupported: 'Open this link in normal Safari on iPhone or Chrome on Android before continuing.',
    sent: 'Code sent. Keep this page open and enter the code below.',
    full: 'This link has reached its candidate limit.', closed: 'The employer has closed this interview link to new candidates.', alreadyStarted: 'I already started this interview',
    changeEmail: 'Change email', resend: 'Resend code',
  };

  const showVerification = availability === 'active' || resumingFullLink;

  async function requestCode() {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/screening/auth/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, publicCode, lang, ...(inviteToken ? { inviteToken } : {}) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'The code could not be sent.');
      setSent(true); setMessage(copy.sent); window.setTimeout(() => codeRef.current?.focus(), 0);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The code could not be sent.'); }
    finally { setBusy(false); }
  }

  async function verifyCode() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/screening/auth/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: code, publicCode, lang, ...(inviteToken ? { inviteToken } : {}) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'The code could not be verified.');
      router.replace(body.next || `/s/${publicCode}`); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The code could not be verified.'); }
    finally { setBusy(false); }
  }

  return (
    <main className={styles.page} dir={dir}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Muqabala home"><span className={styles.mark} aria-hidden="true">م</span><span>Muqabala</span></a>
        <button type="button" className={styles.language} onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>{lang === 'en' ? 'العربية' : 'English'}</button>
      </header>
      <div className={styles.shell}>
        <div className={styles.context}><span>{copy.invited}</span><strong dir="auto">{companyName}</strong><span aria-hidden="true">·</span><strong dir="auto">{lang === 'ar' ? roleTitleAr : roleTitle}</strong></div>
        <section className={styles.card}>
          <p className={styles.eyebrow}>{companyName}</p>
          <h1>{supported === null ? copy.checking : supported ? copy.title : copy.unsupported}</h1>
          {supported && !showVerification && <>
            <p className={styles.lede}>{availability === 'closed' ? copy.closed : copy.full}</p>
            <button className={styles.secondary} type="button" onClick={() => setResumingFullLink(true)}>{copy.alreadyStarted}</button>
          </>}
          {supported && showVerification && <>
            <p className={styles.lede}>{copy.body}</p><div className={styles.assurance}>{copy.privacy}</div>
            {!sent && <form className={styles.verifyForm} onSubmit={(event) => { event.preventDefault(); void requestCode(); }}>
              <label className={styles.field}><span>{copy.email}</span><input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
              <button className={styles.primary} type="submit" disabled={busy || !email}>{busy ? copy.sending : copy.send}</button>
            </form>}
            {sent && <form className={styles.verifyForm} onSubmit={(event) => { event.preventDefault(); void verifyCode(); }}>
              <p className={styles.footnote}>{copy.sent} <strong>{email.replace(/(^.).*(@.*$)/, '$1•••$2')}</strong></p>
              <label className={styles.field}><span>{copy.code}</span><input ref={codeRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" /></label>
              <button className={styles.primary} type="submit" disabled={busy || code.length !== 6}>{copy.verify}</button>
              <button className={styles.secondary} type="button" disabled={busy} onClick={() => { setSent(false); setCode(''); setMessage(''); setError(''); }}>{copy.changeEmail}</button>
              <button className={styles.secondary} type="button" disabled={busy} onClick={() => void requestCode()}>{copy.resend}</button>
            </form>}
            {message && !sent && <div className={styles.savedBanner} role="status">{message}</div>}
            {error && <div className={styles.error} role="alert">{error}</div>}
          </>}
        </section>
      </div>
    </main>
  );
}
