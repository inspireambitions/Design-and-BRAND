'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Question, Role } from '@/lib/roles';
import type { AnswerFeedback, Attempt } from '@/lib/scoring';
import { overallFromAnswers } from '@/lib/scoring';
import { saveAttempt } from '@/lib/storage';
import { track } from '@/lib/analytics';
import { startRecording, startLevelMeter, type AnswerRecorder, type LevelMeter } from '@/lib/media';
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
import { CoachingCard } from './CoachingCard';

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


/** The whole interview as plain text — copyable, sendable, readable anywhere. */
function buildReportText(
  roleTitle: string,
  overall: number | null,
  answers: CompletedAnswer[],
  labels: { report: string; score: string; question: string; yourAnswer: string; worked: string; improve: string },
): string {
  const lines: string[] = [`${labels.report} — ${roleTitle}`];
  if (overall !== null) lines.push(`${labels.score}: ${overall}/100`);
  lines.push('');
  answers.forEach((a, i) => {
    lines.push(`${labels.question} ${i + 1}: ${a.questionText}`);
    if (a.feedback.status === 'scored') lines.push(`${labels.score}: ${a.feedback.score}/100`);
    lines.push(`${labels.yourAnswer}: ${a.transcript || '—'}`);
    if (a.feedback.strengths.length) lines.push(`${labels.worked}: ${a.feedback.strengths.join(' | ')}`);
    if (a.feedback.improvements.length) lines.push(`${labels.improve}: ${a.feedback.improvements.join(' | ')}`);
    lines.push('');
  });
  return lines.join('\n');
}

