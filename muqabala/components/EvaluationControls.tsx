'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, FilePdf, IdentificationCard, LinkSimple, NotePencil, Prohibit } from '@phosphor-icons/react';
import { addEvaluationNote, createEvaluationShare, regenerateEvaluationReport, revokeEvaluationShare, updateEvaluationInterviewer } from '@/app/employer/evaluation-actions';
import styles from './EvaluationControls.module.css';

type Share = { id: string; expiresAt: string; revokedAt: string | null };

export function EvaluationControls({ interviewId, decisionRecorded, interviewerName: initialInterviewerName, shares }: {
  interviewId: string;
  decisionRecorded: boolean;
  interviewerName: string;
  shares: Share[];
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [interviewerName, setInterviewerName] = useState(initialInterviewerName);
  const [days, setDays] = useState(7);
  const [shareUrl, setShareUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  async function saveInterviewer() {
    setBusy('interviewer'); setMessage('');
    const cleanName = interviewerName.replace(/\s+/g, ' ').trim();
    const result = await updateEvaluationInterviewer({ interviewId, interviewerName: cleanName });
    setBusy('');
    setMessage('error' in result ? result.error : cleanName ? 'Interviewer name saved.' : 'Interviewer name removed.');
    if (!('error' in result)) { setInterviewerName(cleanName); router.refresh(); }
  }

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
      <div className={styles.signatureBlock}>
        <div className={styles.heading}><IdentificationCard aria-hidden="true" /><div><h2>Interviewer name</h2><p>Optional. Add the name you want shown on the shared report and PDF.</p></div></div>
        <div className={styles.signatureInput}>
          <label htmlFor="evaluation-interviewer">Interviewer</label>
          <input id="evaluation-interviewer" value={interviewerName} onChange={(event) => setInterviewerName(event.target.value)} maxLength={100} placeholder="Enter interviewer name" />
          <button type="button" onClick={() => void saveInterviewer()} disabled={Boolean(busy) || interviewerName === initialInterviewerName}>{busy === 'interviewer' ? 'Saving…' : 'Save name'}</button>
        </div>
      </div>
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
