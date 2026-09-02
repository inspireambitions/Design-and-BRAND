import type { ExperienceLevel, QuestionType, TurnAction } from './types.ts';

export const REQUIRED_EVAL_ROLES = ['Front Desk Agent', 'Software Engineer', 'Sales Manager', 'Graduate Trainee'] as const;
export const REQUIRED_EVAL_LEVELS: ExperienceLevel[] = ['ENTRY', 'PROFESSIONAL', 'MANAGER'];
export const REQUIRED_CANDIDATE_TYPES = [
  'strong', 'weak', 'vague', 'one-example', 'hypothetical-only', 'inconsistent-scope', 'non-native-phrasing',
] as const;

export type GoldRating = {
  rater_id: string;
  sufficiency: string;
};

export type GoldTurn = {
  id: string;
  pair_group?: string;
  role: typeof REQUIRED_EVAL_ROLES[number];
  level: ExperienceLevel;
  candidate_type: typeof REQUIRED_CANDIDATE_TYPES[number];
  question: string;
  question_type: QuestionType;
  intent: string;
  candidate_answer: string;
  expected_criteria_statuses: Record<string, string>;
  expected_competencies: string[];
  expected_sufficiency: string;
  expected_action: TurnAction;
  acceptable_followups: string[];
  forbidden_followups: string[];
  expected_feedback_points: string[];
  ratings: GoldRating[];
};

export type ObservedTurn = {
  id: string;
  action: TurnAction;
  competencies: string[];
  sufficiency: string;
  band: string;
  followup: string | null;
  feedback_points: string[];
  invented_candidate_facts: string[];
  major_evidence_missed: boolean;
  unnecessary_probe: boolean;
  schema_failed_after_retry: boolean;
};

export type GoldGate = {
  ok: boolean;
  errors: string[];
  agreement: number;
};

export function validateGoldSet(cases: GoldTurn[], minimum = 300): GoldGate {
  const errors: string[] = [];
  if (cases.length < minimum) errors.push(`Gold set has ${cases.length} turns; ${minimum} are required.`);
  const ids = cases.map((item) => item.id);
  if (new Set(ids).size !== ids.length) errors.push('Gold set contains duplicate case ids.');
  const underRated = cases.filter((item) => new Set(item.ratings.map((rating) => rating.rater_id)).size < 2);
  if (underRated.length) errors.push(`${underRated.length} turns do not have two different human raters.`);
  const rated = cases.filter((item) => item.ratings.length >= 2);
  const agreed = rated.filter((item) => item.ratings[0].sufficiency === item.ratings[1].sufficiency).length;
  const agreement = rated.length ? agreed / rated.length : 0;
  if (agreement < 0.8) errors.push(`Sufficiency agreement is ${(agreement * 100).toFixed(1)}%; at least 80% is required.`);

  for (const role of REQUIRED_EVAL_ROLES) {
    if (!cases.some((item) => item.role === role)) errors.push(`Missing required role: ${role}.`);
  }
  for (const level of REQUIRED_EVAL_LEVELS) {
    if (!cases.some((item) => item.level === level)) errors.push(`Missing required level: ${level}.`);
  }
  for (const candidateType of REQUIRED_CANDIDATE_TYPES) {
    if (!cases.some((item) => item.candidate_type === candidateType)) errors.push(`Missing candidate type: ${candidateType}.`);
  }
  return { ok: errors.length === 0, errors, agreement };
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function includesForbidden(followup: string | null, forbidden: string[]): boolean {
  if (!followup) return false;
  const value = normalise(followup);
  return forbidden.some((item) => value === normalise(item) || value.includes(normalise(item)));
}

export function evaluateObservedTurns(gold: GoldTurn[], observed: ObservedTurn[]) {
  const byId = new Map(observed.map((item) => [item.id, item]));
  const comparable = gold.map((item) => ({ gold: item, observed: byId.get(item.id) })).filter((item) => item.observed);
  const count = comparable.length;
  const ratio = (matches: number) => count ? matches / count : 0;
  const correctAction = comparable.filter(({ gold: expected, observed: actual }) => actual!.action === expected.expected_action).length;
  const correctCompetencies = comparable.filter(({ gold: expected, observed: actual }) => {
    const wanted = [...expected.expected_competencies].sort();
    const got = [...actual!.competencies].sort();
    return JSON.stringify(wanted) === JSON.stringify(got);
  }).length;
  const repeated = comparable.filter(({ gold: expected, observed: actual }) => includesForbidden(actual!.followup, expected.forbidden_followups)).length;
  const invented = comparable.filter(({ observed: actual }) => actual!.invented_candidate_facts.length > 0).length;
  const missed = comparable.filter(({ observed: actual }) => actual!.major_evidence_missed).length;
  const unnecessary = comparable.filter(({ observed: actual }) => actual!.unnecessary_probe).length;
  const schemaFailures = comparable.filter(({ observed: actual }) => actual!.schema_failed_after_retry).length;

  const pairedVariance = new Map<string, Set<string>>();
  for (const { gold: expected, observed: actual } of comparable) {
    if (!expected.pair_group) continue;
    const bands = pairedVariance.get(expected.pair_group) ?? new Set<string>();
    bands.add(actual!.band);
    pairedVariance.set(expected.pair_group, bands);
  }
  const differingPairs = [...pairedVariance.values()].filter((bands) => bands.size > 1).length;

  const metrics = {
    invented_candidate_facts: ratio(invented),
    semantic_repeated_question: ratio(repeated),
    correct_next_action: ratio(correctAction),
    correct_competency_mapping: ratio(correctCompetencies),
    major_evidence_missed: ratio(missed),
    unnecessary_probe: ratio(unnecessary),
    paired_answer_band_variance: differingPairs,
    schema_failures_after_retry: ratio(schemaFailures),
  };
  const pass = count === gold.length
    && metrics.invented_candidate_facts === 0
    && metrics.semantic_repeated_question < 0.02
    && metrics.correct_next_action >= 0.95
    && metrics.correct_competency_mapping >= 0.95
    && metrics.major_evidence_missed < 0.03
    && metrics.unnecessary_probe < 0.05
    && metrics.paired_answer_band_variance === 0
    && metrics.schema_failures_after_retry < 0.005;
  return { pass, evaluated: count, expected: gold.length, metrics };
}