export function InterviewFlow({
  role,
  customTitle,
  tailored = false,
  interviewToken,
  fellBack = false,
  mockQuestions,
}: {
  role: Role;
  /** Job title typed by the candidate when practising a role not in the catalogue. */
  customTitle?: string;
  /** True when the questions were generated from a pasted job advert. */
  tailored?: boolean;
  /** Signed rubric that lets the server score a generated interview. */
  interviewToken?: string;
  /** True when an advert was pasted but tailoring did not succeed. */
  fellBack?: boolean;
  /** Eight-question set for Full Mock mode; absent when the role cannot support it. */
  mockQuestions?: Question[];
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
  const [micLevel, setMicLevel] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [reportCopied, setReportCopied] = useState(false);
  const [speechOk, setSpeechOk] = useState(true);
  const [onDeviceSpeech, setOnDeviceSpeech] = useState(false);
  const [voiceDeclined, setVoiceDeclined] = useState(false);
  /**
   * Guided: revealed questions, feedback after each answer, retakes.
   * Mock: eight questions one at a time, no interruptions, report at the end.
   */
  const [mode, setMode] = useState<'guided' | 'mock'>('guided');
  const [recordingLive, setRecordingLive] = useState(false);
  const lastHeardRef = useRef(0);
  const [meterUnavailable, setMeterUnavailable] = useState(false);
  const [streamLost, setStreamLost] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [scoringError, setScoringError] = useState<ScoringError | null>(null);
  const [retrySeconds, setRetrySeconds] = useState<number | null>(null);
  const [answers, setAnswers] = useState<CompletedAnswer[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dictationRef = useRef<SpeechSession | null>(null);
  const recorderRef = useRef<AnswerRecorder | null>(null);
  const meterRef = useRef<LevelMeter | null>(null);
  const playbackRef = useRef<HTMLVideoElement | null>(null);
  const savedRef = useRef(false);
  const scoringInFlightRef = useRef(false);
  const finalizingRef = useRef(false);
  const advancingRef = useRef(false);
  const scoringSessionRef = useRef<string | null>(null);
  const automaticRetriesRef = useRef(0);
  const [savedAttempt, setSavedAttempt] = useState<Attempt | null>(null);

  const useVoice = speechOk && !voiceDeclined;
  const activeQuestions =
    mode === 'mock' && mockQuestions && mockQuestions.length > 0 ? mockQuestions : role.questions;
  const question = activeQuestions[index];
  // Latched, not instantaneous: ordinary pauses between sentences must not
  // flip the caption to "we cannot hear you" four times a second.
  const heardRecently = micLevel > 0.08 || Date.now() - lastHeardRef.current < 2500;
  const isLast = index === activeQuestions.length - 1;
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
    const captured = dictationRef.current?.stop();
    dictationRef.current = null;
    // A dictation session that heard nothing must not wipe the transcript:
    // when speech dies mid-question the candidate falls back to typing, and
    // an empty capture here would erase what they typed.
    const heard = captured
      ? [captured.finalText.trim(), captured.interimText.trim()].filter(Boolean).join(' ')
      : '';
    if (heard) setTranscript(heard);
    setInterim('');
  }, []);

  const switchToTyping = useCallback(async () => {
    stopDictation();
    setVoiceDeclined(true);
    meterRef.current?.stop();
    meterRef.current = null;
    setMicLevel(0);

    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      const unusedUrl = await recorder.stop();
      if (unusedUrl) URL.revokeObjectURL(unusedUrl);
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraState('idle');
  }, [stopDictation]);

  // Release camera and microphone when the component unmounts.
  useEffect(() => {
    return () => {
      dictationRef.current?.stop();
      meterRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Object URLs are session-only; free the previous one whenever it is replaced.
  useEffect(() => {
    return () => {
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    };
  }, [playbackUrl]);

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
    if (playbackUrl) {
      URL.revokeObjectURL(playbackUrl);
      setPlaybackUrl(null);
    }
    setSecondsLeft(question.answerSeconds);
    setStage('record');

    setStreamLost(false);
    const live = Boolean(useVoice && streamRef.current);
    setRecordingLive(live);
    if (useVoice && streamRef.current) {
      recorderRef.current = startRecording(streamRef.current);
      meterRef.current = startLevelMeter(
        streamRef.current,
        (level) => {
          if (level > 0.08) lastHeardRef.current = Date.now();
          setMicLevel(level);
        },
        () => setMeterUnavailable(true),
      );
    }
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
  }, [lang, playbackUrl, question.answerSeconds, useVoice]);

  const finishAnswer = useCallback(async () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    setIsFinalizing(true);
    try {
      stopDictation();
      meterRef.current?.stop();
      meterRef.current = null;
      setMicLevel(0);
      setStage('review');

      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder) {
        const url = await recorder.stop();
        if (url) setPlaybackUrl(url);
      }
    } finally {
      finalizingRef.current = false;
      setIsFinalizing(false);
    }
  }, [stopDictation]);

  // The OS kills camera and microphone on a phone call or an app switch, and
  // nothing tells the page. Watch the tracks themselves, and when the page
  // comes back to the foreground check whether capture died while it was away
  // — checking on return avoids false alarms on desktop tab switches.
  useEffect(() => {
    if (stage !== 'record' || !recordingLive) return;
    const stream = streamRef.current;
    if (!stream) return;
    const markLost = () => {
      stopDictation();
      meterRef.current?.stop();
      meterRef.current = null;
      setMicLevel(0);
      setStreamLost(true);
    };
    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      track.addEventListener('ended', markLost);
    });
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (stream.getTracks().some((track) => track.readyState === 'ended')) markLost();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      tracks.forEach((track) => track.removeEventListener('ended', markLost));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [stage, recordingLive, stopDictation]);

  // An interview in progress is unsaved work: warn before the tab is closed.
  useEffect(() => {
    const inProgress = stage !== 'check' && stage !== 'done';
    if (!inProgress) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [stage]);

  const startPrep = useCallback(() => {
    setSecondsLeft(question.prepSeconds);
    setStage('prep');
  }, [question.prepSeconds]);

  // Countdown for both the prep and recording stages.
  useEffect(() => {
    if (stage !== 'prep' && stage !== 'record') return;
    // Typing has no clock: cutting someone off mid-sentence with a timer they
    // were never shown punishes exactly the people pushed into typing by a
    // camera denial or a speech failure. "Review answer" is the only exit.
    if (stage === 'record' && !useVoice) return;
    // A lost stream freezes the clock instead of racing on over dead capture.
    if (stage === 'record' && streamLost) return;
    if (secondsLeft <= 0) {
      if (stage === 'prep') beginRecording();
      else finishAnswer();
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [stage, secondsLeft, beginRecording, finishAnswer, useVoice, streamLost]);

  // completeCurrentAnswer is declared later in the file; the mock path inside
  // submitForScoring reaches it through a ref kept current on every render.
  const completeAnswerRef = useRef<((fb: AnswerFeedback) => void) | null>(null);

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
          interviewToken,
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
      scoringSessionRef.current = null;
      automaticRetriesRef.current = 0;
      if (mode === 'mock') {
        // The mock does not interrupt: the score is banked and the interview
        // moves straight on, exactly like a real first round. Everything is
        // shown together in the final report.
        completeAnswerRef.current?.(data.feedback);
      } else {
        setFeedback(data.feedback);
        setStage('feedback');
      }
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
  }, [customTitle, interviewToken, lang, mode, question.id, role.id, transcript]);

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

  const completeCurrentAnswer = useCallback((answerFeedback: AnswerFeedback) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    const completed: CompletedAnswer = {
      questionId: question.id,
      questionText,
      transcript,
      feedback: answerFeedback,
    };
    const nextAnswers = [...answers, completed];
    setAnswers(nextAnswers);
    // Release this answer's recording now, including on the final question.
    if (playbackUrl) {
      URL.revokeObjectURL(playbackUrl);
      setPlaybackUrl(null);
    }
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
      setSecondsLeft(activeQuestions[index + 1].prepSeconds);
      setStage('prep');
    }
    window.setTimeout(() => {
      advancingRef.current = false;
    }, 0);
  }, [answers, index, isLast, playbackUrl, question.id, questionText, activeQuestions, transcript]);

  completeAnswerRef.current = completeCurrentAnswer;

  const advance = useCallback(() => {
    if (feedback) completeCurrentAnswer(feedback);
  }, [completeCurrentAnswer, feedback]);

  const continueWithoutFeedback = useCallback(() => {
    setRetrySeconds(null);
    setScoringError(null);
    scoringSessionRef.current = null;
    automaticRetriesRef.current = 0;
    completeCurrentAnswer({
      questionId: question.id,
      score: 0,
      status: 'unscored',
      headline: t('feedbackSkippedTitle'),
      competencies: [],
      strengths: [],
      improvements: [t('feedbackSkippedBody')],
      coachTip: '',
      source: 'none',
    });
  }, [completeCurrentAnswer, question.id, t]);

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
    setSaveFailed(!saveAttempt(attempt));
    setSavedAttempt(attempt);
    track('interview_completed', {
      role_id: role.id,
      lang,
      overall_score: attempt.overallScore ?? undefined,
      questions_answered: attempt.answers.length,
      scoring_source: attempt.answers[0]?.feedback.source ?? 'unknown',
    });
  }, [answers, role.id, role.title, stage]);

  const wordCount = `${transcript} ${interim}`.trim().split(/\s+/).filter(Boolean).length;
  // Speech recognition is unreliable inside iOS in-app browsers: it reports as
  // supported, starts without error, and simply never returns words. If a
  // candidate has been speaking for a while with nothing transcribed, stop
  // letting them wonder and offer typing.
  const elapsed = question.answerSeconds - secondsLeft;
  const silentTranscript = stage === 'record' && elapsed > 12 && wordCount === 0;

  return (
    <div className="shell shell-narrow">
      <TopBar showProgressLink={false} locked={stage !== 'check' && stage !== 'done'} />

      <div className="rail" aria-hidden="true">
        {activeQuestions.map((q, i) => (
          <span
            key={q.id}
            className={`rail-step ${i < index ? 'done' : i === index ? 'current' : ''}`}
          />
        ))}
      </div>
      <p className="tiny" style={{ marginBottom: '1.4rem' }}>
        {lang === 'ar' ? role.titleAr : role.title} · {t('question')} {index + 1} {t('of')}{' '}
        {activeQuestions.length}
      </p>

      {/* ---------- device check ---------- */}
      {stage === 'check' && (
        <div className="stack">
          <div>
            <p className="eyebrow">{t('beforeStart')}</p>
            <h1 style={{ fontSize: '1.75rem' }}>
              {lang === 'ar' ? role.titleAr : role.title}
            </h1>
            {role.id === 'custom' && (
              <span className={`chip ${tailored ? 'chip-gold' : ''}`} style={{ marginTop: '0.5rem' }}>
                {tailored ? t('tailoredBadge') : t('genericBadge')}
              </span>
            )}
            {fellBack && !tailored && (
              <p className="notice notice-warn tiny" style={{ marginTop: '0.5rem' }}>
                {t('genericWhy')}
              </p>
            )}
            <p className="lede" style={{ marginTop: '0.6rem' }}>
              {t('beforeStartShort')}
            </p>
            <details className="disclosure" style={{ marginTop: '0.5rem' }}>
              <summary className="tiny">{t('beforeStartMore')}</summary>
              <p className="tiny" style={{ marginTop: '0.4rem' }}>
                {t('beforeStartBody')}
              </p>
            </details>
          </div>

          {/* ---------- how do you want to practise ---------- */}
          <div className="mode-row">
            <button
              type="button"
              className={`mode-card ${mode === 'guided' ? 'on' : ''}`}
              aria-pressed={mode === 'guided'}
              onClick={() => setMode('guided')}
            >
              <span className="mode-title">{t('modeGuidedTitle')}</span>
              <span className="tiny">{t('modeGuidedBody')}</span>
            </button>
            {mockQuestions && mockQuestions.length > 0 && (
              <button
                type="button"
                className={`mode-card ${mode === 'mock' ? 'on' : ''}`}
                aria-pressed={mode === 'mock'}
                onClick={() => setMode('mock')}
              >
                <span className="mode-title">{t('modeMockTitle')}</span>
                <span className="tiny">{t('modeMockBody')}</span>
              </button>
            )}
          </div>

          {/* Guided shows the questions before the camera is ever mentioned —
              proof before commitment. The mock keeps them hidden on purpose. */}
          {mode === 'guided' ? (
            <div className="card-flat">
              <p className="eyebrow" style={{ marginBottom: '0.6rem' }}>
                {t('revealTitle')}
              </p>
              <ol className="reveal-list">
                {activeQuestions.map((q) => (
                  <li key={q.id}>{lang === 'ar' ? q.textAr : q.text}</li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="notice tiny" style={{ margin: 0 }}>
              {t('mockHiddenNote')}
            </p>
          )}

          <div className="card stack">
            {useVoice ? (
              <>
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
                    <span className="check-icon">✓</span>
                    <span>
                      {t('checkTranscript')}
                      <br />
                      <span className="tiny">{t('transcriptReady')}</span>
                    </span>
                  </li>
                </ul>

              <div className={`notice ${onDeviceSpeech ? '' : 'notice-warn'} tiny`}>
                {onDeviceSpeech ? t('speechOnDevice') : t('speechCloud')}
                {!onDeviceSpeech && (
                  <div className="row" style={{ marginTop: '0.6rem' }}>
                    <button
                      type="button"
                      className="btn btn-quiet"
                      onClick={() => void switchToTyping()}
                    >
                      {t('speechTypeInstead')}
                    </button>
                  </div>
                )}
              </div>
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
              </>
            ) : (
              <div className="notice">
                <strong>{t('typingModeTitle')}</strong>
                <p className="tiny" style={{ marginTop: '0.35rem' }}>{t('typingModeBody')}</p>
                {speechOk && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ marginTop: '0.7rem' }}
                    onClick={() => setVoiceDeclined(false)}
                  >
                    {t('speechUseVoice')}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="card-flat">
            <p className="eyebrow" style={{ marginBottom: '0.7rem' }}>
              {t('whatToExpect')}
            </p>
            <ul className="checklist">
              <li>
                <span className="check-icon">{activeQuestions.length}</span>
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
                <span className="check-icon">{estimateMinutes({ ...role, questions: activeQuestions })}</span>
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
                if (useVoice) await enableCamera();
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
            <p className="muted">{useVoice ? t('prepBody') : t('prepBodyType')}</p>
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
            {useVoice && (
              <>
                <div className="video-frame">
                  <video ref={videoRef} muted playsInline />
                  {cameraState !== 'granted' && (
                    <div className="video-placeholder">
                      {cameraState === 'denied' ? t('cameraDeniedHelp') : t('cameraIdle')}
                    </div>
                  )}
                  {recordingLive && !streamLost ? (
                    <span className="video-badge">
                      <span className="rec-dot" aria-hidden="true" />
                      {t('recording')} · {formatClock(secondsLeft)}
                    </span>
                  ) : (
                    // No capture is happening: never claim "Recording" to
                    // someone who declined the camera or whose stream died.
                    <span className="video-badge">
                      {t('timeLeft')} · {formatClock(secondsLeft)}
                    </span>
                  )}
                </div>

                <div className="meter" aria-hidden="true">
                  <div
                    className={`meter-fill ${secondsLeft <= 15 ? 'crit' : 'gold'}`}
                    style={{ width: `${(secondsLeft / question.answerSeconds) * 100}%` }}
                  />
                </div>

                {/* Proof the microphone is live. Reassurance only — never
                    recorded or scored — and shown only when a working meter
                    exists: a silent meter must hide, not accuse. */}
                {recordingLive && !streamLost && !meterUnavailable && (
                  <div className="mic-row">
                    <span className="mic-label">{t('micLive')}</span>
                    <span className="mic-bars" aria-hidden="true">
                      {[0.08, 0.2, 0.34, 0.5, 0.68].map((threshold) => (
                        <span key={threshold} className={`mic-bar ${micLevel > threshold ? 'on' : ''}`} />
                      ))}
                    </span>
                    <span className="tiny">{heardRecently ? t('micHearing') : t('micQuiet')}</span>
                  </div>
                )}

                {streamLost && (
                  <div className="notice notice-warn tiny">
                    {t('streamLostBody')}
                    <div className="row" style={{ marginTop: '0.6rem' }}>
                      <button type="button" className="btn btn-quiet" onClick={retryQuestion}>
                        {t('streamLostRestart')}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={finishAnswer}>
                        {t('streamLostKeep')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {useVoice && silentTranscript && (
              <div className="notice notice-warn tiny">
                {t('speechNotWorking')}
                <div className="row" style={{ marginTop: '0.6rem' }}>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={() => {
                      void switchToTyping();
                    }}
                  >
                    {t('speechTypeInstead')}
                  </button>
                </div>
              </div>
            )}

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

            <button
              type="button"
              className="btn btn-record"
              onClick={finishAnswer}
              disabled={isFinalizing}
            >
              {useVoice ? t('stopAndScore') : t('reviewTypedAnswer')}
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

            {playbackUrl && (
              <div className="stack-sm">
                <span className="rate-label">{t('watchBack')}</span>
                <video
                  ref={playbackRef}
                  className="playback"
                  src={playbackUrl}
                  controls
                  playsInline
                  preload="metadata"
                />
                <p className="tiny">{t('watchBackHint')}</p>
              </div>
            )}

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
            {transcript.trim().length === 0 && (
              <p className="tiny" role="status">{t('answerRequired')}</p>
            )}
            <div className="row flow-actions">
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
              {mode === 'guided' && (
                <button type="button" className="btn btn-quiet" onClick={retryQuestion}>
                  {t('tryAgain')}
                </button>
              )}
              {scoringError && (
                <button type="button" className="btn btn-ghost" onClick={continueWithoutFeedback}>
                  {t('continueWithoutFeedback')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- feedback ---------- */}
      {stage === 'feedback' && feedback && (
        <div className="stack">
          <FeedbackCard feedback={feedback} attempt={attemptCount} />
          <div className="row flow-actions">
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
            {overallFromAnswers(answers) !== null ? (
              <div className="score-head">
                <ScoreRing value={overallFromAnswers(answers) ?? 0} />
                <div>
                  <h2 style={{ fontSize: '1.4rem' }}>
                    {t('overallScore')}: {overallFromAnswers(answers)}/100
                  </h2>
                  <p className="muted" style={{ marginTop: '0.3rem' }}>
                    {t('resultsBody')}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h2 style={{ fontSize: '1.3rem' }}>{t('noScoreTitle')}</h2>
                <p className="muted" style={{ marginTop: '0.3rem' }}>
                  {t('noScoreBody')}
                </p>
              </div>
            )}
            <p className="report-meta">
              {role.title} · {new Date().toLocaleDateString()}
            </p>
            {saveFailed ? (
              <p className="notice notice-warn tiny" style={{ margin: 0 }}>
                {t('storageBlocked')}
              </p>
            ) : (
              <p className="tiny">{t('savedLocally')}</p>
            )}

            <div className="row no-print">
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => {
                    navigator
                      .share({
                        text: buildReportText(role.title, overallFromAnswers(answers), answers, {
                          report: t('reportTitle'),
                          score: t('overallScore'),
                          question: t('question'),
                          yourAnswer: t('yourAnswer'),
                          worked: t('whatWorked'),
                          improve: t('whatToImprove'),
                        }),
                      })
                      .catch(() => {});
                  }}
                >
                  {t('shareReport')}
                </button>
              )}
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  // window.print is missing inside some in-app browsers; a
                  // button that throws silently is worse than none.
                  try {
                    if (typeof window.print === 'function') window.print();
                    else setCopyFailed(true);
                  } catch {
                    setCopyFailed(true);
                  }
                }}
              >
                {t('saveReport')}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      buildReportText(role.title, overallFromAnswers(answers), answers, {
                        report: t('reportTitle'),
                        score: t('overallScore'),
                        question: t('question'),
                        yourAnswer: t('yourAnswer'),
                        worked: t('whatWorked'),
                        improve: t('whatToImprove'),
                      }),
                    );
                    setReportCopied(true);
                  } catch {
                    // Blocked clipboard (common in in-app browsers): show the
                    // text to hold-and-copy instead of failing silently.
                    setCopyFailed(true);
                  }
                }}
              >
                {reportCopied ? t('rateCopied') : t('copyReport')}
              </button>
            </div>
            {copyFailed && (
              <div className="stack-sm no-print">
                <p className="notice notice-warn tiny" style={{ margin: 0 }}>
                  {t('copyFallbackHint')}
                </p>
                <textarea
                  className="answer-box"
                  readOnly
                  value={buildReportText(role.title, overallFromAnswers(answers), answers, {
                    report: t('reportTitle'),
                    score: t('overallScore'),
                    question: t('question'),
                    yourAnswer: t('yourAnswer'),
                    worked: t('whatWorked'),
                    improve: t('whatToImprove'),
                  })}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </div>
            )}
            <p className="tiny no-print">{t('saveReportHint')}</p>
          </div>

          {(() => {
            // Strongest answer / focus area / next action — computed only from
            // answers the AI actually scored, and only when there are at least
            // two so "strongest" and "focus" are different questions.
            const scored = answers
              .map((a, i) => ({ ...a, index: i }))
              .filter((a) => a.feedback.status === 'scored');
            if (scored.length < 2) return null;
            const best = scored.reduce((a, b) => (b.feedback.score > a.feedback.score ? b : a));
            const worst = scored.reduce((a, b) => (b.feedback.score < a.feedback.score ? b : a));
            if (best.index === worst.index) return null;
            const action = worst.feedback.coachTip || worst.feedback.improvements[0] || null;
            return (
              <div className="card stack-sm">
                <div className="summary-item">
                  <span className="rate-label">{t('strongest')}</span>
                  <p style={{ marginTop: '0.25rem' }}>
                    {t('question')} {best.index + 1} · {best.feedback.score}/100 — {best.questionText}
                  </p>
                </div>
                <div className="summary-item">
                  <span className="rate-label">{t('weakest')}</span>
                  <p style={{ marginTop: '0.25rem' }}>
                    {t('question')} {worst.index + 1} · {worst.feedback.score}/100 — {worst.questionText}
                  </p>
                </div>
                {action && (
                  <div className="summary-item">
                    <span className="rate-label">{t('nextAction')}</span>
                    <p style={{ marginTop: '0.25rem' }}>{action}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {savedAttempt && (
            <div className="no-print">
              <RatingCard attempt={savedAttempt} />
            </div>
          )}

          <CoachingCard />

          {answers.map((answer, i) => (
            <div key={`${answer.questionId}-${i}`} className="stack-sm">
              <p className="eyebrow" style={{ marginBottom: 0 }}>
                {t('question')} {i + 1}
              </p>
              <h3 style={{ fontSize: '1.05rem' }}>{answer.questionText}</h3>
              {answer.transcript && (
                <div className="answer-recap">
                  <span className="rate-label">{t('yourAnswer')}</span>
                  <p className="muted" style={{ marginTop: '0.25rem' }}>
                    {answer.transcript}
                  </p>
                </div>
              )}
              <FeedbackCard feedback={answer.feedback} />
            </div>
          ))}

          <div className="row no-print">
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
