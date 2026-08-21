import type { Question, Role } from './roles';

export type CompetencyScore = {
  id: string;
  label: string;
  score: number; // 0-10
  /** Null when no line in the answer actually demonstrates this competency. */
  evidence: string | null;
};

export type AnswerFeedback = {
  questionId: string;
  /**
   * 0-100, meaningful only when status is 'scored'. When the system declines
   * to judge an answer, callers must render no score at all — a zero ring
   * tells a candidate they failed when nothing was actually assessed.
   */
  score: number;
  status: 'scored' | 'unscored';
  headline: string;
  competencies: CompetencyScore[];
  strengths: string[];
  improvements: string[];
  /** The single highest-leverage rewrite suggestion. */
  coachTip: string;
  /**
   * 'ai' judges the role's competency rubric. 'structure' is the offline
   * checker, which measures how an answer is built — not role competence.
   * The two must never be presented to a candidate as the same thing.
   */
  source: 'ai' | 'structure';
};

/** How the candidate felt afterwards. The product's whole promise is measured here. */
export type AttemptRating = {
  /** 1-5. How useful the practice was. */
  stars: number;
  /** Whether they feel more or less ready than before they started. */
  confidence: 'more' | 'same' | 'less';
};

export type Attempt = {
  id: string;
  roleId: string;
  roleTitle: string;
  startedAt: string;
  /** Null when no answer in the interview was scored. */
  overallScore: number | null;
  answers: { questionId: string; questionText: string; transcript: string; feedback: AnswerFeedback }[];
  rating?: AttemptRating;
};

const FILLERS = /\b(um+|uh+|erm+|like|you know|basically|actually|kind of|sort of)\b/gi;
const HEDGES = /\b(maybe|i think|probably|i guess|somehow|try to|hopefully)\b/gi;
const FIRST_PERSON = /\b(i|my|me|myself)\b/gi;
const TEAM_ONLY = /\b(we|our|us|the team)\b/gi;
const NUMBERS = /\b(\d+|one|two|three|four|five|ten|twenty|fifty|hundred)\b/gi;
const OUTCOME = /\b(result|resulted|outcome|finally|in the end|afterwards|since then|solved|resolved|fixed|completed|satisfied|thanked|returned|improved)\b/gi;
const SITUATION = /\b(when|once|during|at the time|there was|one day|a guest|a customer|a patient|a client|my manager|last year|last month)\b/gi;
const ACTION = /\b(i (did|called|checked|explained|apologised|apologized|offered|arranged|escalated|contacted|handled|organised|organized|fixed|trained|created|managed|decided|followed|reported|updated))\b/gi;

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Pull the sentence that actually demonstrates a competency.
 * Returns null when nothing in the answer does — quoting an unrelated sentence as
 * "evidence" for four different competencies looks like proof and is not.
 */
function bestSentence(text: string, re: RegExp): string | null {
  let sentences = text
    .split(/(?<=[.!?؟।])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  // A dictated answer may arrive as one long stream with no punctuation to
  // split on. Fall back to word-run chunks so evidence can still be quoted
  // back to the candidate rather than silently disappearing.
  if (sentences.length <= 1) {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > 24) {
      const chunks: string[] = [];
      for (let i = 0; i < words.length; i += 18) chunks.push(words.slice(i, i + 18).join(' '));
      sentences = chunks.filter((c) => c.length > 15);
    }
  }
  if (sentences.length === 0) return null;
  const scored = sentences
    .map((s) => ({ s, hits: countMatches(s, re) }))
    .sort((a, b) => b.hits - a.hits);
  if (scored[0].hits === 0) return null;
  const pick = scored[0].s;
  return pick.length > 180 ? `${pick.slice(0, 177)}…` : pick;
}

/** Distinct matches, so repeating one trigger word cannot inflate a dimension. */
function uniqueMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  if (!m) return 0;
  return new Set(m.map((x) => x.toLowerCase().trim())).size;
}

/**
 * Whether a signal appears within a slice of the answer. Real stories put the
 * situation near the start and the outcome near the end; keyword soup sprays
 * markers evenly, so position is one of the few honest signals available offline.
 */
function hasSignalInRange(text: string, re: RegExp, startFrac: number, endFrac: number): boolean {
  const slice = text.slice(
    Math.floor(text.length * startFrac),
    Math.ceil(text.length * endFrac),
  );
  return countMatches(slice, re) > 0;
}

/**
 * Whether the transcript arrived with punctuation to reason about. Live
 * dictation often returns none, and its absence says nothing about how well
 * the candidate spoke — only about what the recogniser emitted.
 */
function hasUsablePunctuation(text: string, wordCount: number): boolean {
  return countMatches(text, /[.!?؟]/g) >= Math.floor(wordCount / 40);
}

/** Sentences with enough words to carry meaning. */
function wellFormedSentences(text: string): number {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((s) => s.trim().split(/\s+/).filter(Boolean).length >= 6).length;
}

