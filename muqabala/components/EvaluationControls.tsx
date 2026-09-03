'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, FilePdf, LinkSimple, NotePencil, Prohibit } from '@phosphor-icons/react';
import { addEvaluationNote, createEvaluationShare, regenerateEvaluationReport, revokeEvaluationShare } from '@/app/employer/evaluation-actions';
import styles from './EvaluationControls.module.css';

type Share = { id: string; expiresAt: string; revokedAt: string | null };

export function EvaluationControls({ interviewId, decisionRecorded, shares }: {
  interviewId: string;
  decisionRecorded: boolean;
  shares: Share[];
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [days, setDays] = useState(7);
  const [shareUrl, setShareUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  async function addNote() {
    setBusy('note'); setMessage('');
    const result = await addEvaluationNote({ interviewId, text: note });
    setBusy('');
    if ('error' in result) setMessage(result.error);
    else { setNote(''); setMessage('Note added.'); router.refresh(); }
  }

  async function share() {
    setBusy('share'); setMessage('');
    const result = await createEvaluationShare({ interviewId, days });
    setBusy('');
    if ('error' in result) setMessage(result.error);
    else { setShareUrl(result.url); setMessage('Private link created.'); router.refresh(); }
  }

  async function revoke(shareId: string) {
    setBusy(shareId); setMessage('');
    const result = await revokeEvaluationShare({ interviewId, shareId });
    setBusy('');
    setMessage('error' in result ? result.error : 'Link closed.');
    if (!('error' in result)) router.refresh();
  }

  async function regenerate() {
    setBusy('version'); setMessage('');
    const result = await regenerateEvaluationReport(interviewId);
    setBusy('');
    setMessage('error' in result ? result.error : `Version ${result.version} created.`);
    if (!('error' in result)) router.refresh();
  }

  return (
    <section className={styles.controls} aria-label="Evaluation actions">
      <div className={styles.block}>
        <div className={styles.heading}><NotePencil aria-hidden="true" /><div><h2>Add employer note</h2><p>Each note is attributed and permanent. Add a new note for later context.</p></div></div>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Add factual context for the hiring team" />
        <button type="button" onClick={() => void addNote()} disabled={!note.trim() || Boolean(busy)}>{busy === 'note' ? 'Adding…' : 'Add note'}</button>
      </div>

      <div className={styles.block}>
        <div className={styles.heading}><FilePdf aria-hidden="true" /><div><h2>PDF copy</h2><p>{decisionRecorded ? 'The recorded decision will appear in the file.' : 'Record a decision before downloading.'}</p></div></div>
        {decisionRecorded
          ? <a className={styles.button} href={`/api/employer/candidates/${interviewId}/evaluation/pdf`}>Download PDF</a>
          : <button type="button" disabled>Download PDF</button>}
      </div>

      <div className={styles.block}>
        <div className={styles.heading}><LinkSimple aria-hidden="true" /><div><h2>Private sharing</h2><p>A viewer must enter their email. Each open is logged.</p></div></div>
        <label>Open for <select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={1}>1 day</option><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></select></label>
        <button type="button" onClick={() => void share()} disabled={!decisionRecorded || Boolean(busy)}>{busy === 'share' ? 'Creating…' : 'Create private link'}</button>
        {!decisionRecorded && <small>Record a decision before sharing.</small>}
        {shareUrl && <div className={styles.copy}><code>{shareUrl}</code><button type="button" onClick={() => void navigator.clipboard.writeText(shareUrl)}><Copy aria-hidden="true" /> Copy</button></div>}
        {shares.length > 0 && <ul className={styles.shares}>{shares.map((item) => {
          const closed = Boolean(item.revokedAt) || new Date(item.expiresAt).getTime() <= Date.now();
          return <li key={item.id}><span>{closed ? 'Closed' : `Open until ${new Date(item.expiresAt).toLocaleDateString('en-GB')}`}</span>{!closed && <button type="button" onClick={() => void revoke(item.id)} disabled={Boolean(busy)}><Prohibit aria-hidden="true" /> Close</button>}</li>;
        })}</ul>}
      </div>
      <div className={styles.versionBlock}>
        <div><strong>Create a new version</strong><span>The current version stays available. This action reruns the evidence wording checks.</span></div>
        <button type="button" onClick={() => void regenerate()} disabled={Boolean(busy)}>{busy === 'version' ? 'Creating…' : 'Create version'}</button>
      </div>
      {message && <p className={styles.message} role="status">{message}</p>}
    </section>
  );
}
