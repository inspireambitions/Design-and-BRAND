'use client';

import Link from 'next/link';
import { useState } from 'react';
import { track } from '@/lib/analytics';
import styles from './RoleHelpPanel.module.css';

type Answer = { text: string; href: string; action: string };

export function RoleHelpPanel({ roleId, roleTitle, unreviewed, unresolvedQuestions, expiresAt, timezone }: { roleId: string; roleTitle: string; unreviewed: number | null; unresolvedQuestions: number | null; expiresAt: string; timezone: string }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const closes = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: timezone }).format(new Date(expiresAt));
  const questions = [
    { label: 'Which submissions still need review?', answer: { text: unreviewed === null ? 'The review count is temporarily unavailable. Open the queue to retry.' : `${unreviewed} ${unreviewed === 1 ? 'submission still needs' : 'submissions still need'} human review.`, href: `/employer/roles/${roleId}?candidateStatus=unreviewed#submissions`, action: 'Open review queue' } },
    { label: 'When does this invitation close?', answer: { text: `The invitation closes ${closes} (${timezone}).`, href: `/employer/roles/${roleId}#invitation`, action: 'View invitation' } },
    { label: 'What needs my attention?', answer: { text: unreviewed === null || unresolvedQuestions === null ? 'One or more live counts are temporarily unavailable. Open the role to retry.' : `${unreviewed} awaiting review and ${unresolvedQuestions} unresolved candidate ${unresolvedQuestions === 1 ? 'question' : 'questions'}.`, href: unresolvedQuestions ? `/employer/roles/${roleId}#candidate-questions` : `/employer/roles/${roleId}#submissions`, action: 'Open next task' } },
  ];
  if (!open) return <button type="button" className={styles.open} onClick={() => { track('role_help_used', { role_id: roleId, type: 'opened' }); setOpen(true); }}>Ask about this role</button>;
  return <section className={styles.panel} aria-labelledby="role-help-title"><header><div><small>Active role</small><h2 id="role-help-title" dir="auto">{roleTitle}</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close role help">×</button></header><p>Choose a common question to open the relevant role record.</p><div className={styles.questions}>{questions.map((question, index) => <button type="button" key={question.label} onClick={() => { track('role_help_used', { role_id: roleId, type: `suggestion_${index + 1}` }); setAnswer(question.answer); }}>{question.label}</button>)}</div>{answer && <div className={styles.answer} role="status"><p>{answer.text}</p><Link href={answer.href}>{answer.action}</Link></div>}<Link className={styles.reminder} href="#reminders">Prepare a candidate reminder</Link></section>;
}