/**
 * Detects answers that are lists of trigger words rather than stories.
 * A checker that ranks keyword soup above a real answer destroys the
 * candidate's trust the first time they notice, so refuse to score it.
 */
function looksLikeKeywordSoup(text: string, wordCount: number): boolean {
  if (wordCount < 25) return false;
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  const uniqueRatio = new Set(words).size / Math.max(words.length, 1);
  const triggers =
    countMatches(text, SITUATION) +
    countMatches(text, ACTION) +
    countMatches(text, OUTCOME) +
    countMatches(text, NUMBERS);
  const triggerDensity = triggers / Math.max(wordCount, 1);
  const sentences = wellFormedSentences(text);
  // Live dictation routinely returns one unpunctuated stream, so an answer with
  // no full stops is a transcription artifact, not a sign of keyword stuffing.
  // Judging structure by punctuation there would refuse to score exactly the
  // candidates who spoke their answer instead of typing it.
  const structureLooksWrong =
    hasUsablePunctuation(text, wordCount) && wordCount > 60 && sentences < 2;

  // Densely packed markers, heavy repetition, or — only where punctuation
  // exists to judge by — an answer that never forms real sentences.
  return triggerDensity > 0.28 || uniqueRatio < 0.4 || structureLooksWrong;
}

/** True when the text is predominantly Arabic script. */
export function isArabicText(text: string): boolean {
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return arabic > 0 && arabic >= latin;
}

/**
 * Honest refusal for Arabic answers on the structure checker.
 * Every pattern in this checker is English-literal, so an Arabic answer would
 * land near the floor no matter how good it is. Declining beats judging unfairly.
 */
export function arabicUnavailable(questionId: string): AnswerFeedback {
  return {
    questionId,
    score: 0,
    status: 'unscored',
    headline: 'التقييم التلقائي بالعربية غير متاح بعد',
    competencies: [],
    strengths: [],
    improvements: [
      'إجابتك وصلت بالكامل، لكن المقيّم السريع يعمل بالإنجليزية فقط حالياً، ولا نريد أن نعطيك درجة غير عادلة.',
      'يمكنك التدرب بالإنجليزية الآن، أو العودة قريباً عندما يصبح التقييم بالعربية جاهزاً.',
    ],
    coachTip:
      'درجة خاطئة أسوأ من عدم وجود درجة. نفضّل أن نخبرك بصراحة بدلاً من تقييم إجابتك بشكل غير عادل.',
    source: 'structure',
  };
}

/**
 * Offline structure checker, used when no ANTHROPIC_API_KEY is configured.
 *
 * IMPORTANT: this does NOT measure role competence. It measures how an answer
 * is built — whether it names a real situation, says what the candidate
 * personally did, gives concrete detail, and finishes the story. Those are the
 * things simple text patterns can honestly detect. Presenting its output as a
 * competency score would be a false claim, so it reports structure dimensions
 * under its own labels and the UI states what it is.
 *
 * English only: callers must route Arabic answers to `arabicUnavailable`.
 */
