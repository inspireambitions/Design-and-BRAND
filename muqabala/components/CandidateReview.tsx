'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createCandidateShare, recordDecision, revokeCandidateShare, undoDecision } from '@/app/employer/actions';
import { employerVolumeProps, track } from '@/lib/analytics';
import { EmployerReportVideo } from '@/components/EmployerReportVideo';
import type { Coverage } from '@/lib/employer-volume/coverage';
import type { ReportAnswer } from '@/lib/report-summary';
import styles from './CandidateReview.module.css';

export type ReviewShare = {
  id: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  response: 'recommend' | 'not_this_one' | null;
  respondedAt: string | null;
};

export type ReviewDecision = {
  id: string;
  decision: 'shortlist' | 'pass' | 'later';
  note: string | null;
  createdAt: string;
};

type Props = {
  interviewId: string;
  roleId: string;
  displayName: string;
  roleTitle: string;
  workplace: string;
  submittedAt: string;
  coverage: Coverage;
  answers: ReportAnswer[];
  position: number;
  total: number;
  nextId: string | null;
  latestDecision: ReviewDecision | null;
  shares: ReviewShare[];
};

const UNDO_MS = 10_000;

const DECISION_LABEL: Record<ReviewDecision['decision'], string> = {
  shortlist: 'Shortlisted',
  pass: 'Not proceeding',
  later: 'Hold',
};

