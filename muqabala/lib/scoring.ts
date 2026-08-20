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
  score: number; // 0-100
  headline: string;
  competencies: CompetencyScore[];
  strengths: string[];
  improvements: string[];
  /** The single highest-leverage rewrite suggestion. */
  coachTip: string;
  source: 'ai' | 'demo';
};

export type Attempt = {
  id: string;
  roleId: string;
  roleTitle: string;
  startedAt: string;
  overallScore: number;
  answers: { questionId: string; questionText: string; transcript: string; feedback: AnswerFeedback }[];
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
  const sentences = text
    .split(/(?<=[.!?؟।])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
  if (sentences.length === 0) return null;
  const scored = sentences
    .map((s) => ({ s, hits: countMatches(s, re) }))
    .sort((a, b) => b.hits - a.hits);
  if (scored[0].hits === 0) return null;
  const pick = scored[0].s;
  return pick.length > 180 ? `${pick.slice(0, 177)}…` : pick;
}

/** True when the text is predominantly Arabic script. */
export function isArabicText(text: string): boolean {
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return arabic > 0 && arabic >= latin;
}

/**
 * Honest refusal for Arabic answers on the heuristic path.
 * Every pattern in this scorer is English-literal, so an Arabic answer would score
 * near the floor no matter how good it is. Declining to score beats scoring unfairly.
 */
export function arabicUnavailable(questionId: string): AnswerFeedback {
  return {
    questionId,
    score: 0,
    headline: 'التقييم التلقائي بالعربية غير متاح بعد',
    competencies: [],
    strengths: [],
    improvements: [
      'إجابتك وصلت بالكامل، لكن المقيّم السريع يعمل بالإنجليزية فقط حالياً، ولا نريد أن نعطيك درجة غير عادلة.',
      'يمكنك التدرب بالإنجليزية الآن، أو العودة قريباً عندما يصبح التقييم بالعربية جاهزاً.',
    ],
    coachTip:
      'درجة خاطئة أسوأ من عدم وجود درجة. نفضّل أن نخبرك بصراحة بدلاً من تقييم إجابتك بشكل غير عادل.',
    source: 'demo',
  };
}

/**
 * Deterministic scorer used when no ANTHROPIC_API_KEY is configured.
 * Judges answer *content* only — never appearance, accent, or delivery speed.
 * English only: callers must route Arabic answers to the AI path or to
 * `arabicUnavailable` (see the Arabic gate in app/api/score/route.ts).
 */
export function demoScore(question: Question, role: Role, transcript: string): AnswerFeedback {
  const text = transcript.trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Too short to judge fairly — say so instead of inventing a low score.
  if (wordCount < 12) {
    return {
      questionId: question.id,
      score: 0,
      headline: 'Too short to score',
      competencies: [],
      strengths: [],
      improvements: [
        'We could not hear enough of an answer to give you useful feedback.',
        'Aim for at least 45 seconds — a situation, what you did, and how it ended.',
      ],
      coachTip:
        'Try again and tell one complete story. Even a short real example beats a general statement.',
      source: 'demo',
    };
  }

  const fillerRate = countMatches(text, FILLERS) / Math.max(wordCount, 1);
  const hedgeRate = countMatches(text, HEDGES) / Math.max(wordCount, 1);
  const firstPerson = countMatches(text, FIRST_PERSON);
  const teamOnly = countMatches(text, TEAM_ONLY);
  const numbers = countMatches(text, NUMBERS);
  const outcomes = countMatches(text, OUTCOME);
  const situations = countMatches(text, SITUATION);
  const actions = countMatches(text, ACTION);

  // Length: rewards a real answer, penalises rambling past ~320 words.
  const lengthScore =
    wordCount < 45 ? 3 + (wordCount / 45) * 3 : wordCount <= 320 ? 9 : clamp(9 - (wordCount - 320) / 60, 5, 9);

  const communication = clamp(
    lengthScore * 0.55 + 4.5 - fillerRate * 90 - hedgeRate * 40 + (situations > 0 ? 1 : 0),
    2,
    10,
  );
  const ownership = clamp(
    3 + (firstPerson / Math.max(firstPerson + teamOnly, 1)) * 6 + (actions > 0 ? 1.5 : 0),
    2,
    10,
  );
  const problemSolving = clamp(3.5 + actions * 0.9 + (outcomes > 0 ? 2 : 0), 2, 10);
  const evidence = clamp(3 + numbers * 0.8 + (situations > 0 ? 1.5 : 0) + (wordCount > 90 ? 1 : 0), 2, 10);
  const contextual = clamp(
    3.5 + (situations > 0 ? 2 : 0) + (outcomes > 0 ? 1.5 : 0) + (numbers > 0 ? 1 : 0),
    2,
    10,
  );

  const byId: Record<string, number> = {
    communication,
    ownership,
    problem_solving: problemSolving,
    evidence,
    customer_focus: contextual,
    compliance: contextual,
  };

  const competencies: CompetencyScore[] = question.competencies.map((cid) => {
    const def = role.competencies.find((c) => c.id === cid);
    const score = Math.round(byId[cid] ?? contextual);
    let evidenceRe = SITUATION;
    if (cid === 'ownership') evidenceRe = ACTION;
    else if (cid === 'problem_solving') evidenceRe = ACTION;
    else if (cid === 'evidence') evidenceRe = NUMBERS;
    else if (cid === 'communication') evidenceRe = OUTCOME;
    const quote = bestSentence(text, evidenceRe);
    return {
      id: cid,
      label: def?.label ?? cid,
      score,
      evidence: quote ? `“${quote}”` : null,
    };
  });

  const overall = Math.round(
    (competencies.reduce((sum, c) => sum + c.score, 0) / Math.max(competencies.length, 1)) * 10,
  );

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (situations > 0) strengths.push('You grounded your answer in a real situation rather than speaking in general terms.');
  if (actions >= 2) strengths.push('You described a clear sequence of actions you personally took.');
  if (numbers >= 2) strengths.push('You backed your answer with specific numbers and details.');
  if (outcomes > 0) strengths.push('You closed the loop by saying how it ended.');
  if (fillerRate < 0.015 && wordCount > 60) strengths.push('Your delivery was clear with very few filler words.');
  if (strengths.length === 0) strengths.push('You answered the question directly and stayed on topic.');

  if (situations === 0)
    improvements.push('Open with a specific moment — “Last year at the hotel, a guest…” — instead of describing what you usually do.');
  if (teamOnly > firstPerson)
    improvements.push('You said “we” more than “I”. Interviewers need to know what *you* decided and did.');
  if (numbers === 0)
    improvements.push('Add concrete detail: how many, how long, which system, what the result was.');
  if (outcomes === 0)
    improvements.push('Finish the story. Say what the outcome was and what changed because of you.');
  if (fillerRate > 0.03)
    improvements.push('Slow down slightly — filler words crept in. A short pause reads as confidence, not hesitation.');
  if (wordCount > 320)
    improvements.push('Tighten it. Strong answers land in 60–120 seconds; long answers lose the interviewer.');
  if (wordCount < 45)
    improvements.push('Give more. This answer was short — add the situation and the outcome.');
  if (improvements.length === 0)
    improvements.push('This was a solid answer. Try it once more and make the outcome even more specific.');

  const coachTip =
    teamOnly > firstPerson
      ? 'Rewrite your story replacing every “we” with what you personally did. That single change usually moves an answer up a grade.'
      : numbers === 0
        ? 'Pick one number to add — how many guests, how many minutes, how much the sale was worth. Specifics make you memorable.'
        : outcomes === 0
          ? 'Add one closing sentence: “In the end…”. Interviewers remember how stories finish.'
          : 'Strong structure. Now shorten your opening so you reach the action faster.';

  const headline =
    overall >= 80
      ? 'Strong answer'
      : overall >= 65
        ? 'Good, with room to sharpen'
        : overall >= 50
          ? 'A workable answer that needs more detail'
          : 'Needs a real example';

  return {
    questionId: question.id,
    score: overall,
    headline,
    competencies,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    coachTip,
    source: 'demo',
  };
}

export function overallFromAnswers(answers: { feedback: AnswerFeedback }[]): number {
  const scored = answers.filter((a) => a.feedback.score > 0);
  if (scored.length === 0) return 0;
  return Math.round(scored.reduce((s, a) => s + a.feedback.score, 0) / scored.length);
}