export function structureCheck(question: Question, transcript: string): AnswerFeedback {
  const text = transcript.trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Too short to judge fairly — decline rather than invent a low score.
  if (wordCount < 12) {
    return {
      questionId: question.id,
      score: 0,
      status: 'unscored',
      headline: 'Too short to check',
      competencies: [],
      strengths: [],
      improvements: [
        'We could not hear enough of an answer to give you useful feedback.',
        'Aim for at least 45 seconds — a situation, what you did, and how it ended.',
      ],
      coachTip:
        'Try again and tell one complete story. Even a short real example beats a general statement.',
      source: 'structure',
    };
  }

  if (looksLikeKeywordSoup(text, wordCount)) {
    return {
      questionId: question.id,
      score: 0,
      status: 'unscored',
      headline: 'We could not read this as an answer',
      competencies: [],
      strengths: [],
      improvements: [
        'This did not come through as a spoken answer — it reads as disconnected words rather than a story.',
        'If you were speaking normally, the transcription may have failed. Try again, or type your answer instead.',
      ],
      coachTip:
        'Tell one real story in full sentences: where you were, what you did, and how it ended.',
      source: 'structure',
    };
  }

  const firstPerson = countMatches(text, FIRST_PERSON);
  const teamOnly = countMatches(text, TEAM_ONLY);
  // Distinct signals only — repeating a trigger word must not raise a score.
  const numbers = uniqueMatches(text, NUMBERS);
  const actions = uniqueMatches(text, ACTION);
  // Position matters: a story opens with the situation and closes with the outcome.
  const hasSituation = hasSignalInRange(text, SITUATION, 0, 0.6);
  const hasOutcome = hasSignalInRange(text, OUTCOME, 0.55, 1);
  const situations = hasSituation ? uniqueMatches(text, SITUATION) : 0;
  const outcomes = hasOutcome ? uniqueMatches(text, OUTCOME) : 0;
  const sentences = wellFormedSentences(text);

  // A dimension can only score well inside an answer that forms real sentences —
  // but only where punctuation exists to judge that by. A dictated answer with
  // no full stops must not be scaled down for something the recogniser, not the
  // candidate, failed to produce. The keyword-soup check above still guards
  // against genuinely unstructured input.
  const prose = hasUsablePunctuation(text, wordCount) ? clamp(sentences / 3, 0.4, 1) : 1;

  const situationScore = clamp((hasSituation ? 6 + Math.min(situations, 2) : 2) * prose, 2, 10);
  const ownActionsScore = clamp(
    (2 + (firstPerson / Math.max(firstPerson + teamOnly, 1)) * 6 + Math.min(actions, 2)) * prose,
    2,
    10,
  );
  const detailScore = clamp((2 + Math.min(numbers, 4) * 1.6 + (wordCount > 90 ? 1 : 0)) * prose, 2, 10);
  const outcomeScore = clamp((hasOutcome ? 6 + Math.min(outcomes, 2) : 2) * prose, 2, 10);
  const lengthScore =
    wordCount < 45
      ? clamp(3 + (wordCount / 45) * 4, 2, 10)
      : wordCount <= 320
        ? 9
        : clamp(9 - (wordCount - 320) / 60, 4, 9);

  const dimensions: { id: string; label: string; score: number; re: RegExp }[] = [
    { id: 'situation', label: 'Names a real situation', score: situationScore, re: SITUATION },
    { id: 'own_actions', label: 'Says what you personally did', score: ownActionsScore, re: ACTION },
    { id: 'detail', label: 'Gives concrete detail', score: detailScore, re: NUMBERS },
    { id: 'outcome', label: 'Finishes the story', score: outcomeScore, re: OUTCOME },
    { id: 'length', label: 'Answer length', score: lengthScore, re: SITUATION },
  ];

  const competencies: CompetencyScore[] = dimensions.map((d) => {
    const quote = d.id === 'length' ? null : bestSentence(text, d.re);
    return {
      id: d.id,
      label: d.label,
      score: Math.round(d.score),
      evidence: quote ? `\u201c${quote}\u201d` : null,
    };
  });

  const overall = Math.round(
    (competencies.reduce((sum, c) => sum + c.score, 0) / competencies.length) * 10,
  );

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (hasSituation)
    strengths.push('You grounded your answer in a real situation rather than speaking in general terms.');
  if (actions >= 2)
    strengths.push('You described a clear sequence of actions you personally took.');
  if (numbers >= 2) strengths.push('You backed your answer with specific numbers and details.');
  if (hasOutcome) strengths.push('You closed the loop by saying how it ended.');
  if (strengths.length === 0) strengths.push('You answered the question directly and stayed on topic.');

  if (!hasSituation)
    improvements.push(
      'Open with a specific moment — \u201cLast year at the hotel, a guest\u2026\u201d — instead of describing what you usually do.',
    );
  if (teamOnly > firstPerson)
    improvements.push(
      'You said \u201cwe\u201d more than \u201cI\u201d. Interviewers need to know what you decided and did.',
    );
  if (numbers === 0)
    improvements.push('Add concrete detail: how many, how long, which system, what the result was.');
  if (!hasOutcome)
    improvements.push('Finish the story. End with what the outcome was and what changed because of you.');
  if (wordCount > 320)
    improvements.push('Tighten it. Strong answers land in 60\u2013120 seconds; long answers lose the interviewer.');
  if (wordCount < 45)
    improvements.push('Give more. This answer was short — add the situation and the outcome.');
  if (improvements.length === 0)
    improvements.push('The structure is solid. Try it once more and make the outcome even more specific.');

  const coachTip =
    teamOnly > firstPerson
      ? 'Rewrite your story replacing every \u201cwe\u201d with what you personally did. That single change usually moves an answer up a grade.'
      : numbers === 0
        ? 'Pick one number to add — how many guests, how many minutes, how much the sale was worth. Specifics make you memorable.'
        : !hasOutcome
          ? 'Add one closing sentence: \u201cIn the end\u2026\u201d. Interviewers remember how stories finish.'
          : 'Strong structure. Now shorten your opening so you reach the action faster.';

  const headline =
    overall >= 80
      ? 'Well-structured answer'
      : overall >= 65
        ? 'Good structure, room to sharpen'
        : overall >= 50
          ? 'The shape is there, the detail is not'
          : 'Needs a real example';

  return {
    questionId: question.id,
    score: overall,
    status: 'scored',
    headline,
    competencies,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    coachTip,
    source: 'structure',
  };
}

/**
 * Null when no answer was scored at all. A zero would read as "you failed",
 * when in fact nothing was ever judged — a distinction the candidate is owed.
 */
export function overallFromAnswers(answers: { feedback: AnswerFeedback }[]): number | null {
  const scored = answers.filter((a) => a.feedback.status === 'scored');
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((s, a) => s + a.feedback.score, 0) / scored.length);
}
