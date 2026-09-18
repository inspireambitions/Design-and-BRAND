'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { schoolsFeedbackSchema } from '@/lib/schools/evidence';
import Link from 'next/link';

export function SchoolsFeedback({
  attemptId,
  status,
  detail,
  covered,
  assignmentId,
  rubrics,
  onRetry,
  retryBusy,
  previousAttempt,
}: {
  attemptId: string;
  status: string;
  detail: unknown;
  covered: number | null;
  assignmentId?: string;
  rubrics?: { id: string; label: string; description?: string }[][];
  onRetry?: (question: number) => void;
  retryBusy?: boolean;
  previousAttempt?: { attempt_number: number; evidence_covered: number | null } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(status !== 'ready');
  const [message, setMessage] = useState(
    status === 'ready' ? '' : 'Preparing your feedback. Allow up to two minutes. Your answers are saved.'
  );
  const [result, setResult] = useState({ status, detail, covered });
  const [cycle, setCycle] = useState(0);
  const ready = result.status === 'ready' || status === 'ready';
  const started = useRef<string | null>(null);

  useEffect(() => {
    if (status === 'ready') return;
    let stopped = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 120000;

    const check = async () => {
      try {
        const response = await fetch('/api/schools/feedback?attemptId=' + attemptId, {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (response.status === 401) {
          if (!stopped) {
            setBusy(false);
            setMessage('Sign in again to read your saved feedback.');
          }
          return;
        }
        if (!response.ok) throw new Error();
        const next = await response.json();
        if (stopped) return;
        if (next.feedback_status === 'ready') {
          setResult({
            status: 'ready',
            detail: next.evidence_detail,
            covered: next.evidence_covered,
          });
          setBusy(false);
          router.refresh();
          return;
        }
        if (next.feedback_status === 'failed') {
          setBusy(false);
          setMessage('Feedback could not finish. Your answers are saved. Try again.');
          return;
        }
      } catch {
        if (stopped) return;
      }
      if (Date.now() >= deadline) {
        setBusy(false);
        setMessage('This is taking longer than expected. Your answers are saved. Check again or return later.');
        return;
      }
      timer = setTimeout(check, 4000);
    };

    // One generation request per visit or explicit retry. Status checks never call the AI service.
    const key = attemptId + ':' + cycle;
    if (started.current !== key) {
      started.current = key;
      void fetch('/api/schools/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId }),
        signal: AbortSignal.timeout(55000),
      }).catch(() => {});
    }
    timer = setTimeout(check, 4000);
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [attemptId, status, cycle, router]);

  if (!ready) {
    return (
      <section className="schools-card" aria-busy={busy}>
        <h2>Interview Complete</h2>
        <p role="status">{message || "We're preparing your feedback. Your answers are saved."}</p>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
          Your answers are saved securely. You can wait here or leave and return to your assignments at any time.
        </p>
        {busy ? (
          <progress aria-label="Preparing your feedback" style={{ width: '100%', height: '8px', marginTop: '12px' }} />
        ) : (
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                setBusy(true);
                setMessage("We're preparing your feedback. Your answers are saved.");
                setCycle((value) => value + 1);
              }}
            >
              Check feedback again
            </button>
            <Link
              href="/schools/me"
              style={{
                fontSize: '14px',
                color: '#075c50',
                textDecoration: 'underline',
              }}
            >
              Return to my assignments
            </Link>
          </div>
        )}
      </section>
    );
  }

  const resolvedDetail = status === 'ready' ? detail : result.detail;
  const resolvedCovered = status === 'ready' ? covered : result.covered;

  // Stored detail contains highlight offsets in addition to the provider contract.
  const raw = Array.isArray(resolvedDetail)
    ? resolvedDetail.map((q) => ({
        ...q,
        elements: q.elements?.map((e: Record<string, unknown>) => ({
          id: e.id,
          present: e.present,
          supportingText: e.supportingText,
          confidence: e.confidence,
        })),
      }))
    : null;

  const parsed = schoolsFeedbackSchema.safeParse({ questions: raw });
  if (!parsed.success) {
    return (
      <section className="schools-card">
        <p>Feedback is temporarily unavailable. Your answers are saved securely.</p>
      </section>
    );
  }

  const totalPossible = parsed.data.questions.length * 4;
  const firstPriority = parsed.data.questions
    .slice()
    .sort(
      (a, b) =>
        a.elements.filter((e) => e.present).length - b.elements.filter((e) => e.present).length ||
        a.questionIndex - b.questionIndex
    )[0];

  // Self-development delta calculation
  const prevCovered = previousAttempt?.evidence_covered;
  const delta =
    prevCovered != null && resolvedCovered != null
      ? resolvedCovered - prevCovered
      : null;

  return (
    <section className="schools-card" style={{ maxWidth: '840px', margin: '20px auto' }}>
      <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#075c50', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Formative Practice Evaluation
        </span>
        <h2 style={{ margin: '4px 0 8px' }}>Your Evidence-Based Feedback</h2>
        <p style={{ color: '#4a5568', margin: 0, fontSize: '15px' }}>
          Evidence demonstrated: <strong>{resolvedCovered ?? 0}</strong> of <strong>{totalPossible}</strong> criteria across {parsed.data.questions.length} questions.
        </p>
      </div>

      {/* OWN-ATTEMPT DEVELOPMENT COMPARISON (Strictly zero peer comparison) */}
      {previousAttempt && prevCovered != null && resolvedCovered != null && (
        <div
          style={{
            background: delta && delta > 0 ? '#f0fdf4' : '#f8fafc',
            border: delta && delta > 0 ? '1px solid #86efac' : '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '14px 18px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <strong style={{ color: delta && delta > 0 ? '#166534' : '#334155', fontSize: '14px' }}>
                Your Development vs Attempt {previousAttempt.attempt_number}
              </strong>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#4b5563' }}>
                Previous attempt demonstrated {prevCovered} of {totalPossible} criteria.
                Current attempt demonstrated {resolvedCovered} of {totalPossible}.
              </p>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: delta && delta > 0 ? '#16a34a' : delta === 0 ? '#64748b' : '#d97706' }}>
              {delta != null && delta > 0 ? `+${delta} criteria strengthened` : delta === 0 ? 'Consistent evidence' : `${delta} criteria`}
            </div>
          </div>
        </div>
      )}

      {/* ACTION PLAN: ADD THIS FIRST */}
      {firstPriority && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            borderLeft: '4px solid #d97706',
            borderRadius: '6px',
            padding: '16px 20px',
            marginBottom: '28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '18px' }}>🎯</span>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#92400e' }}>
              Action Plan: Highest Priority Improvement
            </h3>
          </div>
          <p style={{ margin: '6px 0 12px', fontSize: '14px', color: '#78350f', lineHeight: 1.5 }}>
            Focus on Question {firstPriority.questionIndex + 1}: {firstPriority.improvement}
          </p>
          <div>
            {onRetry ? (
              <button
                disabled={retryBusy}
                onClick={() => onRetry(firstPriority.questionIndex + 1)}
                style={{ fontSize: '13px', padding: '8px 14px' }}
              >
                {retryBusy ? 'Opening draft...' : `Retry Question ${firstPriority.questionIndex + 1} with Guidance`}
              </button>
            ) : (
              assignmentId && (
                <Link
                  href={'/schools/me/' + assignmentId + '?retry=' + (firstPriority.questionIndex + 1)}
                  style={{
                    display: 'inline-block',
                    background: '#075c50',
                    color: '#fff',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    textDecoration: 'none',
                  }}
                >
                  Retry Question {firstPriority.questionIndex + 1} with Guidance &rarr;
                </Link>
              )
            )}
          </div>
        </div>
      )}

      {/* PER-QUESTION EVIDENCE BREAKDOWN */}
      <h3 style={{ fontSize: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>
        Question-by-Question Rubric Evaluation
      </h3>

      <div style={{ display: 'grid', gap: '20px' }}>
        {parsed.data.questions.map((q) => {
          const coveredCount = q.elements.filter((e) => e.present).length;
          return (
            <div
              key={q.questionIndex}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px 20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#163e39' }}>
                  Question {q.questionIndex + 1}
                </h4>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: coveredCount === 4 ? '#dcfce7' : coveredCount >= 2 ? '#fef9c3' : '#fee2e2',
                    color: coveredCount === 4 ? '#166534' : coveredCount >= 2 ? '#854d0e' : '#991b1b',
                  }}
                >
                  {coveredCount} of 4 criteria demonstrated
                </span>
              </div>

              {/* Rubric Elements Checklist */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px' }}>
                {q.elements.map((e) => {
                  const rubricLabel = rubrics?.[q.questionIndex]?.find((elem) => elem.id === e.id)?.label ?? e.id;
                  return (
                    <li
                      key={e.id}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        marginBottom: '6px',
                        background: e.present ? '#f0fdf4' : '#fafafa',
                        border: e.present ? '1px solid #bbf7d0' : '1px dashed #e2e8f0',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: e.present ? '#166534' : '#64748b' }}>
                          {e.present ? '✓' : '○'} {rubricLabel}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            color: e.present ? '#15803d' : '#94a3b8',
                          }}
                        >
                          {e.present ? 'Demonstrated' : 'Not observed'}
                        </span>
                      </div>
                      {e.present && e.supportingText && (
                        <blockquote
                          style={{
                            margin: '6px 0 0',
                            padding: '6px 10px',
                            background: '#fff',
                            borderLeft: '3px solid #22c55e',
                            fontSize: '12px',
                            color: '#334155',
                            fontStyle: 'italic',
                          }}
                        >
                          &ldquo;{e.supportingText}&rdquo;
                        </blockquote>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* Coaching Improvement */}
              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', color: '#475569' }}>
                <strong>Adviser Recommendation:</strong> {q.improvement}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: '12px', color: '#64748b', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
        <strong>Formative Feedback Notice:</strong> Criteria counts reflect objective behavioral evidence found in your written responses. They are designed exclusively for developmental learning, do not constitute psychometric profiling, and do not predict employer hiring outcomes.
      </p>
    </section>
  );
}
