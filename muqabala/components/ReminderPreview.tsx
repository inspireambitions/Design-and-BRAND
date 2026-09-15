'use client';

import { useEffect, useMemo, useState } from 'react';
import { CopyButton } from './CopyButton';
import { useLang } from './LanguageProvider';
import { track } from '@/lib/analytics';
import styles from './ReminderPreview.module.css';

type Recipient = {
  id: string;
  name: string | null;
  email: string | null;
  eligible: boolean;
  reason: string | null;
  deliveryStatus?: string | null;
};

export type ReminderPreviewData = {
  recipients: Recipient[];
  eligibleCount: number;
  configured: boolean;
  publicLinkFallback: boolean;
  publicUrl: string;
  defaultMessage: string;
  delivery: { queued: number; accepted: number; delivered: number; failed: number; cancelled: number };
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
};

const COPY = {
  en: {
    open: 'Preview reminder', title: 'Preview reminder', body: 'Review recipients and the exact message before anything is queued.',
    loading: 'Checking current eligibility…', failed: 'Reminder eligibility could not be loaded.', retry: 'Retry',
    recipients: 'Recipients', deselect: 'Deselect anyone who should not receive this reminder.', excluded: 'Excluded',
    channel: 'Email', message: 'Message', linkNote: 'Each email receives the candidate’s existing private invitation link.',
    send: 'Send reminders', sending: 'Queueing reminders…', copy: 'Copy reminder', copied: 'Reminder copied.',
    manual: 'Muqabala cannot identify non-submitters from a public link. Copy this reusable reminder and share it manually.',
    missing: 'Automated email is not configured. Nothing will be marked sent; use the copy action.',
    queued: 'reminders queued', skipped: 'became ineligible before dispatch', delivery: 'Delivery status on this page', close: 'Close preview',
    retryFailed: 'Select failed recipients',
    previous: 'Previous recipients', next: 'Next recipients', page: 'Page', of: 'of',
  },
  ar: {
    open: 'معاينة التذكير', title: 'معاينة التذكير', body: 'راجع المستلمين والرسالة الدقيقة قبل إضافة أي شيء إلى قائمة الإرسال.',
    loading: 'جارٍ التحقق من الأهلية الحالية…', failed: 'تعذر تحميل أهلية التذكير.', retry: 'إعادة المحاولة',
    recipients: 'المستلمون', deselect: 'ألغِ تحديد أي شخص لا ينبغي أن يتلقى هذا التذكير.', excluded: 'مستبعد',
    channel: 'البريد الإلكتروني', message: 'الرسالة', linkNote: 'يتلقى كل بريد رابط الدعوة الخاص بالمرشح.',
    send: 'إرسال التذكيرات', sending: 'جارٍ إدراج التذكيرات…', copy: 'نسخ التذكير', copied: 'تم نسخ التذكير.',
    manual: 'لا يمكن لمقابلة معرفة من لم يرسل عبر رابط عام. انسخ هذا التذكير وشاركه يدوياً.',
    missing: 'الإرسال الآلي عبر البريد غير مُعدّ. لن يظهر أي إرسال؛ استخدم النسخ.',
    queued: 'تذكيرات أُدرجت', skipped: 'لم يعودوا مؤهلين قبل الإرسال', delivery: 'حالة التسليم في هذه الصفحة', close: 'إغلاق المعاينة',
    retryFailed: 'تحديد المستلمين الذين فشل إرسالهم',
    previous: 'المستلمون السابقون', next: 'المستلمون التاليون', page: 'صفحة', of: 'من',
  },
} as const;

