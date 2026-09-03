import { confirmBlueprint, fallbackPlan } from './blueprint.ts';
import {
  fallbackGeneratedQuestion,
  FRAMEWORK_CRITERIA,
  fromPlannedQuestion,
  highestValueUncovered,
  isSufficient,
} from './questions.ts';
import type {
  CandidateProfile,
  CoverageStatus,
  CriterionStatus,
  DiscoveryResult,
  EvidenceStrength,
  ExtractionResult,
  GeneratedQuestion,
  InterviewState,
  JDQualityResult,
  PlannedQuestion,
  PrecheckResult,
  RolePack,
  TurnAction,
  TurnDecision,
} from './types.ts';
import { PROMPT_VERSION } from './types.ts';

const criterionRank: Record<CriterionStatus, number> = { MISSING: 0, WEAK: 1, PRESENT: 2, STRONG: 3 };
const coverageRank: Record<CoverageStatus, number> = {
  NO_EVIDENCE: 0,
  WEAK: 1,
  PARTIAL: 2,
  SUFFICIENT: 3,
  STRONG: 4,
};

const ENTRY_PLAN_INDEXES = [0, 1, 2, 3, 6, 7] as const;

function fitPlanToSeniority(plan: PlannedQuestion[], seniority: InterviewState['seniority']): PlannedQuestion[] {
  if (plan.length !== 8) throw new Error('The interview planning pool must contain eight questions.');
  const selected = seniority === 'ENTRY' ? ENTRY_PLAN_INDEXES.map((index) => plan[index]) : plan;
  return selected.map((question, index) => ({ ...question, slot: index + 1 }));
}

function present(status: CriterionStatus | undefined): boolean {
  return criterionRank[status ?? 'MISSING'] >= criterionRank.PRESENT;
}

function strong(status: CriterionStatus | undefined): boolean {
  return criterionRank[status ?? 'MISSING'] >= criterionRank.STRONG;
}

export function criteriaMeetSeniority(
  state: Pick<InterviewState, 'seniority' | 'current_question'>,
  extraction: ExtractionResult,
): boolean {
  const framework = state.current_question?.framework ?? 'STAR';
  const expected = FRAMEWORK_CRITERIA[framework];
  const statuses = expected.map((key) => extraction.evidence.criteria[key]);
  const allPresent = statuses.every(present);
  const strongCount = statuses.filter(strong).length;
  const ownershipClear = extraction.evidence.personal_ownership === 'CLEAR';

  switch (state.seniority) {
    case 'ENTRY': {
      if (expected.includes('action')) {
        return present(extraction.evidence.criteria.action) && statuses.filter(present).length >= 2;
      }
      return statuses.filter(present).length >= 2;
    }
    case 'PROFESSIONAL': {
      if (expected.includes('action') && expected.includes('result')) {
        return present(extraction.evidence.criteria.action)
          && present(extraction.evidence.criteria.result)
          && ownershipClear;
      }
      return statuses.filter(present).length >= Math.min(2, expected.length) && ownershipClear;
    }
    case 'MANAGER':
      return allPresent && ownershipClear;
    case 'SENIOR_MANAGER':
      return allPresent && strongCount >= 1 && ownershipClear;
    case 'EXECUTIVE':
      return allPresent && strongCount >= 2 && ownershipClear;
  }
}

function coverageFromEvidence(
  state: Pick<InterviewState, 'seniority' | 'current_question'>,
  extraction: ExtractionResult,
  strength: EvidenceStrength,
  hypothetical: boolean,
): CoverageStatus {
  const effective = hypothetical && strength === 'STRONG' ? 'MEDIUM' : strength;
  if (effective === 'WEAK') return 'WEAK';
  if (!criteriaMeetSeniority(state, extraction)) return 'PARTIAL';
  return effective === 'STRONG' ? 'STRONG' : 'SUFFICIENT';
}

function maximumCoverage(left: CoverageStatus, right: CoverageStatus): CoverageStatus {
  return coverageRank[right] > coverageRank[left] ? right : left;
}

