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
import { EmailSignIn } from './EmailSignIn';

type Stage = 'check' | 'prep' | 'record' | 'review' | 'feedback' | 'done';

type CompletedAnswer = {
  questionId: string;
  questionText: string;
  transcript: string;
  feedback: AnswerFeedback;
};

type PreviousTry = {
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
  const [answerMethod, setAnswerMethod] = useState<'speak' | 'type' | 'video'>('speak');
  /**
   * Guided: revealed questions, feedback after each answer, retakes.
   * Mock: eight questions one at a time, no interruptions, report at the end.
   */
  const [mode, setMode] = useState<'guided' | 'mock'>('guided');
  const [recordingLive, setRecordingLive] = useState(false);
  const lastHeardRef = useRef(0);
  const [meterUnavailable, setMeterUnavailable] = useState(false);
  const [streamLost, setStreamLost] = useState(false);
  const [deviceFallback, setDeviceFallback] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [transcriptConfirmed, setTranscriptConfirmed] = useState(false);
  const [interim, setInterim] = useState('');
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [scoringError, setScoringError] = useState<ScoringError | null>(null);
  const [retrySeconds, setRetrySeconds] = useState<number | null>(null);
  const [answers, setAnswers] = useState<CompletedAnswer[]>([]);
  const [previousTry, setPreviousTry] = useState<PreviousTry | null>(null);
  const [serverAttemptId, setServerAttemptId] = useState<string | null>(null);
  const [reportUnlocked, setReportUnlocked] = useState(false);
  const [reportGateRequired, setReportGateRequired] = useState(false);
  const [resumedQuestions, setResumedQuestions] = useState<Question[] | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');
  const [showContinueSignIn, setShowContinueSignIn] = useState(false);

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

  const selectedAnswerMethod = speechOk ? answerMethod : 'type';
  const useVoice = selectedAnswerMethod !== 'type';
  const useVideo = selectedAnswerMethod === 'video';
  const activeQuestions = resumedQuestions ?? (
    mode === 'mock' && mockQuestions && mockQuestions.length > 0
      ? mockQuestions
      : role.questions.slice(0, 1)
  );
  const question = activeQuestions[index];
  // Latched, not instantaneous: ordinary pauses between sentences must not
  // flip the caption to "we cannot hear you" four times a second.
  const heardRecently = micLevel > 0.08 || Date.now() - lastHeardRef.current < 2500;
  const isLast = index === activeQuestions.length - 1;
  const questionText = lang === 'ar' ? question.textAr : question.text;
  const hintText = lang === 'ar' ? question.hintAr : question.hint;

  const localDraftKey = `muqabala.draft.v1.${role.id}`;

  const persistProgress = useCallback(async (payload: {
    questionIndex: number;
    transcript: string;
    currentQuestion: number;
    status: 'in_progress' | 'completed';
  }) => {
    if (!serverAttemptId) return false;
    setSyncState('syncing');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(`/api/interviews/${serverAttemptId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          setSyncState('saved');
          return true;
        }
      } catch {
        // The retry below covers brief network and platform interruptions.
      }
      if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 400 * (attempt + 1)));
    }
    setSyncState('error');
    return false;
  }, [serverAttemptId]);

  // Restore either a signed-in cross-device attempt or this browser's latest draft.
  useEffect(() => {
    let cancelled = false;
    const resumeId = new URLSearchParams(window.location.search).get('resume');
    const restore = (draft: {
      id?: string | null;
      index?: number;
      mode?: 'guided' | 'mock';
      transcript?: string;
      answers?: CompletedAnswer[];
      unlocked?: boolean;
      questionSnapshot?: Question[];
    }) => {
      if (cancelled) return;
      const restoredQuestions = Array.isArray(draft.questionSnapshot) && draft.questionSnapshot.length
        ? draft.questionSnapshot
        : activeQuestions;
      const safeIndex = Math.max(0, Math.min(restoredQuestions.length - 1, draft.index ?? 0));
      setServerAttemptId(draft.id ?? null);
      setReportGateRequired(Boolean(draft.id));
      setResumedQuestions(restoredQuestions);
      setIndex(safeIndex);
      if (draft.mode) setMode(draft.mode);
      setTranscript(draft.transcript ?? '');
      setAnswers(Array.isArray(draft.answers) ? draft.answers : []);
      setReportUnlocked(Boolean(draft.unlocked));
      setSecondsLeft(restoredQuestions[safeIndex]?.prepSeconds ?? 30);
      setStage('prep');
    };

    if (resumeId) {
      fetch(`/api/interviews/${encodeURIComponent(resumeId)}/report`, { cache: 'no-store' })
        .then(async (response) => response.ok ? response.json() : null)
        .then((report) => {
          if (!report) return;
          restore({
            id: report.id,
            index: report.currentQuestion,
            mode: report.mode,
            unlocked: report.unlocked,
            questionSnapshot: report.questionSnapshot,
            transcript: (report.answers ?? []).find(
              (answer: { questionIndex: number }) => answer.questionIndex === report.currentQuestion,
            )?.transcript ?? '',
            answers: (report.answers ?? [])
              .filter((answer: { feedback?: AnswerFeedback | null }) => answer.feedback)
              .map((answer: { questionId: string; questionText: string; transcript: string; feedback: AnswerFeedback }) => ({
                questionId: answer.questionId,
                questionText: answer.questionText,
                transcript: answer.transcript,
                feedback: answer.feedback,
              })),
          });
        })
        .catch(() => {});
    } else {
      try {
        const raw = window.localStorage.getItem(localDraftKey);
        if (raw) {
          const draft = JSON.parse(raw);
          const age = Date.now() - Date.parse(draft.updatedAt ?? '');
          if (Number.isFinite(age) && age <= 24 * 60 * 60 * 1000) restore(draft);
          else window.localStorage.removeItem(localDraftKey);
        }
      } catch {
        // Local storage may be blocked. The interview still works in memory.
      }
    }
    return () => { cancelled = true; };
    // Restore exactly once for this role.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role.id]);

  useEffect(() => {
    if (stage === 'check') return;
    try {
      if (stage === 'done') window.localStorage.removeItem(localDraftKey);
      else window.localStorage.setItem(localDraftKey, JSON.stringify({
        id: serverAttemptId, index, mode, transcript, answers, updatedAt: new Date().toISOString(),
      }));
    } catch {
      // Local storage is an availability fallback, never a requirement.
    }
  }, [answers, index, localDraftKey, mode, serverAttemptId, stage, transcript]);

  // Save typed or transcribed words after a short pause. This runs before AI
  // scoring, so a provider outage or closed tab cannot erase the answer.
  useEffect(() => {
    if (!serverAttemptId || !transcript.trim() || (stage !== 'record' && stage !== 'review')) return;
    const timeout = window.setTimeout(() => {
      void persistProgress({
        questionIndex: index,
        transcript,
        currentQuestion: index,
        status: 'in_progress',
      });
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [index, persistProgress, serverAttemptId, stage, transcript]);

  useEffect(() => {
    if (!serverAttemptId || !transcript.trim() || stage === 'check' || stage === 'done') return;
    const flush = () => {
      void fetch(`/api/interviews/${serverAttemptId}`, {
        method: 'PATCH',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIndex: index,
          transcript,
          currentQuestion: index,
          status: 'in_progress',
        }),
      });
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [index, serverAttemptId, stage, transcript]);

  const createServerAttempt = useCallback(async (): Promise<string | null> => {
    if (serverAttemptId) return serverAttemptId;
    try {
      const response = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleId: role.id,
          roleTitle: customTitle || role.title,
          language: lang,
          mode,
          questions: activeQuestions.map(({ id, text, textAr, competencies, hint, hintAr, prepSeconds, answerSeconds }) => ({
            id, text, textAr, competencies, hint, hintAr, prepSeconds, answerSeconds,
          })),
          interviewToken,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Account storage is part of the report lock. Failure must never turn
        // the paid-in-email gate off and expose Questions 2 onward.
        setReportGateRequired(true);
        return null;
      }
      setReportGateRequired(true);
      setServerAttemptId(data.id);
      setReportUnlocked(Boolean(data.unlocked));
      return data.id as string;
    } catch {
      setReportGateRequired(true);
      return null;
    }
  }, [activeQuestions, customTitle, interviewToken, lang, mode, role.id, role.title, serverAttemptId]);

  useEffect(() => {
    const supported = isSpeechSupported();
    setSpeechOk(supported);
    if (!supported) {
      setAnswerMethod('type');
      return;
    }
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
    setAnswerMethod('type');
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

  const enableMicrophone = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true;
    setRequestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      streamRef.current = stream;
      return true;
    } catch {
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
    if (useVoice) {
      const speechSession = startDictation(
        lang === 'ar' ? 'ar-AE' : 'en-US',
        (finalText, interimText) => {
          setTranscript(finalText);
          setInterim(interimText);
        },
        () => {
          setSpeechOk(false);
          setDeviceFallback(true);
          void switchToTyping();
        },
      );
      if (!speechSession) {
        setSpeechOk(false);
        setDeviceFallback(true);
        void switchToTyping();
        return;
      }
      dictationRef.current = speechSession;
      if (streamRef.current) {
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
    }
  }, [lang, playbackUrl, question.answerSeconds, switchToTyping, useVoice]);

  const finishAnswer = useCallback(async () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    setIsFinalizing(true);
    try {
      stopDictation();
      meterRef.current?.stop();
      meterRef.current = null;
      setMicLevel(0);
      setTranscriptConfirmed(false);
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
    // Quick Practice has a suggested answer length, never a cut-off. The
    // candidate ends it with Finish answer. Full Mock keeps the real timer.
    if (stage === 'record' && mode === 'guided') return;
    // A lost stream freezes the clock instead of racing on over dead capture.
    if (stage === 'record' && streamLost) return;
    if (secondsLeft <= 0) {
      if (stage === 'prep') beginRecording();
      else finishAnswer();
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [stage, secondsLeft, beginRecording, finishAnswer, useVoice, streamLost, mode]);

  // completeCurrentAnswer is declared later in the file; the mock path inside
  // submitForScoring reaches it through a ref kept current on every render.
  const completeAnswerRef = useRef<((fb: AnswerFeedback) => Promise<void>) | null>(null);

  const submitForScoring = useCallback(async () => {
    if (scoringInFlightRef.current || !transcriptConfirmed) return;
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
          interviewId: serverAttemptId ?? undefined,
          questionIndex: index,
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
      const data = (await response.json()) as { feedback: AnswerFeedback; locked?: boolean };
      scoringSessionRef.current = null;
      automaticRetriesRef.current = 0;
      if (mode === 'mock' || data.locked) {
        // The mock does not interrupt: the score is banked and the interview
        // moves straight on, exactly like a real first round. Everything is
        // shown together in the final report.
        await completeAnswerRef.current?.(data.feedback);
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
  }, [customTitle, index, interviewToken, lang, mode, question.id, role.id, serverAttemptId, transcript, transcriptConfirmed]);

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
    if (feedback && transcript.trim()) {
      setPreviousTry({ transcript, feedback });
    }
    setAttemptCount((c) => c + 1);
    setFeedback(null);
    setScoringError(null);
    setRetrySeconds(null);
    scoringSessionRef.current = null;
    automaticRetriesRef.current = 0;
    setTranscript('');
    setTranscriptConfirmed(false);
    setInterim('');
    startPrep();
  }, [feedback, startPrep, transcript]);

  const completeCurrentAnswer = useCallback(async (answerFeedback: AnswerFeedback) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    const completed: CompletedAnswer = {
      questionId: question.id,
      questionText,
      transcript,
      feedback: answerFeedback,
    };
    const nextAnswers = [...answers, completed];
    if (serverAttemptId) {
      const persisted = await persistProgress({
        questionIndex: index,
        transcript,
        currentQuestion: isLast ? index : index + 1,
        status: isLast ? 'completed' : 'in_progress',
      });
      if (!persisted) {
        advancingRef.current = false;
        return;
      }
    }
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
    setTranscriptConfirmed(false);
    setPreviousTry(null);
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
  }, [answers, index, isLast, playbackUrl, question.id, questionText, activeQuestions, persistProgress, serverAttemptId, transcript]);

  completeAnswerRef.current = completeCurrentAnswer;

  const advance = useCallback(() => {
    if (feedback) void completeCurrentAnswer(feedback);
  }, [completeCurrentAnswer, feedback]);

  const continueWithoutFeedback = useCallback(() => {
    setRetrySeconds(null);
    setScoringError(null);
    scoringSessionRef.current = null;
    automaticRetriesRef.current = 0;
    void completeCurrentAnswer({
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

  const startFullMock = useCallback(() => {
    if (!mockQuestions || mockQuestions.length < 8) return;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    savedRef.current = false;
    setMode('mock');
    setResumedQuestions(null);
    setServerAttemptId(null);
    setReportGateRequired(false);
    setReportUnlocked(false);
    setAnswers([]);
    setIndex(0);
    setAttemptCount(1);
    setTranscript('');
    setTranscriptConfirmed(false);
    setPreviousTry(null);
    setFeedback(null);
    setPlaybackUrl(null);
    setStage('check');
  }, [mockQuestions]);

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
    // The account database is the durable copy. Avoid retaining a second full
    // transcript in this browser once server persistence is available.
    setSaveFailed(serverAttemptId ? false : !saveAttempt(attempt));
    setSavedAttempt(attempt);
    track('interview_completed', {
      role_id: role.id,
      lang,
      overall_score: attempt.overallScore ?? undefined,
      questions_answered: attempt.answers.length,
      scoring_source: attempt.answers[0]?.feedback.source ?? 'unknown',
    });
  }, [answers, lang, role.id, role.title, serverAttemptId, stage]);

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
      {serverAttemptId && stage !== 'check' && stage !== 'done' && syncState !== 'idle' && (
        <p className={`tiny ${syncState === 'error' ? 'notice notice-warn' : ''}`} role="status">
          {syncState === 'syncing' ? t('progressSyncing') : syncState === 'saved' ? t('progressSaved') : t('progressSaveFailed')}
        </p>
      )}
      {serverAttemptId && !reportUnlocked && stage !== 'check' && stage !== 'done' && (
        <div className="stack-sm" style={{ marginBottom: '1rem' }}>
          <button type="button" className="btn btn-ghost" onClick={() => setShowContinueSignIn((shown) => !shown)}>
            {showContinueSignIn ? t('hideSignIn') : t('saveContinueDevice')}
          </button>
          {showContinueSignIn && (
            <EmailSignIn compact next={`/practice/${encodeURIComponent(role.id)}?resume=${encodeURIComponent(serverAttemptId)}`} />
          )}
        </div>
      )}

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

          {/* ---------- interview format ---------- */}
          <div className="mode-row">
            {mode === 'mock' && mockQuestions && mockQuestions.length > 0 && (
              <button
                type="button"
                className={`mode-card ${mode === 'mock' ? 'on' : ''}`}
                aria-pressed={mode === 'mock'}
                onClick={() => setMode('mock')}
              >
                <span className="method-title-row">
                  <span className="mode-title">{t('modeMockTitle')}</span>
                  <span className="choice-note">{t('modeRecommended')}</span>
                </span>
                <span className="tiny">{t('modeMockBody')}</span>
              </button>
            )}
            <button
              type="button"
              className={`mode-card ${mode === 'guided' ? 'on' : ''}`}
              aria-pressed={mode === 'guided'}
              onClick={() => setMode('guided')}
            >
              <span className="mode-title">{t('modeGuidedTitle')}</span>
                <span className="tiny">{t('modeGuidedBody')}</span>
            </button>
          </div>

          {/* ---------- answer method ---------- */}
          <section className="answer-method" aria-labelledby="answer-method-title">
            <div>
              <p className="eyebrow" id="answer-method-title">
                {t('answerMethodTitle')}
              </p>
              <p className="tiny" style={{ marginTop: '0.25rem' }}>
                {t('answerMethodBody')}
              </p>
            </div>
            <div className="mode-row" role="group" aria-labelledby="answer-method-title">
              <button
                type="button"
                className={`mode-card method-card ${selectedAnswerMethod === 'speak' ? 'on' : ''}`}
                aria-pressed={selectedAnswerMethod === 'speak'}
                aria-disabled={!speechOk}
                onClick={() => {
                  if (!speechOk) return;
                  streamRef.current?.getTracks().forEach((track) => track.stop());
                  streamRef.current = null;
                  setCameraState('idle');
                  setAnswerMethod('speak');
                  setDeviceFallback(false);
                }}
              >
                <span className="method-title-row">
                  <span className="mode-title">{t('answerSpeakTitle')}</span>
                  {speechOk && <span className="choice-note">{t('answerSpeakBest')}</span>}
                </span>
                <span className="tiny">
                  {speechOk ? t('answerSpeakBody') : t('answerVideoUnavailable')}
                </span>
              </button>
              <button
                type="button"
                className={`mode-card method-card ${selectedAnswerMethod === 'type' ? 'on' : ''}`}
                aria-pressed={selectedAnswerMethod === 'type'}
                onClick={() => void switchToTyping()}
              >
                <span className="method-title-row">
                  <span className="mode-title">{t('answerTypeTitle')}</span>
                  <span className="choice-note">{t('answerTypeBest')}</span>
                </span>
                <span className="tiny">{t('answerTypeBody')}</span>
              </button>
              <button
                type="button"
                className={`mode-card method-card ${selectedAnswerMethod === 'video' ? 'on' : ''}`}
                aria-pressed={selectedAnswerMethod === 'video'}
                aria-disabled={!speechOk}
                onClick={() => {
                  if (!speechOk) return;
                  streamRef.current?.getTracks().forEach((track) => track.stop());
                  streamRef.current = null;
                  setCameraState('idle');
                  setAnswerMethod('video');
                  setDeviceFallback(false);
                }}
              >
                <span className="method-title-row">
                  <span className="mode-title">{t('answerVideoTitle')}</span>
                  <span className="choice-note">{t('answerVideoBest')}</span>
                </span>
                <span className="tiny">{t('answerVideoBody')}</span>
              </button>
            </div>
          </section>

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

          <div className="card stack method-details">
            {useVideo ? (
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
            ) : useVoice ? (
              <div className="notice">
                <strong>{t('speakingModeTitle')}</strong>
                <p className="tiny" style={{ marginTop: '0.35rem' }}>{t('speakingModeBody')}</p>
                <p className="tiny" style={{ marginTop: '0.5rem' }}>
                  {onDeviceSpeech ? t('speechOnDevice') : t('speechCloud')}
                </p>
              </div>
            ) : (
              <div className="notice">
                <strong>{t('typingModeTitle')}</strong>
                <p className="tiny" style={{ marginTop: '0.35rem' }}>
                  {mode === 'mock' ? t('typingModeBodyMock') : t('typingModeBody')}
                </p>
              </div>
            )}
          </div>

          <div className="card-flat expectation-summary">
            <p className="eyebrow">{t('whatToExpect')}</p>
            <p className="expectation-keyline">
              <strong>
                {activeQuestions.length === 1
                  ? t('expectOneQuestion')
                  : `${activeQuestions.length} ${t('expect1')}`}
              </strong>
              <span aria-hidden="true">·</span>
              <strong>
                {mode === 'mock' ? t('expectMockTime') : t('expectQuickTime')}
              </strong>
            </p>
            <p className="tiny">
              {mode === 'mock' ? t('modeMockExpect') : t('modeGuidedExpect')}
            </p>
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
                await createServerAttempt();
                // Ask here rather than in a separate step: this tap is the user
                // gesture browsers want, and it comes after the disclosure the
                // candidate has just read.
                if (useVoice) {
                  const captureReady = useVideo ? await enableCamera() : await enableMicrophone();
                  if (!captureReady) {
                    setDeviceFallback(true);
                    await switchToTyping();
                  }
                }
                startPrep();
              }}
            >
              {requestingCamera
                ? t('cameraStarting')
                : useVideo
                  ? t('continueWithVideo')
                  : useVoice
                    ? t('continueWithSpeaking')
                  : t('continueWithTyping')}
            </button>
            <Link href="/practice" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
              {t('back')}
            </Link>
          </div>
        </div>
      )}

      {/* ---------- preparation ---------- */}
      {stage === 'prep' && (
        <div className="stack">
          {deviceFallback && (
            <div className="notice notice-warn" role="status">
              <strong>{t('deviceFallbackTitle')}</strong>
              <p className="tiny" style={{ marginTop: '0.35rem' }}>{t('deviceFallbackBody')}</p>
            </div>
          )}
          <div className="card stack">
            <p className="eyebrow">
              {t('question')} {index + 1}
            </p>
            <h2 style={{ fontSize: '1.35rem' }}>{questionText}</h2>
            {mode === 'guided' && (
              <div className="coach-tip">
                <strong>{t('tip')}</strong>
                {hintText}
              </div>
            )}
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
          {deviceFallback && !useVoice && (
            <div className="notice notice-warn" role="status">
              <strong>{t('deviceFallbackTitle')}</strong>
              <p className="tiny" style={{ marginTop: '0.35rem' }}>{t('deviceFallbackBody')}</p>
            </div>
          )}
          <div className="card stack">
            <p className="eyebrow">
              {t('question')} {index + 1}
            </p>
            <h2 style={{ fontSize: '1.25rem' }}>{questionText}</h2>
          </div>

          <div className="card stack">
            {useVoice && (
              <>
                {useVideo ? (
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
                        {t('recording')} · {mode === 'guided' ? t('suggestedTime') : t('timeLeft')} · {formatClock(secondsLeft)}
                      </span>
                    ) : (
                      <span className="video-badge">
                        {mode === 'guided' ? t('suggestedTime') : t('timeLeft')} · {formatClock(secondsLeft)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="notice" role="status">
                    <strong>{recordingLive ? t('recording') : t('speakingModeTitle')}</strong>
                    <p className="tiny" style={{ marginTop: '0.35rem' }}>
                      {mode === 'guided' ? t('suggestedTime') : t('timeLeft')}: {formatClock(secondsLeft)}. {mode === 'guided' ? t('finishWhenReady') : ''}
                    </p>
                  </div>
                )}

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
                  aria-label={t('yourAnswer')}
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
                {useVideo ? (
                  <video
                    ref={playbackRef}
                    className="playback"
                    src={playbackUrl}
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <audio className="playback" src={playbackUrl} controls preload="metadata" />
                )}
                <p className="tiny">{t('watchBackHint')}</p>
              </div>
            )}

            <textarea
              className="answer-box"
              aria-label={t('yourAnswer')}
              placeholder={t('typeAnswer')}
              value={transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                setTranscriptConfirmed(false);
                setScoringError(null);
                setRetrySeconds(null);
                scoringSessionRef.current = null;
                automaticRetriesRef.current = 0;
              }}
            />
            <p className="tiny">{t('typeHint')}</p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={transcriptConfirmed}
                onChange={(event) => setTranscriptConfirmed(event.target.checked)}
              />
              <span>
                <strong>{t('isThisWhatYouSaid')}</strong>
                <span className="tiny">{t('confirmWrittenWords')}</span>
              </span>
            </label>
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
                disabled={isScoring || transcript.trim().length === 0 || !transcriptConfirmed}
              >
                {isScoring
                  ? mode === 'mock' ? t('preparingNext') : t('scoring')
                  : scoringError
                    ? t('retryNow')
                    : mode === 'mock' ? t('confirmAnswer') : t('getFeedback')}
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
          {previousTry && (
            <div className="card stack">
              <div>
                <p className="eyebrow">{t('answerComparison')}</p>
                <h3 style={{ fontSize: '1.2rem' }}>{t('compareYourAnswers')}</h3>
                <p className="tiny" style={{ marginTop: '0.35rem' }}>{t('comparisonNoClaim')}</p>
              </div>
              <div className="comparison-grid">
                <div className="answer-recap">
                  <span className="rate-label">{t('firstAnswer')}</span>
                  <p>{previousTry.transcript}</p>
                </div>
                <div className="answer-recap">
                  <span className="rate-label">{t('latestAnswer')}</span>
                  <p>{transcript}</p>
                </div>
              </div>
              {(() => {
                const sameScoringVersion = previousTry.feedback.scoringVersion === feedback.scoringVersion;
                const sameRubricVersion = previousTry.feedback.rubricVersion === feedback.rubricVersion;
                if (!sameScoringVersion || !sameRubricVersion) {
                  return <p className="notice notice-warn tiny">{t('comparisonVersionChanged')}</p>;
                }
                const before = new Map(previousTry.feedback.competencies.map((item) => [item.id, item.evidence]));
                const after = new Map(feedback.competencies.map((item) => [item.id, item.evidence]));
                const added = feedback.competencies.filter((item) => item.evidence && item.evidence !== before.get(item.id));
                const removed = previousTry.feedback.competencies.filter((item) => item.evidence && item.evidence !== after.get(item.id));
                if (!added.length && !removed.length) return <p className="tiny">{t('noEvidenceChange')}</p>;
                return (
                  <div className="comparison-grid">
                    <div>
                      <p className="eyebrow">{t('evidenceAdded')}</p>
                      <ul className="feedback-list">
                        {added.map((item) => <li key={item.id}>{item.evidence}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="eyebrow">{t('evidenceRemoved')}</p>
                      <ul className="feedback-list">
                        {removed.map((item) => <li key={item.id}>{item.evidence}</li>)}
                      </ul>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
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
      {stage === 'done' && reportGateRequired && !reportUnlocked && (
        <div className="stack-lg">
          <div className="card stack">
            <p className="eyebrow">{t('firstResult')}</p>
            <h2>{t('firstFeedbackReady')}</h2>
            <p className="muted">{t('unlockSummary')}</p>
          </div>
          {answers[0] && <div className="stack-sm">
            <p className="eyebrow">{t('question')} 1</p>
            <h3>{answers[0].questionText}</h3>
            <div className="answer-recap"><span className="rate-label">{t('yourAnswer')}</span><p>{answers[0].transcript}</p></div>
            <FeedbackCard feedback={answers[0].feedback} />
          </div>}
          {mode === 'guided' && mockQuestions && mockQuestions.length >= 8 && (
            <div className="card stack-sm">
              <h2 style={{ fontSize: '1.3rem' }}>{t('readyForFullMock')}</h2>
              <p className="muted">{t('readyForFullMockBody')}</p>
              <button type="button" className="btn btn-primary" onClick={startFullMock}>
                {t('startFullMock')}
              </button>
            </div>
          )}
          <div className="card stack">
            <h2 style={{ fontSize: '1.3rem' }}>{t('unlockFullReport')}</h2>
            <p className="muted">{t('unlockBody')}</p>
            {serverAttemptId ? (
              <EmailSignIn compact next={`/account/reports/${serverAttemptId}`} />
            ) : (
              <div className="notice notice-warn stack-sm">
                <strong>{t('firstFeedbackReady')}</strong>
                <p className="tiny">{t('accountStorageUnavailable')}</p>
                <button type="button" className="btn btn-quiet" onClick={() => void createServerAttempt()}>{t('retryAccountStorage')}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {stage === 'done' && reportUnlocked && (
        <div className="stack-lg">
          {mode === 'guided' && mockQuestions && mockQuestions.length >= 8 && (
            <div className="card stack-sm">
              <h2 style={{ fontSize: '1.3rem' }}>{t('readyForFullMock')}</h2>
              <p className="muted">{t('readyForFullMockBody')}</p>
              <button type="button" className="btn btn-primary" onClick={startFullMock}>
                {t('startFullMock')}
              </button>
            </div>
          )}
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
            <Link href="/practice" className="btn btn-quiet" style={{ textDecoration: 'none' }}>
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