export function CandidateReview(props: Props) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [undo, setUndo] = useState<{ decisionId: string; label: string; until: number } | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<number>(0);
  const touchStart = useRef<number | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);
  useEffect(() => { track('review_started', employerVolumeProps(true, { role_id: props.roleId })); }, [props.roleId]);

  function goNext() {
    if (props.nextId) router.push(`/employer/interviews/${props.nextId}`);
    else router.push('/employer');
  }

  async function decide(decision: ReviewDecision['decision']) {
    if (busy) return;
    setBusy(true);
    setError('');
    const result = await recordDecision({ interviewId: props.interviewId, decision, note });
    setBusy(false);
    if ('error' in result) { setError(result.error); return; }
    track('decision_made', employerVolumeProps(true, { role_id: props.roleId, type: decision }));
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ decisionId: result.id, label: DECISION_LABEL[decision], until: Date.now() + UNDO_MS });
    undoTimer.current = setTimeout(() => { setUndo(null); goNext(); }, UNDO_MS);
  }

  async function undoLast() {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const result = await undoDecision({ interviewId: props.interviewId, decisionId: undo.decisionId });
    setUndo(null);
    if ('error' in result) setError(result.error);
    else router.refresh();
  }

  async function share() {
    setBusy(true);
    const result = await createCandidateShare(props.interviewId);
    setBusy(false);
    if ('error' in result) { setError(result.error); return; }
    track('candidate_shared', employerVolumeProps(true, { role_id: props.roleId }));
    setShareUrl(result.url);
    router.refresh();
  }

  async function copyShare() {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); } catch { setCopied(false); }
  }

  async function revoke(shareId: string) {
    const result = await revokeCandidateShare({ interviewId: props.interviewId, shareId });
    if ('error' in result) setError(result.error);
    else { setShareUrl(null); router.refresh(); }
  }

  return (
    <div
      className={[styles.page, 'employer-light-theme'].join(' ')}
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        touchStart.current = null;
        const end = event.changedTouches[0]?.clientX;
        if (start !== null && end !== undefined && start - end > 80) goNext();
      }}
    >
      <header className={styles.header}>
        <Link href="/employer" className={styles.back}>All roles</Link>
        <Link href={`/employer/candidates/${props.interviewId}/evaluation`} className={styles.evaluation}>View evaluation</Link>
        <span className={styles.position}>{props.position} of {props.total}</span>
        <button type="button" className={styles.next} onClick={goNext}>{props.nextId ? 'Next' : 'Done'}</button>
      </header>

      <main className={styles.main}>
        <section className={styles.top}>
          <p className={styles.eyebrow}>{props.workplace}: {props.roleTitle}</p>
          <h1>{props.displayName}</h1>
          <p className={styles.meta}>Submitted {new Date(props.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
          <ul className={styles.rubric} aria-label="Rubric coverage">
            {props.coverage.items.map((item) => (
              <li key={item.id} className={item.covered ? styles.tick : styles.cross}>
                <span aria-hidden="true">{item.covered ? '\u2713' : '\u2717'}</span>
                <span>{item.label}</span>
                <span className={styles.srOnly}>{item.covered ? 'evidence found' : 'no evidence found'}</span>
              </li>
            ))}
          </ul>
          {props.latestDecision && (
            <p className={styles.previous}>
              {DECISION_LABEL[props.latestDecision.decision]} on {new Date(props.latestDecision.createdAt).toLocaleDateString('en-GB')}
              {props.latestDecision.note ? `: ${props.latestDecision.note}` : ''}
            </p>
          )}
        </section>

        <section className={styles.answers}>
          {props.answers.map((answer, index) => {
            const open = expanded === index;
            return (
              <article key={answer.question_index} className={styles.answer}>
                <button
                  type="button"
                  className={styles.answerHead}
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? -1 : index)}
                >
                  <span className={styles.answerIndex}>{index + 1}</span>
                  <span className={styles.answerQuestion}>{answer.question_text}</span>
                  <span aria-hidden="true">{open ? '\u2212' : '+'}</span>
                </button>
                {open && (
                  <div className={styles.answerBody}>
                    {answer.video_path && (
                      <EmployerReportVideo
                        interviewId={props.interviewId}
                        questionIndex={answer.question_index}
                        durationSeconds={answer.video_duration_seconds}
                        label={`question ${answer.question_index + 1}`}
                      />
                    )}
                    <p className={styles.transcript} dir="auto">
                      {answer.transcript || 'No reliable transcript. Play the recording.'}
                    </p>
                    <small>Automatic transcript. The recording is the evidence.</small>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section className={styles.shareBlock}>
          <div className={styles.shareHead}>
            <h2>Share with a colleague</h2>
            <button type="button" className={styles.ghost} onClick={() => void share()} disabled={busy}>Share</button>
          </div>
          {shareUrl && (
            <div className={styles.shareLink}>
              <code>{shareUrl}</code>
              <button type="button" className={styles.ghost} onClick={() => void copyShare()}>{copied ? 'Copied' : 'Copy link'}</button>
            </div>
          )}
          {props.shares.length > 0 && (
            <ul className={styles.shareList}>
              {props.shares.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.revokedAt
                      ? 'Link closed'
                      : new Date(item.expiresAt).getTime() < Date.now()
                        ? 'Link expired'
                        : `Open until ${new Date(item.expiresAt).toLocaleDateString('en-GB')}`}
                    {item.response && item.respondedAt && (
                      <strong> Colleague said {item.response === 'recommend' ? 'Recommend' : 'Not this one'} on {new Date(item.respondedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}.</strong>
                    )}
                  </span>
                  {!item.revokedAt && <button type="button" className={styles.linkButton} onClick={() => void revoke(item.id)}>Revoke</button>}
                </li>
              ))}
            </ul>
          )}
          <p className={styles.small}>The shared page shows this candidate only: name or reference, rubric ticks and recorded answers. No contact details.</p>
        </section>
      </main>

      <footer className={styles.decisionBar}>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <input
          type="text"
          className={styles.noteField}
          placeholder="Optional note"
          maxLength={280}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-label="Optional note for this decision"
        />
        <div className={styles.decisions}>
          <button type="button" className={styles.shortlist} disabled={busy} onClick={() => void decide('shortlist')}>Shortlist</button>
          <button type="button" className={styles.pass} disabled={busy} onClick={() => void decide('pass')}>Not proceeding</button>
          <button type="button" className={styles.later} disabled={busy} onClick={() => void decide('later')}>Hold</button>
        </div>
      </footer>

      {undo && (
        <div className={styles.toast} role="status">
          <span>{undo.label}. Moving on.</span>
          <button type="button" onClick={() => void undoLast()}>Undo</button>
        </div>
      )}
    </div>
  );
}
