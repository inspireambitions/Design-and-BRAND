'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SchoolsFeedback } from './Feedback';
import type { ExperienceLevel, EvidenceType } from '@/lib/universal-interview/types';

type Attempt = {
  id: string;
  status: string;
  answers: string[];
  revision: number;
  attempt_number: number;
  feedback_status: string;
  evidence_detail: unknown;
  evidence_covered: number | null;
  universal_interview_id?: string | null;
  delivery_mode?: string;
};

type CanonicalQuestion = {
  text: string;
  followUp?: string | null;
  rubric: { id: string; label: string; description?: string }[];
};

import {
  saveDraft,
  loadDraft,
  clearDraft as clearStoredDraft,
  pruneExpiredDrafts,
} from '@/lib/schools/draft-storage';

export function SchoolsAdaptivePractice({
  assignmentId,
  cohortId,
  studentUserId,
  questions,
  initial,
  dueAt,
  roleTitle,
  maxAttempts = 3,
  retryQuestion,
}: {
  assignmentId: string;
  cohortId: string;
  studentUserId?: string;
  questions: CanonicalQuestion[];
  initial: Attempt | null;
  dueAt: string;
  roleTitle: string;
  maxAttempts?: number;
  retryQuestion?: number;
}) {
  const [attempt, setAttempt] = useState(initial);
  const [step, setStep] = useState<'profile_check' | 'interview' | 'finalizing' | 'finalize_failed' | 'complete'>('profile_check');
  const [currentQuestion, setCurrentQuestion] = useState<{
    text: string;
    kind: string;
    interviewerIntent: string;
  } | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(questions.length);
  const [probeCount, setProbeCount] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Fallback confirmation dialog state (non-destructive fallback architecture)
  const [showFallbackConfirm, setShowFallbackConfirm] = useState(false);
  const preservedTypedDraft = useRef('');

  // Student progressive context state (editable before starting interview)
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('ENTRY');
  const [academicField, setAcademicField] = useState('');
  const [academicStage, setAcademicStage] = useState('');
  const [evidenceSources, setEvidenceSources] = useState<EvidenceType[]>(['ACADEMIC', 'PERSONAL_PROJECT']);

  // Due-date enforcement intentionally compares against current render time
  // eslint-disable-next-line react-hooks/purity
  const closed = Date.now() >= new Date(dueAt).getTime();
  const submitted = attempt?.status === 'submitted';

  // Identifier for draft persistence: assignmentId + attemptId + questionNumber + probeCount
  const turnKey = `${questionNumber}_${probeCount}`;

  const retryStarted = useRef(false);

  // Restore draft when moving to a new question/turn or on initial load
  useEffect(() => {
    if (step !== 'interview' || !attempt?.id || !studentUserId) return;
    pruneExpiredDrafts();
    const savedDraft = loadDraft(studentUserId, assignmentId, attempt.id, turnKey);
    if (savedDraft && savedDraft.trim()) {
      setAnswerText(savedDraft);
    }
  }, [step, attempt?.id, studentUserId, assignmentId, turnKey]);

  // Persist draft to localStorage on edit (automatically handles TTL timestamp)
  const handleAnswerChange = (value: string) => {
    setAnswerText(value);
    if (!attempt?.id || !studentUserId) return;
    saveDraft(studentUserId, assignmentId, attempt.id, turnKey, value);
  };

  const clearDraft = (turnId: string) => {
    if (!attempt?.id || !studentUserId) return;
    clearStoredDraft(studentUserId, assignmentId, attempt.id, turnId);
  };

  // Initialize or resume session
  const initSession = useCallback(async (retry: boolean | number = false, targetQuestion?: number) => {
    setBusy(true);
    setError('');
    const resolvedTarget = typeof retry === 'number' ? retry : targetQuestion;
    try {
      const res = await fetch('/api/schools/adaptive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_or_create',
          payload: {
            assignmentId,
            studentProfile: {
              experience_level: experienceLevel,
              academic_field: academicField || undefined,
              academic_stage: academicStage || undefined,
              evidence_sources: evidenceSources,
            },
            retry: typeof retry === 'number' ? retry : (resolvedTarget ? resolvedTarget : retry),
            targetQuestion: resolvedTarget,
          },
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not load interview session');

      setAttempt((prev) => ({
        id: body.result.attemptId,
        status: body.result.status,
        answers: prev?.answers || [],
        revision: prev?.revision || 0,
        attempt_number: body.result.attemptNumber,
        feedback_status: prev?.feedback_status || 'pending',
        evidence_detail: prev?.evidence_detail || null,
        evidence_covered: prev?.evidence_covered || null,
        universal_interview_id: body.result.universalInterviewId,
        delivery_mode: 'adaptive_v2',
      }));

      setCurrentQuestion(body.result.currentQuestion);
      setQuestionNumber(body.result.questionNumber);
      setTotalQuestions(body.result.totalQuestions);
      setProbeCount(body.result.probeCount);

      if (body.result.completed || body.result.status === 'submitted') {
        setStep('complete');
      } else {
        setStep('interview');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start interview');
    } finally {
      setBusy(false);
    }
  }, [assignmentId, experienceLevel, academicField, academicStage, evidenceSources]);

  // Handle one-time retry navigation intent
  useEffect(() => {
    if (!retryQuestion || retryStarted.current) return;
    retryStarted.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete('retry');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    if (submitted && !closed) {
      void initSession(retryQuestion, retryQuestion);
    }
  }, [retryQuestion, submitted, closed, initSession]);

  // Finalize submission function with idempotent retry capability
  const executeFinalize = async (attemptId: string) => {
    setStep('finalizing');
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/schools/adaptive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'finalize',
          payload: { attemptId },
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to finalize interview');

      setAttempt((prev) => (prev ? { ...prev, status: 'submitted' } : null));
      setStep('complete');
      setMessage('Interview complete! Your answers and evidence breakdown have been saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finalize interview. Please retry.');
      setStep('finalize_failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSendAnswer = async (overrideAnswer?: string) => {
    const textToSend = (overrideAnswer !== undefined ? overrideAnswer : answerText).trim();
    if (!attempt?.id || !textToSend || busy) return;
    setBusy(true);
    setError('');
    const submittedTurnKey = turnKey;
    try {
      const res = await fetch('/api/schools/adaptive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_turn',
          payload: {
            attemptId: attempt.id,
            answerText: textToSend,
          },
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not process turn');

      // Clear draft only after successful server acceptance of that answer
      clearDraft(submittedTurnKey);
      setAnswerText('');
      setShowFallbackConfirm(false);
      preservedTypedDraft.current = '';

      setCurrentQuestion(body.result.currentQuestion);
      setQuestionNumber(body.result.questionNumber);
      setTotalQuestions(body.result.totalQuestions);
      setProbeCount(body.result.probeCount);

      if (body.result.completed) {
        await executeFinalize(attempt.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send answer');
    } finally {
      setBusy(false);
    }
  };

  // Fallback button action: Non-destructive architecture
  const handleFallbackClick = () => {
    const trimmed = answerText.trim();
    if (!trimmed) {
      // Empty textarea: submit fallback intent directly
      void handleSendAnswer("I don't have a direct professional example for this.");
      return;
    }

    // Candidate has already typed text: preserve it and prompt for confirmation
    preservedTypedDraft.current = answerText;
    setShowFallbackConfirm(true);
  };

  const handleConfirmFallback = () => {
    // Send fallback action while leaving preservedTypedDraft recoverable
    setShowFallbackConfirm(false);
    void handleSendAnswer("I don't have a direct professional example for this.");
  };

  const handleCancelFallback = () => {
    // Restore preserved draft to textarea if needed
    if (preservedTypedDraft.current) {
      setAnswerText(preservedTypedDraft.current);
    }
    setShowFallbackConfirm(false);
  };

  // If already submitted, display completed view and feedback
  if (submitted) {
    const remainingAttempts = Math.max(0, maxAttempts - (attempt.attempt_number ?? 1));
    return (
      <>
        <section className="schools-card" style={{ maxWidth: '840px', margin: '20px auto' }}>
          <h2>Interview Completed (Attempt {attempt.attempt_number} of {maxAttempts})</h2>
          <p>
            Your adaptive interview has been submitted and stored for adviser review.
          </p>
        </section>

        <SchoolsFeedback
          attemptId={attempt.id}
          rubrics={questions.map((q) => q.rubric)}
          assignmentId={assignmentId}
          onRetry={(q) => void initSession(true, q)}
          retryBusy={busy}
          status={attempt.feedback_status}
          detail={attempt.evidence_detail}
          covered={attempt.evidence_covered}
        />

        {!closed && remainingAttempts > 0 && (
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <button disabled={busy} onClick={() => void initSession(true)}>
              {busy ? 'Preparing new attempt...' : `Start a new practice attempt (${remainingAttempts} remaining)`}
            </button>
          </div>
        )}

        {!closed && remainingAttempts <= 0 && (
          <p style={{ textAlign: 'center', color: '#64748b', marginTop: '20px', fontSize: '14px' }}>
            You have completed all {maxAttempts} practice attempts for this assignment.
          </p>
        )}
      </>
    );
  }

  return (
    <div style={{ maxWidth: '780px', margin: '20px auto' }}>
      {message && <p role="status" style={{ color: '#075c50', fontWeight: 'bold' }}>{message}</p>}
      {error && <p role="alert" style={{ color: '#dc2626', fontWeight: 'bold' }}>{error}</p>}

      {/* STEP 1: CONTEXT CHECK */}
      {step === 'profile_check' && (
        <section className="schools-card">
          <h2>Before we start: {roleTitle}</h2>
          <p style={{ color: '#4b5563', fontSize: '15px' }}>
            Tell us a little about where you are right now, so the questions fit your experience. It takes less than a minute.
          </p>

          <label>
            Where are you in your career or studies?
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
            >
              <option value="ENTRY">Student / Early Career (0–2 years)</option>
              <option value="PROFESSIONAL">Mid-Level Professional (3–5 years)</option>
              <option value="MANAGER">Experienced / Management (6+ years)</option>
            </select>
          </label>

          <label>
            Your degree or subject (optional)
            <input
              type="text"
              placeholder="e.g. BSc Finance &amp; Accounting, BEng Software Engineering"
              value={academicField}
              onChange={(e) => setAcademicField(e.target.value)}
            />
          </label>

          <label>
            Your year of study
            <select
              value={academicStage}
              onChange={(e) => setAcademicStage(e.target.value)}
            >
              <option value="">Choose your year of study</option>
              <option value="First year">First year</option>
              <option value="Second year">Second year</option>
              <option value="Third year">Third year</option>
              <option value="Fourth year or later">Fourth year or later</option>
              <option value="Final year">Final year</option>
              <option value="Postgraduate / Master's">Postgraduate / Master&apos;s</option>
              <option value="Doctoral">Doctoral</option>
              <option value="Recent graduate">Recent graduate</option>
              <option value="Diploma / vocational">Diploma / vocational</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <div style={{ margin: '16px 0' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
              Where could your examples come from? Tick all that apply.
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              {[
                { id: 'ACADEMIC', label: 'Coursework & Projects' },
                { id: 'INTERNSHIP', label: 'Internships & Placements' },
                { id: 'VOLUNTEER', label: 'Volunteering & Societies' },
                { id: 'PERSONAL_PROJECT', label: 'Personal Projects & Portfolio' },
                { id: 'EMPLOYMENT', label: 'Part-Time / Employment' },
              ].map((src) => (
                <label key={src.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={evidenceSources.includes(src.id as EvidenceType)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEvidenceSources([...evidenceSources, src.id as EvidenceType]);
                      } else {
                        setEvidenceSources(evidenceSources.filter((s) => s !== src.id));
                      }
                    }}
                  />
                  <span style={{ fontSize: '13px' }}>{src.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button disabled={busy || closed} onClick={() => void initSession(false)} style={{ marginTop: '16px' }}>
            {busy ? 'Getting your first question ready...' : 'Start the practice interview'}
          </button>
        </section>
      )}

      {/* STEP 2: ACTIVE CONVERSATIONAL INTERVIEW */}
      {step === 'interview' && currentQuestion && (
        <section className="schools-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#075c50', textTransform: 'uppercase' }}>
              Question {questionNumber} of {totalQuestions} · Attempt {attempt?.attempt_number ?? 1} of {maxAttempts}
            </span>
          </div>

          <h3 style={{ fontSize: '18px', color: '#163e39', lineHeight: 1.4, margin: '0 0 16px' }}>
            {currentQuestion.text}
          </h3>

          <label htmlFor="adaptive-answer">Your Response</label>
          <textarea
            id="adaptive-answer"
            rows={7}
            maxLength={12000}
            value={answerText}
            placeholder="Describe your specific actions, what you contributed, and the outcome or result..."
            disabled={busy || closed}
            onChange={(e) => handleAnswerChange(e.target.value)}
          />

          {showFallbackConfirm && (
            <div
              role="alertdialog"
              aria-label="Confirm alternative question"
              style={{
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                padding: '14px 16px',
                margin: '12px 0',
                color: '#92400e',
              }}
            >
              <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 600 }}>
                You have already typed an answer. Would you like to keep editing your response, or switch to an alternative question / broader setting?
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleCancelFallback}
                  style={{ background: '#075c50', color: '#fff', fontSize: '13px', padding: '8px 14px' }}
                >
                  Keep my response &amp; continue editing
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFallback}
                  style={{ background: '#ffffff', color: '#92400e', border: '1px solid #f59e0b', fontSize: '13px', padding: '8px 14px' }}
                >
                  I don&apos;t have a direct example (Proceed)
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <button
              type="button"
              disabled={busy || closed}
              onClick={handleFallbackClick}
              style={{ background: '#f1f5f9', color: '#475569', fontSize: '12px' }}
            >
              I don&apos;t have a direct example
            </button>

            <button
              disabled={busy || closed || !answerText.trim()}
              onClick={() => void handleSendAnswer()}
            >
              {busy ? 'One moment…' : 'Continue'}
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: FINALIZING IN PROGRESS */}
      {step === 'finalizing' && (
        <section className="schools-card" style={{ textAlign: 'center', padding: '32px' }}>
          <h2>Recording and Finalizing Your Practice Interview...</h2>
          <p style={{ color: '#4b5563', fontSize: '15px' }}>
            Please wait while we record your final evidence breakdown and link your completed attempt for adviser review.
          </p>
        </section>
      )}

      {/* STEP 4: FINALIZE FAILED (RECOVERABLE RETRY) */}
      {step === 'finalize_failed' && (
        <section className="schools-card" style={{ textAlign: 'center', padding: '32px', borderColor: '#fca5a5' }}>
          <h2 style={{ color: '#dc2626' }}>Submission Finalization Incomplete</h2>
          <p style={{ color: '#4b5563', fontSize: '15px', marginBottom: '20px' }}>
            All your interview turns have been safely recorded, but final submission could not be verified by the server.
          </p>
          {error && <p role="alert" style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: '20px' }}>{error}</p>}
          <button
            disabled={busy}
            onClick={() => attempt?.id && void executeFinalize(attempt.id)}
          >
            {busy ? 'Retrying finalization...' : 'Retry Finalization →'}
          </button>
        </section>
      )}

      {/* STEP 5: INTERVIEW COMPLETE */}
      {step === 'complete' && (
        <section className="schools-card" style={{ textAlign: 'center', padding: '32px' }}>
          <h2>Practice interview complete</h2>
          <p style={{ color: '#4b5563', fontSize: '15px', marginBottom: '24px' }}>
            Your responses across all {totalQuestions} questions have been finalized and recorded.
          </p>
          <button onClick={() => window.location.reload()}>
            View formative feedback &amp; evidence breakdown
          </button>
        </section>
      )}
    </div>
  );
}
