'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  parseContacts,
  resolveContacts,
  summaryLine,
  type Contact,
  type InvalidRow,
  type ParseResult,
} from '@/lib/employer-volume/contacts';
import styles from './AddCandidates.module.css';

type Channel = 'email' | 'whatsapp' | 'both';

type SentSummary = { sent: number; byEmail: number; byWhatsApp: number; duplicates: number; invalid: number };

const REASON_COPY: Record<InvalidRow['reason'], string> = {
  no_contact: 'No email or phone number found',
  bad_email: 'This email address does not look right',
  bad_phone: 'Phone numbers need a country code, such as +971',
};

export function AddCandidates({
  roleId,
  roleTitle,
  workplace,
  closed,
  whatsApp,
}: {
  roleId: string;
  roleTitle: string;
  workplace: string;
  closed: boolean;
  whatsApp: boolean;
}) {
  const [text, setText] = useState('');
  const [csv, setCsv] = useState<{ name: string; content: string } | null>(null);
  const [fixes, setFixes] = useState<Record<number, string>>({});
  const [channel, setChannel] = useState<Channel | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<SentSummary | null>(null);

  const parsed: ParseResult = useMemo(() => {
    const base = csv ? parseContacts(csv.content, 'csv') : parseContacts(text, 'text');
    const fixedRows = Object.entries(fixes)
      .map(([, value]) => value.trim())
      .filter(Boolean)
      .map((value) => (value.includes('@') ? { raw: value, email: value } : { raw: value, phone: value }));
    if (fixedRows.length === 0) return base;
    const merged = resolveContacts([
      ...base.valid.map((contact) => ({ raw: '', email: contact.email ?? undefined, phone: contact.phone ?? undefined, name: contact.name ?? undefined })),
      ...fixedRows,
    ]);
    return {
      found: base.found,
      duplicates: base.duplicates + merged.duplicates,
      invalid: [...base.invalid.filter((row) => !fixes[row.index]?.trim()), ...merged.invalid],
      valid: merged.valid,
    };
  }, [text, csv, fixes]);

  const hasPhone = parsed.valid.some((contact) => contact.phone);
  const effectiveChannel: Channel = whatsApp ? (channel ?? (hasPhone ? 'both' : 'email')) : 'email';
  const canSend = parsed.valid.length > 0 && !sending && !closed;

  async function onFile(file: File | undefined) {
    if (!file) return;
    const content = await file.text();
    setCsv({ name: file.name, content });
    setFixes({});
  }

  async function send() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/employer/roles/${roleId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: parsed.valid satisfies Contact[], channel: effectiveChannel }),
      });
      const body = await response.json().catch(() => ({})) as Partial<SentSummary> & { error?: string };
      if (!response.ok || typeof body.sent !== 'number') {
        setError(body.error ?? 'Invites could not be sent. Try again.');
        return;
      }
      setSent(body as SentSummary);
    } catch {
      setError('Invites could not be sent. Try again.');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    const channels = [`${sent.byEmail} by email`];
    if (whatsApp) channels.push(`${sent.byWhatsApp} by WhatsApp`);
    return (
      <main className={[styles.page, 'employer-light-theme'].join(' ')}>
        <section className={styles.card} aria-live="polite">
          <p className={styles.eyebrow}>{workplace}</p>
          <h1>Sent to {sent.sent} {sent.sent === 1 ? 'candidate' : 'candidates'}.</h1>
          <p className={styles.lede}>{channels.join(', ')}.</p>
          {(sent.duplicates > 0 || sent.invalid > 0) && (
            <p className={styles.note}>
              {sent.duplicates > 0 ? `${sent.duplicates} already invited. ` : ''}
              {sent.invalid > 0 ? `${sent.invalid} could not be used.` : ''}
            </p>
          )}
          <Link href="/employer" className={styles.primary}>Back to {roleTitle}</Link>
        </section>
      </main>
    );
  }

  return (
    <main className={[styles.page, 'employer-light-theme'].join(' ')}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>{workplace}: {roleTitle}</p>
        <h1>Add candidates</h1>
        <p className={styles.lede}>Paste emails or phone numbers, or upload a CSV from your applicant system.</p>

        {closed && <p className={styles.warning}>This role has closed. Reopen it or create a new role before adding candidates.</p>}

        <div className={styles.inputRow}>
          <label className={styles.field}>
            <span className={styles.srOnly}>Emails or phone numbers</span>
            <textarea
              value={text}
              onChange={(event) => { setText(event.target.value); setCsv(null); setFixes({}); }}
              rows={8}
              placeholder={'amina@example.com\n+971 50 123 4567\nfarid@example.com, yusuf@example.com'}
              disabled={Boolean(csv)}
              aria-describedby="contact-summary"
            />
          </label>
          <label className={styles.upload}>
            <input type="file" accept=".csv,text/csv" onChange={(event) => void onFile(event.target.files?.[0])} />
            <span>Upload CSV</span>
            {csv && <small>{csv.name} <button type="button" onClick={() => setCsv(null)}>Remove</button></small>}
          </label>
        </div>

        <p id="contact-summary" className={styles.summary} aria-live="polite">
          {parsed.found > 0 ? summaryLine(parsed) : 'Nothing added yet.'}
        </p>

        {parsed.invalid.length > 0 && (
          <details className={styles.invalid}>
            <summary>{parsed.invalid.length} invalid {parsed.invalid.length === 1 ? 'row' : 'rows'}: fix or leave out</summary>
            <ul>
              {parsed.invalid.map((row) => (
                <li key={`${row.index}-${row.raw}`}>
                  <code>{row.raw.slice(0, 80)}</code>
                  <span>{REASON_COPY[row.reason]}</span>
                  <input
                    type="text"
                    inputMode="email"
                    placeholder="Corrected email or +phone"
                    aria-label={`Fix for ${row.raw.slice(0, 40)}`}
                    value={fixes[row.index] ?? ''}
                    onChange={(event) => setFixes((current) => ({ ...current, [row.index]: event.target.value }))}
                  />
                </li>
              ))}
            </ul>
          </details>
        )}

        {whatsApp && (
          <fieldset className={styles.channels}>
            <legend>Send by</legend>
            {(['email', 'whatsapp', 'both'] as Channel[]).map((option) => (
              <label key={option}>
                <input type="radio" name="channel" value={option} checked={effectiveChannel === option} onChange={() => setChannel(option)} />
                {option === 'email' ? 'Email' : option === 'whatsapp' ? 'WhatsApp' : 'Both'}
              </label>
            ))}
          </fieldset>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled={!canSend} onClick={() => void send()}>
            {sending ? 'Sending' : 'Send invites'}
          </button>
          <Link href="/employer" className={styles.secondary}>Skip for now</Link>
        </div>
        {error && <p className={styles.warning} role="alert">{error}</p>}
        <p className={styles.note}>Every candidate gets their own link. Nothing is scored automatically and no one is rejected automatically.</p>
      </section>
    </main>
  );
}
