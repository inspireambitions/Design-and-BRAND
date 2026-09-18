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
          Your practice feedback
        </span>
        <h2 style={{ margin: '4px 0 8px' }}>Here is how your answers came across</h2>
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

      {/* 1. WHAT YOU DID WELL */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '16px', color: '#166534', margin: '0 0 12px' }}>
          1. What you did well
        </h3>
        <div style={{ display: 'grid', gap: '8px' }}>
          {parsed.data.questions.flatMap((q) =>
            q.elements
              .filter((e) => e.present)
              .map((e) => {
                const rubricLabel = rubrics?.[q.questionIndex]?.find((elem) => elem.id === e.id)?.label ?? e.id;
                return (
                  <div
                    key={`well_${q.questionIndex}_${e.id}`}
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '13px', color: '#166534' }}>
                        Question {q.questionIndex + 1}: {rubricLabel}
                      </strong>
                      {e.supportingText && (
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#334155', fontStyle: 'italic' }}>
                          &ldquo;{e.supportingText}&rdquo;
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#15803d', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      Demonstrated
                    </span>
                  </div>
                );
              })
          )}
          {resolvedCovered === 0 && (
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              No criteria met the threshold in this attempt. Review the suggestions below to build your evidence.
            </p>
          )}
        </div>
      </div>

      {/* 2. WHAT TO STRENGTHEN */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '16px', color: '#9a3412', margin: '0 0 12px' }}>
          2. What to strengthen
        </h3>
        <div style={{ display: 'grid', gap: '8px' }}>
          {parsed.data.questions.flatMap((q) =>
            q.elements
              .filter((e) => !e.present)
              .map((e) => {
                const rubricLabel = rubrics?.[q.questionIndex]?.find((elem) => elem.id === e.id)?.label ?? e.id;
                return (
                  <div
                    key={`strengthen_${q.questionIndex}_${e.id}`}
                    style={{
                      background: '#fff7ed',
                      border: '1px solid #fed7aa',
                      borderRadius: '6px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '13px', color: '#9a3412' }}>
                        Question {q.questionIndex + 1}: {rubricLabel}
                      </strong>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#7c2d12' }}>
                        Include a specific example showing how you handled this situation and what the outcome was.
                      </p>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#c2410c', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      To develop
                    </span>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* 3. EVIDENCE FROM YOUR RESPONSE */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '16px', color: '#1e293b', margin: '0 0 12px' }}>
          3. Evidence from your response
        </h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          {parsed.data.questions.flatMap((q) =>
            q.elements
              .filter((e) => e.present && e.supportingText)
              .map((e) => {
                const rubricLabel = rubrics?.[q.questionIndex]?.find((elem) => elem.id === e.id)?.label ?? e.id;
                return (
                  <blockquote
                    key={`quote_${q.questionIndex}_${e.id}`}
                    style={{
                      margin: 0,
                      padding: '10px 14px',
                      background: '#f8fafc',
                      borderLeft: '3px solid #059669',
                      borderRadius: '0 6px 6px 0',
                      fontSize: '13px',
                      color: '#334155',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#047857', marginBottom: '4px', textTransform: 'uppercase' }}>
                      Question {q.questionIndex + 1} &middot; {rubricLabel}
                    </div>
                    &ldquo;{e.supportingText}&rdquo;
                  </blockquote>
                );
              })
          )}
          {parsed.data.questions.every((q) => q.elements.every((e) => !e.present || !e.supportingText)) && (
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              No direct quotation excerpts were extracted. Practice providing concrete examples with actions and outcomes.
            </p>
          )}
        </div>
      </div>

      {/* 4. WHAT TO PRACTISE NEXT */}
      {firstPriority && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderLeft: '4px solid #16a34a',
            borderRadius: '6px',
            padding: '16px 20px',
            marginBottom: '28px',
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: '#166534' }}>
            4. What to practise next
          </h3>
          <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#14532d', lineHeight: 1.5 }}>
            <strong>Highest priority area &mdash; Question {firstPriority.questionIndex + 1}:</strong> {firstPriority.improvement}
          </p>
          <div>
            {onRetry ? (
              <button
                disabled={retryBusy}
                onClick={() => onRetry(firstPriority.questionIndex + 1)}
                style={{ fontSize: '13px', padding: '8px 14px' }}
              >
                {retryBusy ? 'Opening draft...' : `Practise Question ${firstPriority.questionIndex + 1}`}
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
                  Practise Question {firstPriority.questionIndex + 1} &rarr;
                </Link>
              )
            )}
          </div>
        </div>
      )}

      {/* 5. SECONDARY RUBRIC BREAKDOWN */}
      <details
        style={{
          marginTop: '20px',
          borderTop: '1px solid #e2e8f0',
          paddingTop: '16px',
        }}
      >
        <summary
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#475569',
            cursor: 'pointer',
            padding: '6px 0',
          }}
        >
          5. Secondary rubric breakdown (Click to expand detailed evaluation)
        </summary>

        <div style={{ display: 'grid', gap: '16px', marginTop: '14px' }}>
          {parsed.data.questions.map((q) => {
            const coveredCount = q.elements.filter((e) => e.present).length;
            return (
              <div
                key={`rubric_breakdown_${q.questionIndex}`}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px 18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#163e39' }}>
                    Question {q.questionIndex + 1}
                  </h4>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 'bold',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: coveredCount === 4 ? '#dcfce7' : coveredCount >= 2 ? '#fef9c3' : '#fee2e2',
                      color: coveredCount === 4 ? '#166534' : coveredCount >= 2 ? '#854d0e' : '#991b1b',
                    }}
                  >
                    {coveredCount} of 4 criteria demonstrated
                  </span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {q.elements.map((e) => {
                    const rubricLabel = rubrics?.[q.questionIndex]?.find((elem) => elem.id === e.id)?.label ?? e.id;
                    return (
                      <li
                        key={e.id}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '4px',
                          marginBottom: '4px',
                          background: e.present ? '#f0fdf4' : '#fafafa',
                          border: e.present ? '1px solid #bbf7d0' : '1px dashed #e2e8f0',
                          fontSize: '13px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: e.present ? '#166534' : '#64748b', fontWeight: e.present ? 600 : 400 }}>
                          {e.present ? '✓' : '○'} {rubricLabel}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: e.present ? '#15803d' : '#94a3b8', textTransform: 'uppercase' }}>
                          {e.present ? 'Demonstrated' : 'Not observed'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </details>

      <p style={{ fontSize: '12px', color: '#64748b', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
        A note from your coach: these points come only from what you wrote in your answers. They are here to help you practise and improve. They are not a judgement of you as a person and they are not shared with employers.
      </p>
    </section>
  );
}
