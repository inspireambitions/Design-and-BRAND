'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AnswerFeedback } from '@/lib/scoring';
import { t } from '@/lib/i18n';

export function ReportRetryFeedback({
  interviewId,
  roleId,
  questionIndex,
  questionId,
  transcript,
  language,
}: {
  interviewId: string;
  roleId: string;
  questionIndex: number;
  questionId: string;
  transcript: string;
  language: 'en' | 'ar';
}) {
  const router = useRouter();
  const tr = (key: Parameters<typeof t>[1]) => t(language, key);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  async function retryFeedback() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Scoring-Session':
            typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
        body: JSON.stringify({
          roleId,
          questionId,
          transcript,
          lang: language,
          interviewId,
          questionIndex,
          rescore: true,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        feedback?: AnswerFeedback;
        error?: { message?: string };
      };
      if (!response.ok || !data.feedback || isStillRetryable(data.feedback)) {
        setMessage(tr('reportRetryFailed'));
        return;
      }
      setSucceeded(true);
      setMessage(tr('reportRetrySuccess'));
      router.refresh();
    } catch {
      setMessage(tr('reportRetryFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="report-retry">
      {!succeeded && (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={retryFeedback}>
          {busy ? tr('reportRetrying') : tr('reportRetryFeedback')}
        </button>
      )}
      {message && <p className="tiny" role="status">{message}</p>}
    </div>
  );
}

function isStillRetryable(feedback: AnswerFeedback): boolean {
  return (
    feedback.status === 'unscored'
    && feedback.improvements.some((item) =>
      item.includes('Try getting feedback again')
      || item.includes('حاول الحصول على الملاحظات'),
    )
  );
}
