'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { publishCandidateQuestionAsFaq, replyCandidateQuestion, resolveCandidateQuestion } from '@/app/employer/actions';
import { track } from '@/lib/analytics';
import styles from './RecruiterQuestions.module.css';

export type RecruiterQuestionRow = {
  id: string;
  role_id: string;
  roleTitle: string;
  candidate_email: string;
  question_text: string;
  answer_already_shown: string | null;
  reply_text: string | null;
  replied_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

function QuestionCard({ item }: { item: RecruiterQuestionRow }) {
  const router = useRouter();
  const [reply, setReply] = useState(item.reply_text || '');
  const [publicQuestion, setPublicQuestion] = useState('');
  const [publicAnswer, setPublicAnswer] = useState('');
  const [busy, setBusy] = useState<'reply' | 'resolve' | 'publish' | null>(null);
  const [message, setMessage] = useState('');

  async function run(kind: 'reply' | 'resolve' | 'publish') {
    if (busy) return;
    setBusy(kind);
    setMessage('');
    try {
      const result = kind === 'reply'
        ? await replyCandidateQuestion({ questionId: item.id, reply })
        : kind === 'resolve'
          ? await resolveCandidateQuestion(item.id)
          : await publishCandidateQuestionAsFaq({ questionId: item.id, publicQuestion, publicAnswer });
      if ('error' in result) setMessage(result.error);
      else {
        setMessage(kind === 'reply' ? 'Reply saved. It is visible when the candidate returns to this invitation.' : kind === 'resolve' ? 'Question resolved.' : 'Added to published role information.');
        if (kind === 'resolve') track('candidate_question_resolved', { role_id: item.role_id });
        router.refresh();
      }
    } catch {
      setMessage('The action could not be completed. Your text is still here; try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className={styles.card}>
      <header><div><strong dir="auto">{item.question_text}</strong><p><bdi dir="auto">{item.roleTitle}</bdi> · {new Date(item.created_at).toLocaleString('en-GB')}</p></div><span data-resolved={Boolean(item.resolved_at)}>{item.resolved_at ? 'Resolved' : 'Unresolved'}</span></header>
      {item.answer_already_shown && <div className={styles.context}><small>Answer already shown</small><p dir="auto">{item.answer_already_shown}</p></div>}
      <label><span>Reply</span><textarea dir="auto" rows={4} maxLength={2000} value={reply} onChange={(event) => setReply(event.target.value)} /></label>
      <p className={styles.delivery}>Saved replies appear in the candidate’s invitation. Automated reply email is not configured; <a href={`mailto:${encodeURIComponent(item.candidate_email)}?subject=${encodeURIComponent(`Your question about ${item.roleTitle}`)}&body=${encodeURIComponent(reply)}`}>open an email handoff</a> if an immediate notification is needed.</p>
      {item.reply_text && <details className={styles.publicFact}>
        <summary>Prepare public role information</summary>
        <p>Write a separate candidate-visible question and answer. Remove names, contact details and private context.</p>
        <label><span>Public question</span><input dir="auto" maxLength={240} value={publicQuestion} onChange={(event) => setPublicQuestion(event.target.value)} /></label>
        <label><span>Public answer</span><textarea dir="auto" rows={3} maxLength={1000} value={publicAnswer} onChange={(event) => setPublicAnswer(event.target.value)} /></label>
        <button type="button" disabled={Boolean(busy) || publicQuestion.trim().length < 4 || publicAnswer.trim().length < 1} onClick={() => void run('publish')}>{busy === 'publish' ? 'Publishing…' : 'Add to role information'}</button>
      </details>}
      <div className={styles.actions}>
        <button type="button" disabled={Boolean(busy) || reply.trim().length === 0} onClick={() => void run('reply')}>{busy === 'reply' ? 'Saving…' : 'Save reply'}</button>
        <button type="button" disabled={Boolean(busy) || Boolean(item.resolved_at)} onClick={() => void run('resolve')}>{busy === 'resolve' ? 'Resolving…' : 'Mark resolved'}</button>
      </div>
      {message && <p role="status" className={styles.message}>{message}</p>}
    </article>
  );
}

export function RecruiterQuestions({ questions, emptyCopy = 'No unresolved candidate questions.' }: { questions: RecruiterQuestionRow[]; emptyCopy?: string }) {
  if (questions.length === 0) return <p className={styles.empty}>{emptyCopy}</p>;
  return <div className={styles.list}>{questions.map((item) => <QuestionCard key={item.id} item={item} />)}</div>;
}
