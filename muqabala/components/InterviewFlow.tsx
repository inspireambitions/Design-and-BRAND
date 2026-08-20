'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role } from '@/lib/roles';
import type { AnswerFeedback, Attempt } from '@/lib/scoring';
import { overallFromAnswers } from '@/lib/scoring';
import { saveAttempt } from '@/lib/storage';
import { track } from '@/lib/analytics';
import {
  isSpeechSupported,
  isOnDeviceRecognitionAvailable,
  startDictation,
  type SpeechSession,
} from '@/lib/speech';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';
import { FeedbackCard } from './FeedbackCard';
import { ScoreRing } from './ScoreRing';
import { RatingCard } from './RatingCard';

type Stage = 'check' | 'prep' | 'record' | 'review' | 'feedback' | 'done';

type CompletedAnswer = {
  questionId: string;
  questionText: string;
  transcript: string;
  feedback: AnswerFeedback;
};

type ScoringError = {
  creditsExhausted: boolean;
  answerTooLong: boolean;
};

class ScoringRequestError extends Error {
  constructor(
    readonly retryable: boolean,
    readonly retryAfterSeconds: number,
    readonly creditsExhausted: boolean,
    readonly answerTooLong: boolean,
  ) {
    super('Scoring request failed');
  }
}

function estimateMinutes(role: Role): number {
  const seconds = role.questions.reduce((s, q) => s + q.prepSeconds + q.answerSeconds, 0);
  return Math.max(5, Math.round(seconds / 60));
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function InterviewFlow({
  role,
  customTitle,
}: {
  role: Role;
  /** Job title typed by the candidate when practising a role not in the catalogue. */
  customTitle?: string;
}) {
  const { lang, t } = useLang();

  const [stage, setStage] = useState<Stage>('check');
  const [index, setIndex] = useState(0);
  const [attemptCount, setAttemptCount] = useState(1);

  /**
   * 'idle' means we have not asked yet — which must never be reported to the
   * candidate as "blocked". Only a real refusal is 'denied'.
   */
  const [cameraState, setCameraState] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [requestingCamera, setRequestingCamera] = useState(false);
  const [speechOk, setSpeechOk] = useState(true);
  const [onDeviceSpeech, setOnDeviceSpeech] = useState(false);
  const [voiceDeclined, setVoiceDeclined] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [scoringError, setScoringError] = useState<ScoringError | null>(null);
  const [retrySeconds, setRetrySeconds] = useState<number | null>(null);
  const [answers, setAnswers] = useState<CompletedAnswer[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dictationRef = useRef<SpeechSession | null>(null);
  const savedRef = useRef(false);
  const scoringInFlightRef = useRef(false);
  const scoringSessionRef = useRef<string | null>(null);
  const automaticRetriesRef = useRef(0);
  const [savedAttempt, setSavedAttempt] = useState<Attempt | null>(null);

  const useVoice = speechOk && !voiceDeclined;
  const question = role.questions[index];
  const isLast = index === role.questions.length - 1;
  const questionText = lang === 'ar' ? question.textAr : question.text;
  const hintText = lang === 'ar' ? question.hintAr : question.hint;

  useEffect(() => {
    const supported = isSpeechSupported();
    setSpeechOk(supported);
    if (!supported) return;
    let cancelled = false;
    isOnDeviceRecognitionAvailable(lang === 'ar' ? 'ar-AE' : 'en-US').then((local) => {
      if (!cancelled) setOnDeviceSpeech(local);
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const stopDictation = useCallback(() => {
    dictationRef.current?.stop();
    dictationRef.current = null;
    setInterim('');
  }, []);

  // Release camera and microphone when the component unmounts.
  useEffect(() => {
    return () => {
      dictationRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const enableCamera = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true;
    setRequestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 } },
        audio: true,
      });
      streamRef.current = stream;
      setCameraState('granted');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      return true;
    } catch {
      // Refused, dismissed, or no camera on the device. Practice continues by
      // typing — the camera is a rehearsal aid, never a requirement.
      setCameraState('denied');
      return false;
    } finally {
      setRequestingCamera(false);
    }
  }, []);

  // Re-attach the stream whenever the video element remounts between stages.
  useEffect(() => {
    if (cameraState === 'granted' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraState, stage]);

  const beginRecording = useCallback(() => {
    setTranscript('');
    setInterim('');
    setSecondsLeft(question.answerSeconds);
    setStage('record');
    if (useVoice) {
      dictationRef.current = startDictation(
        lang === 'ar' ? 'ar-AE' : 'en-US',
        (finalText, interimText) => {
          setTranscript(finalText);
          setInterim(interimText);
        },
        () => setSpeechOk(false),
      );
    }
  }, [lang, question.answerSeconds, useVoice]);

  const finishAnswer = useCallback(() => {
    stopDictation();
    setStage('review');
  }, [stopDictation]);

  const startPrep = useCallback(() => {
    setSecondsLeft(question.prepSeconds);
    setStage('prep');
  }, [question.prepSeconds]);

  // Countdown for both the prep and recording stages.
  useEffect(() => {
    if (stage !== 'prep' && stage !== 'record') return;
    if (secondsLeft <= 0) {
      if (stage === 'prep') beginRecording();
      else finishAnswer();
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [stage, secondsLeft, beginRecording, finishAnswer]);

  const submitForScoring = useCallback(async () => {
    if (scoringInFlightRef.current) return;
    scoringInFlightRef.current = true;
    setIsScoring(true);
    setScoringError(null);
    setRetrySeconds(null);
    if (!scoringSessionRef.current) {
      scoringSessionRef.current =
        typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Scoring-Session': scoringSessionRef.current,
        },
        body: JSON.stringify({
          roleId: role.id,
          questionId: question.id,
          transcript,
          lang,
          roleTitle: customTitle,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { code?: string; retryable?: boolean; retryAfterSeconds?: number };
        } | null;
        const headerDelay = Number(response.headers.get('Retry-After'));
        const requestedDelay = body?.error?.retryAfterSeconds ?? headerDelay;
        const delay = Number.isFinite(requestedDelay)
          ? Math.max(2, Math.min(120, Math.ceil(requestedDelay)))
          : 20;
        throw new ScoringRequestError(
          body?.error?.retryable ??
            (response.status === 409 || response.status === 429 || response.status >= 500),
          delay,
          body?.error?.code === 'credits_exhausted' || response.status === 402,
          body?.error?.code === 'answer_too_long' || response.status === 413,
        );
      }
      const data = (await response.json()) as { feedback: AnswerFeedback };
      setFeedback(data.feedback);
      setStage('feedback');
      scoringSessionRef.current = null;
      automaticRetriesRef.current = 0;
    } catch (error) {
      const requestError =
        error instanceof ScoringRequestError
          ? error
          : new ScoringRequestError(true, 20, false, false);
      setScoringError({
        creditsExhausted: requestError.creditsExhausted,
        answerTooLong: requestError.answerTooLong,
      });
      if (requestError.retryable && automaticRetriesRef.current < 2) {
        automaticRetriesRef.current += 1;
        setRetrySeconds(requestError.retryAfterSeconds);
      }
    } finally {
      window.clearTimeout(timeoutId);
      scoringInFlightRef.current = false;
      setIsScoring(false);
    }
  }, [customTitle, lang, question.id, role.id, transcript]);

  useEffect(() => {
    if (retrySeconds === null) return;
    if (retrySeconds <= 0) {
      setRetrySeconds(null);
      void submitForScoring();
      return;
    }
    const id = window.setTimeout(() => setRetrySeconds((seconds) =>
      seconds === null ? null : seconds - 1,
    ), 1000);
    return () => window.clearTimeout(id);
  }, [retrySeconds, submitForScoring]);

  const retryQuestion = useCallback(() => {
    setAttemptCount((c) => c + 1);
    setFeedback(null);
    setScoringError(null);
    setRetrySeconds(null);
    scoringSessionRef.current = null;
    automaticRetriesRef.current = 0;
    setTranscript('');
    setInterim('');
    startPrep();
  }, [startPrep]);

  const advance = useCallback(() => {
    if (!feedback) return;
    const completed: CompletedAnswer = {
      questionId: question.id,
      questionText,
      transcript,
      feedback,
    };
    const nextAnswers = [...answers, completed];
    setAnswers(nextAnswers);
    setFeedback(null);
    setScoringError(null);
    setRetrySeconds(null);
    scoringSessionRef.current = null;
    automaticRetriesRef.current = 0;
    setTranscript('');
    setInterim('');
    setAttemptCount(1);

    if (isLast) {
      setStage('done');
    } else {
      setIndex((i) => i + 1);
      setSecondsLeft(role.questions[index + 1].prepSeconds);
      setStage('prep');
    }
  }, [answers, feedback, index, isLast, question.id, questionText, role.questions, transcript]);

  // Persist the finished interview once, when results are shown.
  useEffect(() => {
    if (stage !== 'done' || savedRef.current || answers.length === 0) return;
    savedRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const attempt: Attempt = {
      id: `${role.id}-${Date.now()}`,
      roleId: role.id,
      roleTitle: role.title,
      startedAt: new Date().toISOString(),
      overallScore: overallFromAnswers(answers),
      answers,
    };
    saveAttempt(attempt);
    setSavedAttempt(attempt);
    track('interview_completed', {
      role_id: role.id,
      lang,
      overall_score: attempt.overallScore,
      questions_answered: attempt.answers.length,
      scoring_source: attempt.answers[0]?.feedback.source ?? 'unknown',
    });
  }, [answers, role.id, role.title, stage]);

  const wordCount = `${transcript} ${interim}`.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="shell shell-narrow">
      <TopBar showProgressLink={false} />

      <div className="rail" aria-hidden="true">
        {role.questions.map((q, i) => (
          <span
            key={q.id}
            className={`rail-step ${i < index ? 'done' : i === index ? 'current' : ''}`}
          />
        ))}
      </div>
      <p className="tiny" style={{ marginBottom: '1.4rem' }}>
        {lang === 'ar' ? role.titleAr : role.title} · {t('question')} {index + 1} {t('of')}{' '}
        {role.questions.length}
      </p>

      {/* ---------- device check ---------- */}
      {stage === 'check' && (
        <div className="stack">
          <div>
            <p className="eyebrow">{t('beforeStart')}</p>
            <h1 style={{ fontSize: '1.75rem' }}>
              {lang === 'ar' ? role.titleAr : role.title}
            </h1>
            <p className="lede" style={{ marginTop: '0.6rem' }}>
              {t('beforeStartBody')}
            </p>
          </div>

          <div className="card stack">
            <div className="video-frame">
              <video ref={videoRef} muted playsInline />
              {cameraState !== 'granted' && (
                <div className="video-placeholder">
                  {cameraState === 'denied' ? t('cameraDeniedHelp') : t('cameraIdle')}
                </div>
              )}
            </div>

            <ul className="checklist">
              <li>
                <span
                  className={`check-icon ${
                    cameraState === 'granted' ? '' : cameraState === 'denied' ? 'fail' : 'pending'
                  }`}
                >
                  {cameraState === 'granted' ? '✓' : cameraState === 'denied' ? '!' : '·'}
                </span>
                <span>
                  {t('checkCamera')} &amp; {t('checkMic')}
                </span>
              </li>
              <li>
                <span className={`check-icon ${useVoice ? '' : 'fail'}`}>
                  {useVoice ? '✓' : '!'}
                </span>
                <span>
                  {t('checkTranscript')}
                  <br />
                  <span className="tiny">
                    {!speechOk
                      ? t('transcriptUnsupported')
                      : voiceDeclined
                        ? t('transcriptUnsupported')
                        : t('transcriptReady')}
                  </span>
                </span>
              </li>
            </ul>

            {useVoice && (
              <div className={`notice ${onDeviceSpeech ? '' : 'notice-warn'} tiny`}>
                {onDeviceSpeech ? t('speechOnDevice') : t('speechCloud')}
                {!onDeviceSpeech && (
                  <div className="row" style={{ marginTop: '0.6rem' }}>
                    <button
                      type="button"
                      className="btn btn-quiet"
                      onClick={() => setVoiceDeclined(true)}
                    >
                      {t('speechTypeInstead')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {speechOk && voiceDeclined && (
              <div className="row">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setVoiceDeclined(false)}
                >
                  {t('speechUseVoice')}
                </button>
              </div>
            )}

            {cameraState !== 'granted' && (
              <button
                type="button"
                className="btn btn-quiet"
                disabled={requestingCamera}
                onClick={() => void enableCamera()}
              >
                {cameraState === 'denied' ? t('cameraRetry') : t('enableCamera')}
              </button>
            )}
          </div>

          <div className="card-flat">
            <p className="eyebrow" style={{ marginBottom: '0.7rem' }}>
              {t('whatToExpect')}
            </p>
            <ul className="checklist">
              <li>
                <span className="check-icon">{role.questions.length}</span>
                <span>{t('expect1')}</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>{t('expect2')}</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>{t('expect3')}</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>{t('expect4')}</span>
              </li>
              <li>
                <span className="check-icon">{estimateMinutes(role)}</span>
                <span>{t('expectTime')}</span>
              </li>
            </ul>
            <p className="notice tiny" style={{ marginTop: '0.9rem' }}>
              {t('scoringPolicy')}
            </p>
          </div>

          <div className="row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={requestingCamera}
              onClick={async () => {
                track('interview_started', { role_id: role.id, lang });
                // Ask here rather than in a separate step: this tap is the user
                // gesture browsers want, and it comes after the disclosure the
                // candidate has just read.
                await enableCamera();
                startPrep();
              }}
            >
              {requestingCamera ? t('cameraStarting') : t('imReady')}
            </button>
            <Link href="/" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
              {t('back')}
            </Link>
          </div>
        </div>
      )}

      {/* ---------- preparation ---------- */}
      {stage === 'prep' && (
        <div className="stack">
          <div className="card stack">
            <p className="eyebrow">
              {t('question')} {index + 1}
            </p>
            <h2 style={{ fontSize: '1.35rem' }}>{questionText}</h2>
            <div className="coach-tip">
              <strong>{t('tip')}</strong>
              {hintText}
            </div>
          </div>

          <div className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <p className="eyebrow" style={{ marginBottom: 0 }}>
              {t('prepTime')}
            </p>
            <div className={`timer-big ${secondsLeft <= 5 ? 'low' : ''}`}>
              {formatClock(secondsLeft)}
            </div>
            <p className="muted">{t('prepBody')}</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn btn-primary" onClick={beginRecording}>
                {t('startAnswer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- recording ---------- */}
      {stage === 'record' && (
        <div className="stack">
          <div className="card stack">
            <p className="eyebrow">
              {t('question')} {index + 1}
            </p>
            <h2 style={{ fontSize: '1.25rem' }}>{questionText}</h2>
          </div>

          <div className="card stack">
            <div className="video-frame">
              <video ref={videoRef} muted playsInline />
              {cameraState !== 'granted' && (
                <div className="video-placeholder">
                  {cameraState === 'denied' ? t('cameraDeniedHelp') : t('cameraIdle')}
                </div>
              )}
              <span className="video-badge">
                <span className="rec-dot" aria-hidden="true" />
                {t('recording')} · {formatClock(secondsLeft)}
              </span>
            </div>

            <div className="meter" aria-hidden="true">
              <div
                className={`meter-fill ${secondsLeft <= 15 ? 'crit' : 'gold'}`}
                style={{ width: `${(secondsLeft / question.answerSeconds) * 100}%` }}
              />
            </div>

            <div>
              <p className="eyebrow" style={{ marginBottom: '0.4rem' }}>
                {t('yourAnswer')}
              </p>
              {useVoice ? (
                <div className="transcript" aria-live="polite">
                  {transcript}
                  {interim && <span className="transcript-interim"> {interim}</span>}
                  {!transcript && !interim && (
                    <span className="transcript-interim">{t('typeHint')}</span>
                  )}
                </div>
              ) : (
                <textarea
                  className="answer-box"
                  placeholder={t('typeAnswer')}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                />
              )}
              <p className="tiny" style={{ marginTop: '0.4rem' }}>
                {wordCount} {t('words')}
              </p>
            </div>

            <button type="button" className="btn btn-record" onClick={finishAnswer}>
              {t('stopAndScore')}
            </button>
          </div>
        </div>
      )}

      {/* ---------- review before scoring ---------- */}
      {stage === 'review' && (
        <div className="stack">
          <div className="card stack">
            <p className="eyebrow">{t('yourAnswer')}</p>
            <h2 style={{ fontSize: '1.2rem' }}>{questionText}</h2>
            <textarea
              className="answer-box"
              placeholder={t('typeAnswer')}
              value={transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                setScoringError(null);
                setRetrySeconds(null);
                scoringSessionRef.current = null;
                automaticRetriesRef.current = 0;
              }}
            />
            <p className="tiny">{t('typeHint')}</p>
            {scoringError && (
              <div className="notice notice-warn" role="status" aria-live="polite">
                <strong>
                  {scoringError.answerTooLong
                    ? t('scoreAnswerTooLongTitle')
                    : t('scoreUnavailableTitle')}
                </strong>
                <p className="tiny" style={{ marginTop: '0.35rem' }}>
                  {scoringError.answerTooLong
                    ? t('scoreAnswerTooLongBody')
                    : scoringError.creditsExhausted
                    ? t('scoreCreditsBody')
                    : t('scoreUnavailableBody')}
                </p>
                {retrySeconds !== null && (
                  <p className="tiny" style={{ marginTop: '0.35rem' }}>
                    {t('scoreRetryingIn')} {retrySeconds} {t('secondsShort')}.
                  </p>
                )}
              </div>
            )}
            <div className="row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitForScoring}
                disabled={isScoring || transcript.trim().length === 0}
              >
                {isScoring
                  ? t('scoring')
                  : scoringError
                    ? t('retryNow')
                    : t('getFeedback')}
              </button>
              <button type="button" className="btn btn-quiet" onClick={retryQuestion}>
                {t('tryAgain')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- feedback ---------- */}
      {stage === 'feedback' && feedback && (
        <div className="stack">
          <FeedbackCard feedback={feedback} attempt={attemptCount} />
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={advance}>
              {isLast ? t('finishInterview') : t('nextQuestion')}
            </button>
            <button type="button" className="btn btn-quiet" onClick={retryQuestion}>
              {t('tryAgain')}
            </button>
          </div>
        </div>
      )}

      {/* ---------- results ---------- */}
      {stage === 'done' && (
        <div className="stack-lg">
          <div className="card stack">
            <p className="eyebrow">{t('interviewComplete')}</p>
            <div className="score-head">
              <ScoreRing value={overallFromAnswers(answers)} />
              <div>
                <h2 style={{ fontSize: '1.4rem' }}>
                  {t('overallScore')}: {overallFromAnswers(answers)}/100
                </h2>
                <p className="muted" style={{ marginTop: '0.3rem' }}>
                  {t('resultsBody')}
                </p>
              </div>
            </div>
            <p className="tiny">{t('savedLocally')}</p>
          </div>

          {savedAttempt && <RatingCard attempt={savedAttempt} />}

          {answers.map((answer, i) => (
            <div key={`${answer.questionId}-${i}`} className="stack-sm">
              <p className="eyebrow" style={{ marginBottom: 0 }}>
                {t('question')} {i + 1}
              </p>
              <h3 style={{ fontSize: '1.05rem' }}>{answer.questionText}</h3>
              <FeedbackCard feedback={answer.feedback} />
            </div>
          ))}

          <div className="row">
            <Link
              href={`/practice/${role.id}`}
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              {t('practiceAgain')}
            </Link>
            <Link href="/" className="btn btn-quiet" style={{ textDecoration: 'none' }}>
              {t('tryAnotherRole')}
            </Link>
            <Link href="/progress" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
              {t('seeProgress')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