export function createInterviewState(input: {
  interviewId: string;
  profile: CandidateProfile;
  jdQuality: JDQualityResult;
  discovery: DiscoveryResult;
  rolePack: RolePack;
}): InterviewState {
  const coverage: InterviewState['coverage'] = Object.fromEntries(
    input.discovery.competencies.map((competency) => [competency.id, { status: 'NO_EVIDENCE' as const, evidence_ids: [] }]),
  );
  return {
    interview_id: input.interviewId,
    prompt_version: PROMPT_VERSION,
    role: input.profile.target_role,
    seniority: input.profile.experience_level,
    profile: input.profile,
    jd_quality: input.jdQuality,
    discovery: input.discovery.competencies,
    blueprint: [],
    confirmed_by_candidate: false,
    plan: [],
    question_number: 1,
    current_question: null,
    probe_count_current: 0,
    coverage,
    evidence_ledger: [],
    transcripts: {},
    examples_used: [],
    dedupe_keys: [],
    clarified_inconsistencies: [],
    hypothetical_offered_for: [],
    executive_ownership_probe_used: false,
    pattern_flags: { repeated_example: 0, weak_ownership: 0, unsupported_claims: 0, no_result_given: 0 },
    decision_log: [],
    role_pack: input.rolePack,
    retry_used: false,
    final_feedback: null,
    phase: 'AWAITING_CONFIRMATION',
    status: 'ACTIVE',
  };
}

export function activateInterview(
  state: InterviewState,
  competencyIds: string[],
  generatedPlan?: PlannedQuestion[],
): InterviewState {
  if (state.phase !== 'AWAITING_CONFIRMATION') throw new Error('This interview has already been confirmed.');
  const next = structuredClone(state);
  next.blueprint = confirmBlueprint(next.discovery, competencyIds);
  next.confirmed_by_candidate = true;
  next.plan = fitPlanToSeniority(
    generatedPlan ?? fallbackPlan(next.blueprint, next.profile, next.role_pack),
    next.seniority,
  );
  next.current_question = fromPlannedQuestion(next.plan[0]);
  next.phase = 'ACTIVE';
  return next;
}