export function ReminderPreview({ roleId, initialData }: { roleId: string; initialData?: ReminderPreviewData }) {
  const { lang } = useLang();
  const c = COPY[lang];
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ReminderPreviewData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error' | 'sending'>('idle');
  const [result, setResult] = useState('');
  const [reload, setReload] = useState(0);
  const [batchKey, setBatchKey] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setData(initialData);
      setSelected(new Set(initialData.recipients.filter((recipient) => recipient.eligible).map((recipient) => recipient.id)));
      setMessage(initialData.defaultMessage.replace('{{invitation_link}}', initialData.publicUrl));
      setBatchKey(crypto.randomUUID());
      setState('ready');
      return;
    }
    const controller = new AbortController();
    setState('loading');
    void fetch(`/api/employer/roles/${encodeURIComponent(roleId)}/reminders?page=${page}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as ReminderPreviewData & { error?: string };
        if (!response.ok || !body.recipients) throw new Error(body.error || 'load_failed');
        setData(body);
        setSelected(new Set(body.recipients.filter((recipient) => recipient.eligible).map((recipient) => recipient.id)));
        setMessage(body.defaultMessage.replace('{{invitation_link}}', body.publicUrl));
        setBatchKey(crypto.randomUUID());
        setState('ready');
      })
      .catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [initialData, open, page, reload, roleId]);

  const eligible = useMemo(() => data?.recipients.filter((recipient) => recipient.eligible) ?? [], [data]);
  const excluded = useMemo(() => data?.recipients.filter((recipient) => !recipient.eligible) ?? [], [data]);
  const selectedCount = selected.size;

  async function send() {
    if (!data?.configured || selectedCount === 0 || state === 'sending') return;
    setState('sending');
    setResult('');
    try {
      const response = await fetch(`/api/employer/roles/${encodeURIComponent(roleId)}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteIds: [...selected], message: message.replace(data.publicUrl, '{{invitation_link}}'), batchKey }),
      });
      const body = await response.json().catch(() => ({})) as { queued?: number; skipped?: number; error?: string };
      if (!response.ok || typeof body.queued !== 'number') throw new Error(body.error || 'send_failed');
      setResult(`${body.queued} ${c.queued}${body.skipped ? ` · ${body.skipped} ${c.skipped}` : ''}.`);
      track('reminder_batch_queued', { role_id: roleId, count: body.queued, outcome: body.skipped ? 'partially_queued' : 'queued' });
      setSelected(new Set());
      setState('ready');
      setReload((value) => value + 1);
    } catch (error) {
      setResult(error instanceof Error ? error.message : c.failed);
      setState('ready');
    }
  }

  if (!open) return <button type="button" className={styles.open} onClick={() => { track('reminder_preview_opened', { role_id: roleId }); setOpen(true); }}>{c.open}</button>;

  return (
    <section className={styles.preview} aria-labelledby="reminder-preview-title">
      <header><div><h3 id="reminder-preview-title">{c.title}</h3><p>{c.body}</p></div><button type="button" onClick={() => setOpen(false)} aria-label={c.close}>×</button></header>
      {state === 'loading' && <p role="status" aria-busy="true">{c.loading}</p>}
      {state === 'error' && <div role="alert"><p>{c.failed}</p><button type="button" onClick={() => setReload((value) => value + 1)}>{c.retry}</button></div>}
      {data && (state === 'ready' || state === 'sending') && <>
        {data.publicLinkFallback && <p className={styles.notice}>{c.manual}</p>}
        {!data.configured && <p className={styles.notice}>{c.missing}</p>}
        {eligible.length > 0 && <fieldset className={styles.recipients}><legend>{c.recipients} · {selectedCount}</legend><p>{c.deselect}</p>{eligible.map((recipient) => <label key={recipient.id}><input type="checkbox" checked={selected.has(recipient.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(recipient.id); else next.delete(recipient.id); return next; })} /><span><bdi dir="auto">{recipient.name || 'Candidate'}</bdi><small>{recipient.email}{recipient.deliveryStatus ? ` · ${recipient.deliveryStatus}` : ''}</small></span></label>)}</fieldset>}
        {eligible.some((recipient) => recipient.deliveryStatus === 'failed' || recipient.deliveryStatus === 'cancelled') && <button type="button" onClick={() => setSelected(new Set(eligible.filter((recipient) => recipient.deliveryStatus === 'failed' || recipient.deliveryStatus === 'cancelled').map((recipient) => recipient.id)))}>{c.retryFailed}</button>}
        {excluded.length > 0 && <details className={styles.excluded}><summary>{c.excluded} · {excluded.length}</summary>{excluded.map((recipient) => <p key={recipient.id}><bdi dir="auto">{recipient.name || recipient.email || 'Candidate'}</bdi> - {recipient.reason}</p>)}</details>}
        <dl className={styles.meta}><div><dt>{c.channel}</dt><dd>Email</dd></div><div><dt>{c.delivery}</dt><dd>{data.delivery.queued} queued · {data.delivery.accepted} accepted · {data.delivery.delivered} delivered · {data.delivery.failed} failed</dd></div></dl>
        {data.pagination && data.pagination.totalPages > 1 && <nav className={styles.pagination} aria-label={c.recipients}><button type="button" disabled={page <= 1 || state === 'sending'} onClick={() => { setResult(''); setPage((value) => Math.max(1, value - 1)); }}>{c.previous}</button><span>{c.page} {data.pagination.page} {c.of} {data.pagination.totalPages} · {data.pagination.total} {c.recipients.toLocaleLowerCase()}</span><button type="button" disabled={page >= data.pagination.totalPages || state === 'sending'} onClick={() => { setResult(''); setPage((value) => value + 1); }}>{c.next}</button></nav>}
        <label className={styles.message}><span>{c.message}</span><textarea rows={8} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} /></label>
        <p className={styles.linkNote}>{c.linkNote}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.send} disabled={!data.configured || selectedCount === 0 || state === 'sending'} onClick={() => void send()}>{state === 'sending' ? c.sending : `${c.send} · ${selectedCount}`}</button>
          <CopyButton value={message} label={c.copy} successLabel={c.copied} />
        </div>
        {result && <p role="status" className={styles.result}>{result}</p>}
      </>}
    </section>
  );
}
