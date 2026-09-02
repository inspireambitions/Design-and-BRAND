import type { Question, Role } from './roles';
import type { AnswerFeedback, Attempt } from './scoring';

/**
 * Same rule as lib/question-rubric.ts: a malformed question (no competencies,
 * or a duplicate or unknown id) contributes no rubric items at all rather than
 * a partial set. Kept type-only on imports so the module runs under
 * `node --experimental-strip-types` in the unit tests.
 */
function rubricIdsFor(role: Role, question: Question): string[] {
  const ids = question.competencies;
  if (ids.length === 0 || new Set(ids).size !== ids.length) return [];
  const known = new Set(role.competencies.map((competency) => competency.id));
  return ids.every((id) => known.has(id)) ? [...ids] : [];
}

/**
 * A competency counts as demonstrated only when the scorer quoted evidence for
 * it and rated it at least this far up the 0-10 scale. Evidence without a
 * decent score is a mention, not a demonstration; a score without evidence is
 * an assertion the candidate cannot check.
 */
export const READINESS_COVERED_MIN_SCORE = 6;

export type ReadinessCoverage = {
  competencyId: string;
  label: string;
  labelAr: string;
  /** True when at least one best answer for this role demonstrated the competency. */
  covered: boolean;
};

export type Readiness = {
  /** 0-100. The share of rubric items across the role's question set that are covered. */
  score: number;
  /** Questions in the set with at least one scored answer. */
  questionsPractised: number;
  questionsTotal: number;
  /** One entry per role competency, in the role's own order. */
  coverage: ReadinessCoverage[];
};

type ScoredAnswer = {
  feedback: AnswerFeedback;
  startedAt: number;
  /**
   * Position in the attempts list (newest first, as storage returns them), so
   * equal timestamps still order deterministically.
   */
  order: number;
};

/**
 * Readiness is scored against the role's question set: the curated core
 * questions, plus any bank question the candidate has actually answered.
 * Unanswered bank questions do not count against them because the bank is
 * there to keep repeat practice fresh, not to define what "ready" means.
 */
function questionSet(role: Role, attempts: Attempt[]): Question[] {
  const answered = new Set<string>();
  for (const attempt of attempts) for (const answer of attempt.answers) answered.add(answer.questionId);
  const core = role.questions;
  const coreIds = new Set(core.map((question) => question.id));
  const extras = (role.bank ?? []).filter((question) => !coreIds.has(question.id) && answered.has(question.id));
  return [...core, ...extras];
}

function isCovered(feedback: AnswerFeedback, competencyId: string): boolean {
  return feedback.competencies.some(
    (competency) =>
      competency.id === competencyId &&
      typeof competency.evidence === 'string' &&
      competency.evidence.trim().length > 0 &&
      competency.score >= READINESS_COVERED_MIN_SCORE,
  );
}

function coveredCount(feedback: AnswerFeedback, rubricIds: string[]): number {
  return rubricIds.filter((id) => isCovered(feedback, id)).length;
}

/**
 * The best scored answer for one question. Highest feedback score wins; a tie
 * goes to the answer that demonstrates more of the rubric, then to the most
 * recent attempt, then to list order. Unscored feedback never takes part.
 */
function bestAnswer(candidates: ScoredAnswer[], rubricIds: string[]): ScoredAnswer | null {
  let best: ScoredAnswer | null = null;
  let bestCovered = -1;
  for (const candidate of candidates) {
    if (candidate.feedback.status !== 'scored') continue;
    const covered = coveredCount(candidate.feedback, rubricIds);
    if (best === null) {
      best = candidate;
      bestCovered = covered;
      continue;
    }
    const byScore = candidate.feedback.score - best.feedback.score;
    if (byScore > 0) {
      best = candidate;
      bestCovered = covered;
      continue;
    }
    if (byScore < 0) continue;
    if (covered > bestCovered) {
      best = candidate;
      bestCovered = covered;
      continue;
    }
    if (covered < bestCovered) continue;
    if (candidate.startedAt > best.startedAt || (candidate.startedAt === best.startedAt && candidate.order < best.order)) {
      best = candidate;
      bestCovered = covered;
    }
  }
  return best;
}

/**
 * One readiness number per role, 0-100, from rubric coverage across the
 * role's question set weighted to the best attempt per question. Pure and
 * deterministic: the same attempts always produce the same result.
 */
export function computeReadiness(attempts: Attempt[], role: Role): Readiness {
  const forRole = attempts.filter((attempt) => attempt.roleId === role.id);
  const questions = questionSet(role, forRole);

  const answersByQuestion = new Map<string, ScoredAnswer[]>();
  forRole.forEach((attempt, order) => {
    const startedAt = Date.parse(attempt.startedAt);
    for (const answer of attempt.answers) {
      if (answer.feedback.status !== 'scored') continue;
      const list = answersByQuestion.get(answer.questionId) ?? [];
      list.push({ feedback: answer.feedback, startedAt: Number.isNaN(startedAt) ? 0 : startedAt, order });
      answersByQuestion.set(answer.questionId, list);
    }
  });

  let totalItems = 0;
  let coveredItems = 0;
  let questionsPractised = 0;
  const coveredCompetencies = new Set<string>();

  for (const question of questions) {
    const rubricIds = rubricIdsFor(role, question);
    totalItems += rubricIds.length;
    const candidates = answersByQuestion.get(question.id) ?? [];
    if (candidates.length === 0) continue;
    questionsPractised += 1;
    const best = bestAnswer(candidates, rubricIds);
    if (!best) continue;
    for (const id of rubricIds) {
      if (isCovered(best.feedback, id)) {
        coveredItems += 1;
        coveredCompetencies.add(id);
      }
    }
  }

  return {
    score: totalItems === 0 ? 0 : Math.round((coveredItems / totalItems) * 100),
    questionsPractised,
    questionsTotal: questions.length,
    coverage: role.competencies.map((competency) => ({
      competencyId: competency.id,
      label: competency.label,
      labelAr: competency.labelAr,
      covered: coveredCompetencies.has(competency.id),
    })),
  };
}