export function applyExtraction(
  state: InterviewState,
  extraction: ExtractionResult,
  answer: string,
): InterviewState {
  if (!state.current_question) throw new Error('No active question.');
  const next = structuredClone(state);
  const currentQuestion = next.current_question;
  if (!currentQuestion) throw new Error('No active question.');
  const normalisedExtraction = structuredClone(extraction);
  const confidentialityRefusal = /\b(?:cannot|can['’]?t|unable to)\s+share\b.{0,50}\b(?:figures?|numbers?|amounts?|data)\b|\bconfidential\b/i.test(answer);
  const givesDirection = /\b(?:increase|decrease|improv|reduc|grew|growth|fell|higher|lower|up|down)\w*\b/i.test(answer);
  const givesScale = /\b(?:per\s*cent|percent|double|triple|significant|material|roughly|about|range|small|large)\b|\d/i.test(answer);
  if (confidentialityRefusal && givesDirection && givesScale && currentQuestion.framework === 'STAR') {
    normalisedExtraction.evidence.criteria.result = 'PRESENT';
  }
  const evidenceId = `E${String(next.evidence_ledger.length + 1).padStart(2, '0')}`;
  const evidenceTypes = normalisedExtraction.evidence.competencies.map((item) => item.evidence_type);
  const entryType = evidenceTypes[0] ?? 'EMPLOYMENT';
  const entryCompetencies: Record<string, EvidenceStrength> = {};
  let primaryDedupeKey = '';

  for (const item of normalisedExtraction.evidence.competencies) {
    if (!next.coverage[item.id]) continue;
    const status = coverageFromEvidence(next, normalisedExtraction, item.strength, item.evidence_type === 'HYPOTHETICAL');
    next.coverage[item.id].status = maximumCoverage(next.coverage[item.id].status, status);
    if (!next.coverage[item.id].evidence_ids.includes(evidenceId)) next.coverage[item.id].evidence_ids.push(evidenceId);
    entryCompetencies[item.id] = item.evidence_type === 'HYPOTHETICAL' && item.strength === 'STRONG' ? 'MEDIUM' : item.strength;
    const key = `${item.id}|${currentQuestion.question_type}|${next.coverage[item.id].status}`;
    next.dedupe_keys.push(key);
    primaryDedupeKey ||= key;
  }

  next.evidence_ledger.push({
    id: evidenceId,
    question_number: next.question_number,
    summary: normalisedExtraction.evidence.summary || 'No usable evidence extracted.',
    example_key: normalisedExtraction.evidence.example_key,
    competencies: entryCompetencies,
    criteria: normalisedExtraction.evidence.criteria,
    evidence_type: entryType,
    unsupported_claims: normalisedExtraction.evidence.unsupported_claims,
    dedupe_key: primaryDedupeKey,
  });
  next.transcripts[evidenceId] = answer;

  const referencedExampleKey = normalisedExtraction.evidence.same_example_as
    ? next.evidence_ledger.find((entry) => entry.id === normalisedExtraction.evidence.same_example_as)?.example_key
    : '';
  const exampleKey = referencedExampleKey || normalisedExtraction.evidence.example_key || normalisedExtraction.evidence.same_example_as || '';
  if (exampleKey) {
    next.examples_used.push(exampleKey);
    const uses = next.examples_used.filter((key) => key === exampleKey).length;
    if (uses >= 3) next.pattern_flags.repeated_example += 1;
  }
  if (normalisedExtraction.evidence.personal_ownership !== 'CLEAR') next.pattern_flags.weak_ownership += 1;
  next.pattern_flags.unsupported_claims += normalisedExtraction.evidence.unsupported_claims.length;
  if (currentQuestion.framework === 'STAR' && !present(normalisedExtraction.evidence.criteria.result)) {
    next.pattern_flags.no_result_given += 1;
  }
  return next;
}

export function decideTurn(
  state: InterviewState,
  precheck: PrecheckResult,
  extraction: ExtractionResult | null,
): TurnDecision {
  if (precheck.kind === 'NO_EXAMPLE') {
    const offered = state.hypothetical_offered_for.includes(state.question_number);
    return { action: offered ? 'MOVE_ON' : 'OFFER_HYPOTHETICAL', probe_target: '', counts_as_probe: false, override_reason: 'precheck_no_example' };
  }
  if (precheck.kind === 'REPHRASE_REQUEST') {
    return { action: 'REPHRASE', probe_target: '', counts_as_probe: false, override_reason: 'precheck_rephrase' };
  }
  if (precheck.kind === 'SKIP_REQUEST') {
    return { action: 'MOVE_ON', probe_target: '', counts_as_probe: false, override_reason: 'precheck_skip' };
  }
  if (!extraction) return { action: 'MOVE_ON', probe_target: '', counts_as_probe: false, override_reason: 'missing_extraction' };
  if (!extraction.answered_the_question && state.probe_count_current === 0) {
    return { action: 'REDIRECT', probe_target: extraction.probe_target, counts_as_probe: true, override_reason: null };
  }
  if (extraction.possible_inconsistency) {
    const key = `${extraction.possible_inconsistency.earlier_evidence_id}|${extraction.possible_inconsistency.what_differs}`;
    if (!state.clarified_inconsistencies.includes(key)) {
      return { action: 'CLARIFY', probe_target: extraction.possible_inconsistency.what_differs, counts_as_probe: false, override_reason: null };
    }
  }
  if (state.probe_count_current >= 2) {
    return { action: 'MOVE_ON', probe_target: '', counts_as_probe: false, override_reason: 'probe_limit' };
  }
  if (state.current_question?.target_competencies.some((id) => isSufficient(state.coverage[id]?.status))) {
    return { action: 'MOVE_ON', probe_target: '', counts_as_probe: false, override_reason: 'target_sufficient' };
  }
  if (extraction.recommended_action.startsWith('PROBE_')) {
    if (state.seniority === 'EXECUTIVE'
      && extraction.recommended_action === 'PROBE_OWNERSHIP'
      && state.executive_ownership_probe_used) {
      return { action: 'MOVE_ON', probe_target: '', counts_as_probe: false, override_reason: 'executive_ownership_probe_limit' };
    }
    return {
      action: extraction.recommended_action,
      probe_target: extraction.probe_target,
      counts_as_probe: true,
      override_reason: null,
    };
  }
  return { action: 'MOVE_ON', probe_target: '', counts_as_probe: false, override_reason: null };
}

export function applyImmediateDecision(
  state: InterviewState,
  decision: TurnDecision,
  extraction: ExtractionResult | null,
): InterviewState {
  const next = structuredClone(state);
  if (!next.current_question) throw new Error('No active question.');
  if (decision.action === 'REPHRASE') {
    const planned = next.plan[next.question_number - 1];
    next.current_question = { ...next.current_question, text: planned.rephrase, kind: 'REPHRASE' };
    return next;
  }
  if (decision.action === 'OFFER_HYPOTHETICAL') {
    next.hypothetical_offered_for.push(next.question_number);
    next.current_question = fallbackGeneratedQuestion('OFFER_HYPOTHETICAL', next.current_question, '');
    return next;
  }
  if (decision.action === 'CLARIFY' && extraction?.possible_inconsistency) {
    next.clarified_inconsistencies.push(
      `${extraction.possible_inconsistency.earlier_evidence_id}|${extraction.possible_inconsistency.what_differs}`,
    );
  }
  if (decision.counts_as_probe) {
    next.probe_count_current += 1;
    if (decision.action === 'PROBE_OWNERSHIP' && next.seniority === 'EXECUTIVE') {
      next.executive_ownership_probe_used = true;
    }
  }
  return next;
}

export function setGeneratedFollowup(state: InterviewState, question: GeneratedQuestion): InterviewState {
  const next = structuredClone(state);
  next.current_question = question;
  if (question.kind === 'MAIN') {
    const planned = next.plan[next.question_number - 1];
    if (planned) {
      next.plan[next.question_number - 1] = {
        ...planned,
        question_type: question.question_type,
        target_competencies: question.target_competencies,
        primary_intent: question.intent,
        text: question.text,
        framework: question.framework,
        rephrase: `Please answer this in another way: ${question.text}`,
      };
    }
  }
  return next;
}

export function advanceInterview(state: InterviewState): {
  state: InterviewState;
  needsReplacement: boolean;
  replacementCompetencyId: string | null;
} {
  const next = structuredClone(state);
  if (next.question_number >= next.plan.length) {
    next.phase = 'COMPLETE';
    next.status = 'COMPLETE';
    next.current_question = null;
    return { state: next, needsReplacement: false, replacementCompetencyId: null };
  }

  next.question_number += 1;
  next.probe_count_current = 0;
  const planned = next.plan[next.question_number - 1];
  const plannedCovered = planned.target_competencies.some((id) => isSufficient(next.coverage[id]?.status));
  if (!plannedCovered) {
    next.current_question = fromPlannedQuestion(planned);
    return { state: next, needsReplacement: false, replacementCompetencyId: null };
  }

  const blueprintTarget = highestValueUncovered(next);
  const replacementTarget = blueprintTarget ?? highestValueUncovered(next, true);
  next.current_question = fromPlannedQuestion(planned);
  if (!replacementTarget) {
    return { state: next, needsReplacement: false, replacementCompetencyId: null };
  }
  return { state: next, needsReplacement: true, replacementCompetencyId: replacementTarget };
}

export function recordDecision(state: InterviewState, input: {
  precheck: PrecheckResult;
  extraction: ExtractionResult | null;
  decision: TurnDecision;
  modelCalls: number;
  schemaRetry: boolean;
  latencyMs: number;
  dedupeHit?: boolean;
  probeCount?: number;
  fallbackUsed?: boolean;
}): InterviewState {
  const next = structuredClone(state);
  next.decision_log.push({
    interview_id: next.interview_id,
    turn: next.decision_log.length + 1,
    prompt_version: next.prompt_version,
    precheck: input.precheck.kind === 'NONE' ? null : input.precheck.kind,
    t1_action: input.extraction?.recommended_action ?? null,
    code_action: input.decision.action,
    override_reason: input.decision.override_reason,
    dedupe_hit: Boolean(input.dedupeHit),
    probe_count: input.probeCount ?? next.probe_count_current,
    model_calls: input.modelCalls,
    latency_ms: input.latencyMs,
    schema_retry: input.schemaRetry,
    fallback_used: Boolean(input.fallbackUsed),
    sufficient_competencies: Object.values(next.coverage).filter((entry) => isSufficient(entry.status)).length,
    stripped_patterns: input.precheck.stripped_patterns,
  });
  return next;
}

export function deterministicExtractionFallback(): ExtractionResult {
  return {
    answered_the_question: true,
    evidence: {
      summary: 'extraction failed',
      example_key: '',
      competencies: [],
      criteria: {},
      personal_ownership: 'ABSENT',
      numbers_stated: [],
      unsupported_claims: [],
      same_example_as: null,
    },
    recommended_action: 'MOVE_ON',
    probe_target: '',
    possible_inconsistency: null,
  };
}

export function turnActionNeedsQuestion(action: TurnAction): boolean {
  return action !== 'MOVE_ON' && action !== 'COMPLETE' && action !== 'REPHRASE' && action !== 'OFFER_HYPOTHETICAL';
}
