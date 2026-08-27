import type { AnswerFeedback } from './scoring';
import type { Lang } from './i18n';

export type StarElement = 'situation' | 'task' | 'action' | 'result';

const PROBE_ORDER: StarElement[] = ['situation', 'task', 'action', 'result'];

const PROBE_PATTERNS: Record<StarElement, RegExp[]> = {
  situation: [
    /\bsituation\b/i,
    /\bcontext\b/i,
    /\bbackground\b/i,
    /\bchallenge\b/i,
    /\bdifficult/i,
    /\bwhen\b/i,
    /\bwhere\b/i,
    /four (clear )?parts/i,
    /\bstar\b/i,
    /الموقف/,
    /السياق/,
    /التحدي/,
  ],
  task: [
    /\btask\b/i,
    /\bresponsib/i,
    /\brole\b/i,
    /\byour part\b/i,
    /\bwhat was expected\b/i,
    /المسؤول/i,
    /دورك/,
  ],
  action: [
    /\baction/i,
    /\bwhat you did\b/i,
    /\bwhat did you do\b/i,
    /\bsteps\b/i,
    /\bpersonally\b/i,
    /\bhow you handled\b/i,
    /ما فعلت/i,
    /خطوات/i,
    /إجراء/i,
  ],
  result: [
    /\bresult\b/i,
    /\boutcome\b/i,
    /\bend\b/i,
    /\bwhat happened\b/i,
    /\bimpact\b/i,
    /\bmeasurable\b/i,
    /النتيجة/,
    /النهاية/,
    /الأثر/,
  ],
};

const PROBE_QUESTIONS: Record<Lang, Record<StarElement, string>> = {
  en: {
    situation: 'Tell me more about the situation. What was happening, and why was it difficult?',
    task: 'What was your specific responsibility in that situation?',
    action: 'What did you personally do? Walk me through your actions, step by step.',
    result: 'What happened at the end? What was the outcome?',
  },
  ar: {
    situation: 'حدثني أكثر عن الموقف. ماذا كان يحدث، ولماذا كان صعباً؟',
    task: 'ما كانت مسؤوليتك تحديداً في ذلك الموقف؟',
    action: 'ماذا فعلت أنت شخصياً؟ اشرح خطواتك واحدة تلو الأخرى.',
    result: 'ماذا حدث في النهاية؟ ما كانت النتيجة؟',
  },
};

/** Score below which a STAR follow-up may help structure the answer. */
export const STAR_PROBE_SCORE_THRESHOLD = 55;

export function nextStarProbe(feedback: AnswerFeedback): StarElement | null {
  if (feedback.status !== 'scored') return null;
  if (feedback.score >= STAR_PROBE_SCORE_THRESHOLD) return null;

  const haystack = [
    feedback.headline,
    ...feedback.strengths,
    ...feedback.improvements,
    feedback.coachTip,
  ].join(' ');

  for (const element of PROBE_ORDER) {
    if (PROBE_PATTERNS[element].some((pattern) => pattern.test(haystack))) {
      return element;
    }
  }

  // Default: most candidates like Dil miss the action step first.
  return 'action';
}

export function probeQuestion(element: StarElement, lang: Lang): string {
  return PROBE_QUESTIONS[lang][element];
}

export function combineProbeTranscript(
  baseTranscript: string,
  probeQuestion: string,
  probeAnswer: string,
  label: string,
): string {
  const base = baseTranscript.trim();
  const followUp = probeAnswer.trim();
  if (!base) return followUp;
  if (!followUp) return base;
  return `${base}\n\n[${label}: ${probeQuestion}]\n${followUp}`;
}
