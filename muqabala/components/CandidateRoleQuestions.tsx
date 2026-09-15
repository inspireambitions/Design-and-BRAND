'use client';

import { useEffect, useState } from 'react';
import { useLang } from './LanguageProvider';
import { track } from '@/lib/analytics';
import styles from './CandidateRoleQuestions.module.css';

type Answer = {
  supported: boolean;
  answer: string;
  sourceHref: string | null;
  sourceLabel: string | null;
  canEscalate: boolean;
};

type HistoryItem = {
  id: string;
  question_text: string;
  reply_text: string | null;
  replied_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

export function CandidateRoleQuestions({
  publicCode,
  roleTitle,
  location,
  expiresAt,
  timezone,
  questionCount,
  fixtureMode = false,
}: {
  publicCode: string;
  roleTitle: string;
  location: string | null;
  expiresAt: string;
  timezone: string;
  questionCount: number;
  fixtureMode?: boolean;
}) {
  const { lang, t } = useLang();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (fixtureMode) return;
    const controller = new AbortController();
    void fetch(`/api/screening/roles/${encodeURIComponent(publicCode)}/questions`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : null)
      .then((body) => { if (body?.questions) setHistory(body.questions); })
      .catch(() => {});
    return () => controller.abort();
  }, [fixtureMode, publicCode]);

  async function ask(value = question) {
    const clean = value.trim();
    if (clean.length < 4 || busy) return;
    setQuestion(clean);
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/screening/roles/${encodeURIComponent(publicCode)}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: clean, lang, escalate: false }),
      });
      const body = await response.json().catch(() => ({})) as Answer & { error?: string };
      if (!response.ok || !body.answer) throw new Error(body.error || 'unavailable');
      setAnswer(body);
      track('candidate_question_answered', { outcome: body.supported ? 'supported' : 'unsupported' });
    } catch {
      setAnswer({ supported: false, answer: t('candidateRoleQuestionFailed'), sourceHref: null, sourceLabel: null, canEscalate: true });
    } finally {
      setBusy(false);
    }
  }

  async function escalate() {
    if (question.trim().length < 4 || sending) return;
    setSending(true);
    setMessage('');
    try {
      const response = await fetch(`/api/screening/roles/${encodeURIComponent(publicCode)}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), lang, escalate: true }),
      });
      const body = await response.json().catch(() => ({})) as { queued?: boolean; duplicate?: boolean; id?: string; createdAt?: string; error?: string };
      if (!response.ok || !body.queued) throw new Error(body.error || 'send_failed');
      setMessage(body.duplicate ? t('candidateRoleQuestionDuplicate') : t('candidateRoleQuestionQueued'));
      track('candidate_question_escalated', { outcome: body.duplicate ? 'duplicate' : 'queued' });
      if (!body.duplicate && body.id) {
        setHistory((current) => [{ id: body.id!, question_text: question.trim(), reply_text: null, replied_at: null, resolved_at: null, created_at: body.createdAt || new Date().toISOString() }, ...current]);
      }
    } catch {
      setMessage(t('candidateRoleQuestionFailed'));
    } finally {
      setSending(false);
    }
  }

  const closes = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE' : 'en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: timezone,
  }).format(new Date(expiresAt));

  return (
    <details className={styles.questions}>
      <summary>{t('candidateRoleQuestionsTitle')}</summary>
      <div className={styles.body}>
        <p>{t('candidateRoleQuestionsBody')}</p>
        <dl className={styles.facts} id="role-facts">
          <div><dt>{lang === 'ar' ? 'الوظيفة' : 'Role'}</dt><dd dir="auto">{roleTitle}</dd></div>
          <div><dt>{lang === 'ar' ? 'الموقع' : 'Location'}</dt><dd dir="auto">{location || (lang === 'ar' ? 'لم يُنشر' : 'Not published')}</dd></div>
          <div><dt>{lang === 'ar' ? 'الإغلاق' : 'Closes'}</dt><dd>{closes} · {timezone}</dd></div>
          <div><dt>{lang === 'ar' ? 'الصيغة' : 'Format'}</dt><dd>{questionCount} {lang === 'ar' ? 'أسئلة فيديو' : 'video questions'}</dd></div>
        </dl>
        <div className={styles.suggestions} aria-label={t('candidateRoleQuestionLabel')}>
          {[t('candidateRoleQuestionDeadline'), t('candidateRoleQuestionFormat'), t('candidateRoleQuestionLocation')].map((suggestion) => (
            <button type="button" key={suggestion} onClick={() => void ask(suggestion)}>{suggestion}</button>
          ))}
        </div>
        <label className={styles.field}>
          <span>{t('candidateRoleQuestionLabel')}</span>
          <textarea maxLength={500} rows={3} dir="auto" value={question} placeholder={t('candidateRoleQuestionPlaceholder')} onChange={(event) => { setQuestion(event.target.value); setAnswer(null); setMessage(''); }} />
        </label>
        <button className={styles.primary} type="button" disabled={busy || question.trim().length < 4} onClick={() => void ask()}>{busy ? t('candidateRoleQuestionChecking') : t('candidateRoleQuestionAsk')}</button>
        {answer && (
          <div className={styles.answer} role="status">
            <p dir="auto">{answer.answer}</p>
            {answer.sourceHref && answer.sourceLabel && <a href={answer.sourceHref}>{t('candidateRoleQuestionSource')}: {answer.sourceLabel}</a>}
            {answer.canEscalate && <>
              <p className={styles.review}>{t('candidateRoleQuestionReview')}</p>
              <button type="button" className={styles.secondary} disabled={sending} onClick={() => void escalate()}>{t('candidateRoleQuestionSend')}</button>
            </>}
          </div>
        )}
        {message && <p role="status" className={styles.message}>{message}</p>}
        {history.length > 0 && <section className={styles.history} aria-labelledby="candidate-question-history">
          <h3 id="candidate-question-history">{t('candidateRoleQuestionHistory')}</h3>
          {history.map((item) => <article key={item.id}>
            <p dir="auto">{item.question_text}</p>
            <small>{item.reply_text ? t('candidateRoleQuestionReplied') : t('candidateRoleQuestionWaiting')}</small>
            {item.reply_text && <blockquote dir="auto">{item.reply_text}</blockquote>}
          </article>)}
        </section>}
      </div>
    </details>
  );
}
