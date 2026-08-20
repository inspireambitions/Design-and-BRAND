'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role } from '@/lib/roles';
import type { AnswerFeedback, Attempt } from '@/lib/scoring';
import { overallFromAnswers } from '@/lib/scoring';
import { saveAttempt } from '@/lib/storage';
import { isSpeechSupported, startDictation, type SpeechSession } from '@/lib/speech';
import { useLang } from './LanguageProvider';
import { TopBar } from './TopBar';
import { FeedbackCard } from './FeedbackCard';
import { ScoreRing } from './ScoreRing';

type Stage = 'check' | 'prep' | 'record' | 'review' | 'feedback' | 'done';

type CompletedAnswer = {
  questionId: string;
  questionText: string;
  transcript: string;
  feedback: AnswerFeedback;
};

function estimateMinutes(role: Role): number {
  const seconds = role.questions.reduce((s, q) => s + q.prepSeconds + q.answerSeconds, 0);
  return Math.max(5, Math.round(seconds / 60));
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function InterviewFlow({ role }: { role: Role }) {
  const { lang, t } = useLang();

  const [stage, setStage] = useState<Stage>('check');
  const [index, setIndex] = useState(0);
  const [attemptCount, setAttemptCount] = useState(1);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [speechOk, setSpeechOk] = useState(true);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [scoringFailed, setScoringFailed] = useState(false);
  const [answers, setAnswers] = useState<CompletedAnswer[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dictationRef = useRef<SpeechSession | null>(null);
  const savedRef = useRef(false);

  const question = role.questions[index];
  const isLast = index === role.questions.length - 1;
  const questionText = lang === 'ar' ? question.textAr : question.text;
  const hintText = lang === 'ar' ? question.hintAr : question.hint;

  useEffect(() => {
    setSpeechOk(isSpeechSupported());
  }, []);

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

  const enableCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 } },
        audio: true,
      });
      streamRef.current = stream;
      setCameraOn(true);
      setCameraError(false);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError(true);
      setCameraOn(false);
    }
  }, []);

  // Re-attach the stream whenever the video element remounts between stages.
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOn, stage]);

  const beginRecording = useCallback(() => {
    setTranscript('');
    setInterim('');
    setSecondsLeft(question.answerSeconds);
    setStage('record');
    if (speechOk) {
      dictationRef.current = startDictation(
        lang === 'ar' ? 'ar-AE' : 'en-US',
        (finalText, interimText) => {
          setTranscript(finalText);
          setInterim(interimText);
        },
        () => setSpeechOk(false),
      );
    }
  }, [lang, question.answerSeconds, speechOk]);

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
    setIsScoring(true);
    setScoringFailed(false);
    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleId: role.id,
          questionId: question.id,
          transcript,
          lang,
        }),
      });
      if (!response.ok) throw new Error(`Scoring failed: ${response.status}`);
      const data = (await response.json()) as { feedback: AnswerFeedback };
      setFeedback(data.feedback);
      setStage('feedback');
    } catch {
      setFeedback({
        questionId: question.id,
        score: 0,
        headline: lang === 'ar' ? 'تعذّر التقييم' : 'Could not score this answer',
        competencies: [],
        strengths: [],
        improvements: [
          lang === 'ar'
            ? 'حدث خطأ في الاتصال. تحقق من الإنترنت وحاول مرة أخرى — إجابتك محفوظة أدناه.'
            : 'Something went wrong connecting. Check your internet and try again — your answer is saved below.',
        ],
        coachTip:
          lang === 'ar'
            ? 'إجابتك لم تُفقد. اضغط "أرسل إجابتي مرة أخرى" لإعادة إرسالها كما هي.'
            : 'Your answer is not lost. Press “Send my answer again” to resubmit exactly what you said.',
        source: 'demo',
      });
      setStage('feedback');
      setScoringFailed(true);
    } finally {
      setIsScoring(false);
    }
  }, [lang, question.id, role.id, transcript]);

  const retryQuestion = useCallback(() => {
    setAttemptCount((c) => c + 1);
    setFeedback(null);
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
              {!cameraOn && (
                <div className="video-placeholder">
                  {cameraError ? t('cameraDenied') : t('enableCamera')}
                </div>
              )}
            </div>

            <ul className="checklist">
              <li>
                <span className={`check-icon ${cameraOn ? '' : cameraError ? 'fail' : 'pending'}`}>
                  {cameraOn ? '✓' : cameraError ? '!' : '·'}
                </span>
                <span>
                  {t('checkCamera')} &amp; {t('checkMic')}
                </span>
              </li>
              <li>
                <span className={`check-icon ${speechOk ? '' : 'fail'}`}>{speechOk ? '✓' : '!'}</span>
                <span>
                  {t('checkTranscript')}
                  <br />
                  <span className="tiny">
                    {speechOk ? t('transcriptReady') : t('transcriptUnsupported')}
                  </span>
                </span>
              </li>
            </ul>

            {!cameraOn && (
              <button type="button" className="btn btn-quiet" onClick={enableCamera}>
                {t('enableCamera')}
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
            <button type="button" className="btn btn-primary" onClick={startPrep}>
              {t('imReady')}
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
              {!cameraOn && <div className="video-placeholder">{t('cameraDenied')}</div>}
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
              {speechOk ? (
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
              onChange={(e) => setTranscript(e.target.value)}
            />
            <p className="tiny">{t('typeHint')}</p>
            <div className="row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitForScoring}
                disabled={isScoring || transcript.trim().length === 0}
              >
                {isScoring ? t('scoring') : t('getFeedback')}
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
            {scoringFailed ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitForScoring}
                disabled={isScoring}
              >
                {isScoring ? t('scoring') : t('resubmit')}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={advance}>
                {isLast ? t('finishInterview') : t('nextQuestion')}
              </button>
            )}
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
