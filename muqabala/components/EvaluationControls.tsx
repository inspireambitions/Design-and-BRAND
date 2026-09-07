'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, FilePdf, IdentificationCard, LinkSimple, NotePencil, Prohibit } from '@phosphor-icons/react';
import { addEvaluationNote, createEvaluationShare, regenerateEvaluationReport, revokeEvaluationShare, updateEvaluationInterviewer } from '@/app/employer/evaluation-actions';
import styles from './EvaluationControls.module.css';

type Share = { id: string; version: number; expiresAt: string; revokedAt: string | null };

export function EvaluationControls({ interviewId, decisionRecorded, interviewerName: initialInterviewerName, shares, notes = [] }: {
  interviewId: string;
  decisionRecorded: boolean;
  interviewerName: string;
  shares: Share[];
  notes?: Array<{ text: string; created_at: string }>;
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [interviewerName, setInterviewerName] = useState(initialInterviewerName);
  const [savedName, setSavedName] = useState(initialInterviewerName);
  const [editingName, setEditingName] = useState(!initialInterviewerName);
  const [correctionIndex, setCorrectionIndex] = useState('');
  const [correctionPrefix, setCorrectionPrefix] = useState('');
  const [days, setDays] = useState(7);
  const [shareUrl, setShareUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  async function saveInterviewer() {
    setBusy('interviewer'); setMessage('');
    try {
      const cleanName = interviewerName.replace(/\s+/g, ' ').trim();
      const result = await updateEvaluationInterviewer({ interviewId, interviewerName: cleanName });
      setMessage('error' in result ? result.error : cleanName ? 'Interviewer name saved.' : 'Interviewer name removed.');
      if (!('error' in result)) { setInterviewerName(cleanName); setSavedName(cleanName); setEditingName(false); router.refresh(); }
    } catch {
      setMessage('We could not confirm the name was saved. Your text is still here. Refresh to check before trying again.');
    } finally { setBusy(''); }
  }

  async function addNote() {
    setBusy('note'); setMessage('');
    try {
      const result = await addEvaluationNote({ interviewId, text: note });
      if ('error' in result) setMessage(result.error);
      else { setNote(''); setCorrectionIndex(''); setCorrectionPrefix(''); setMessage('Note added.'); router.refresh(); }
    } catch {
      setMessage('We could not confirm the note was added. Your text is still here. Refresh to check before trying again.');
    } finally { setBusy(''); }
  }

  async function share() {
    setBusy('share'); setMessage('');
    try {
      const result = await createEvaluationShare({ interviewId, days });
      if ('error' in result) setMessage(result.error);
      else { setShareUrl(result.url); setMessage('Private link created.'); router.refresh(); }
    } catch {
      setMessage('We could not confirm the link was created. Refresh to check before trying again.');
    } finally { setBusy(''); }
  }

  async function revoke(shareId: string) {
    setBusy(shareId); setMessage('');
    try {
      const result = await revokeEvaluationShare({ interviewId, shareId });
      setMessage('error' in result ? result.error : 'Link closed.');
      if (!('error' in result)) router.refresh();
    } catch {
      setMessage('We could not confirm the link was closed. Refresh to check before trying again.');
    } finally { setBusy(''); }
  }

  async function regenerate() {
    setBusy('version'); setMessage('');
    try {
      const result = await regenerateEvaluationReport(interviewId);
      setMessage('error' in result ? result.error : `Version ${result.version} created.`);
      if (!('error' in result)) router.refresh();
    } catch {
      setMessage('We could not confirm a new version was created. Refresh to check before trying again.');
    } finally { setBusy(''); }
  }

  async function copyShareLink() {
    try { await navigator.clipboard.writeText(shareUrl); setMessage('Private link copied.'); }
    catch { setMessage('The link could not be copied. Select the link and copy it manually.'); }
  }

  return (
    <section className={styles.controls} aria-label="Evaluation actions">
      <div className={styles.signatureBlock}>
        <div className={styles.heading}><IdentificationCard aria-hidden="true" /><div><h2>Interviewer name</h2><p>Optional. You can edit this name later. Clear it to remove it from the report and PDF.</p></div></div>
        <div className={styles.signatureInput}>
          <label htmlFor="evaluation-interviewer">Interviewer</label>
          <input id="evaluation-interviewer" value={interviewerName} onChange={(event) => setInterviewerName(event.target.value)} readOnly={!editingName} disabled={Boolean(busy)} maxLength={100} placeholder="Enter interviewer name" />
          <div className={styles.nameActions}>
            {editingName ? <>
              <button type="button" onClick={() => void saveInterviewer()} disabled={Boolean(busy) || interviewerName.replace(/\s+/g, ' ').trim() === savedName}>{busy === 'interviewer' ? 'Saving…' : savedName ? 'Save changes' : 'Save name'}</button>
              <button type="button" onClick={() => { setInterviewerName(savedName); setEditingName(false); setMessage(''); }} disabled={Boolean(busy)}>Cancel</button>
            </> : <button type="button" onClick={() => setEditingName(true)} disabled={Boolean(busy)}>{savedName ? 'Edit name' : 'Add name'}</button>}
          </div>
        </div>
      </div>
      <div className={styles.block}>
        <div className={styles.heading}><NotePencil aria-hidden="true" /><div><h2>Add employer note</h2><p>Each note keeps its author and date. To fix a mistake, add a correction. The original stays in the history.</p></div></div>
        {notes.length > 0 && <label className={styles.correctionLabel}>Correct a previous note
          <select value={correctionIndex} disabled={Boolean(busy) || Boolean(note.trim())} onChange={(event) => {
            const index = event.target.value;
            setCorrectionIndex(index);
            const original = notes[Number(index)];
            if (index && original) {
              const prefix = `Correction to my note from ${new Date(original.created_at).toLocaleString('en-GB')} (${original.created_at}): “${original.text.slice(0, 120)}${original.text.length > 120 ? '…' : ''}”. Corrected information: `;
              setCorrectionPrefix(prefix); setNote(prefix);
            }
          }}>
            <option value="">Choose a note</option>
            {notes.map((original, index) => <option key={`${original.created_at}-${index}`} value={String(index)}>{new Date(original.created_at).toLocaleString('en-GB')} · {original.text.slice(0, 60)}</option>)}
          </select>
        </label>}
        <textarea aria-label="Employer note or correction" value={note} onChange={(event) => setNote(event.target.value)} disabled={Boolean(busy)} maxLength={1000} placeholder="Add factual context for the hiring team" />
        {correctionIndex && <small>Add the correct information after the quoted note before saving.</small>}
        <button type="button" onClick={() => void addNote()} disabled={!note.trim() || note.trim() === correctionPrefix.trim() || Boolean(busy)}>{busy === 'note' ? 'Adding…' : correctionIndex ? 'Add correction' : 'Add note'}</button>
        {correctionIndex && <button type="button" disabled={Boolean(busy)} onClick={() => { setNote(''); setCorrectionIndex(''); setCorrectionPrefix(''); }}>Cancel correction</button>}
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
        {shareUrl && <div className={styles.copy}><code>{shareUrl}</code><button type="button" onClick={() => void copyShareLink()}><Copy aria-hidden="true" /> Copy</button></div>}
        {shares.length > 0 && <ul className={styles.shares}>{shares.map((item) => {
          const closed = Boolean(item.revokedAt) || new Date(item.expiresAt).getTime() <= Date.now();
          return <li key={item.id}><span>Version {item.version} · {closed ? 'Closed' : `Open until ${new Date(item.expiresAt).toLocaleDateString('en-GB')}`}</span>{!closed && <button type="button" onClick={() => void revoke(item.id)} disabled={Boolean(busy)}><Prohibit aria-hidden="true" /> Close</button>}</li>;
        })}</ul>}
      </div>
      <div className={styles.versionBlock}>
        <div><strong>Refresh report wording</strong><span>Creates a new version from the same interview evidence. Competency results stay the same unless the stored evidence changes. Earlier versions stay available.</span></div>
        <button type="button" onClick={() => void regenerate()} disabled={Boolean(busy)}>{busy === 'version' ? 'Refreshing…' : 'Refresh wording'}</button>
      </div>
      {message && <p className={styles.message} role="status">{message}</p>}
    </section>
  );
}
