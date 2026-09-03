import { createHash } from 'node:crypto';
import { fallbackDiscovery, fallbackPlan, mergeAndRankCompetencies } from './blueprint.ts';
import { activateInterview, createInterviewState } from './engine.ts';
import { candidateSafeQuestion, makeBankQuestion } from './questions.ts';
import { serialiseCandidateQuestion, validateCandidateText } from './candidate-question.ts';
import { getRolePack } from './role-packs/index.ts';
import { assessJobDescription } from './sanitise.ts';
import type {
  CandidateProfile,
  CompetencyFamily,
  DiscoveredCompetency,
  GeneratedQuestion,
  InterviewState,
  PlannedQuestion,
} from './types.ts';
import type { AnswerFeedback } from '@/lib/scoring';
import type { Question, Role } from '@/lib/roles';

function compactId(value: string): string {
  const normalised = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 54);
  const safe = normalised.length >= 2 ? normalised : `skill_${createHash('sha1').update(value).digest('hex').slice(0, 8)}`;
  return `c_${safe}`;
}

function competencyFamily(value: string): CompetencyFamily {
  if (/lead|manage|coach|supervis|delegate|team direction/.test(value)) return 'leadership';
  if (/commercial|sales|revenue|profit|budget|cost|business/.test(value)) return 'commercial';
  if (/technical|system|safety|standard|compliance|procedure|quality/.test(value)) return 'technical';
  if (/problem|judgement|decision|prioriti|analys|reason/.test(value)) return 'cognitive';
  if (/motivat|career|role relevance|commitment/.test(value)) return 'motivation';
  return 'behavioural';
}

export function employerExperienceLevel(level: Role['level']): CandidateProfile['experience_level'] {
  if (level === 'Entry') return 'ENTRY';
  if (level === 'Senior') return 'SENIOR_MANAGER';
  return 'PROFESSIONAL';
}

function mappedCompetencies(role: Role): { items: DiscoveredCompetency[]; ids: Map<string, string> } {
  const ids = new Map<string, string>();
  const seen = new Set<string>();
  const items = role.competencies.map((competency, index) => {
    let id = compactId(competency.id || competency.label);
    if (seen.has(id)) id = `${id.slice(0, 54)}_${index + 1}`;
    seen.add(id);
    ids.set(competency.id, id);
    const source = `${competency.label} ${competency.anchor}`.toLowerCase();
    return {
      id,
      name: competency.label,
      family: competencyFamily(source),
      source: 'EXPLICIT' as const,
      source_text: competency.anchor.slice(0, 240),
      importance: 'HIGH' as const,
      jd_order: index,
    };
  });
  return { items, ids };
}

function overlayEmployerQuestions(
  base: PlannedQuestion[],
  questions: Question[],
  competencyIds: Map<string, string>,
): PlannedQuestion[] {
  if (questions.length === 0) return base;
  const slots = questions.length >= 8
    ? questions.slice(0, 8).map((_, index) => index)
    : questions.length === 3
      ? [0, 4, 7]
      : questions.map((_, index) => Math.min(7, index));
  const next = structuredClone(base);
  questions.slice(0, slots.length).forEach((question, questionIndex) => {
    const slot = slots[questionIndex];
    const targets = question.competencies.map((id) => competencyIds.get(id)).filter(Boolean) as string[];
    const validation = validateCandidateText(question.text, {
      language: 'en',
      seniority: base[slot].seniority,
    });
    if (!validation.ok) {
      console.warn('question_rejected', {
        event: 'question_rejected',
        source: 'BANK',
        question_id: question.id,
        reasons: validation.reasons,
        prompt_version: null,
      });
      return;
    }
    next[slot] = {
      ...makeBankQuestion({
        question_id: question.id,
        candidate_text: question.text,
        interviewer_intent: next[slot].interviewer_intent,
        probe_targets: next[slot].probe_targets,
        question_type: next[slot].question_type,
        target_competencies: targets.length ? targets.slice(0, 2) : next[slot].target_competencies,
        seniority: next[slot].seniority,
      }),
      slot: next[slot].slot,
    };
  });
  return next;
}

export function createEmployerBrainState(input: {
  interviewId: string;
  packId: string;
  role: Role;
}): InterviewState {
  const experienceLevel = employerExperienceLevel(input.role.level);
  const profile: CandidateProfile = {
    experience_level: experienceLevel,
    years_experience: 0,
    current_or_previous_role: '',
    target_role: input.role.title,
    industry_background: input.role.industry,
    career_change: false,
    management_experience: experienceLevel === 'SENIOR_MANAGER' || experienceLevel === 'EXECUTIVE' || experienceLevel === 'MANAGER',
    language: 'en',
  };
  const rolePack = getRolePack(input.role.title);
  const mapped = mappedCompetencies(input.role);
  const fallback = fallbackDiscovery(profile, rolePack);
  const discovery = {
    ...fallback,
    competencies: mergeAndRankCompetencies([...mapped.items, ...fallback.competencies], rolePack, false),
    role_summary: `An adaptive employer interview for ${input.role.title}.`,
    seniority_detected: experienceLevel,
  };
  const state = createInterviewState({
    interviewId: input.interviewId,
    profile,
    jdQuality: assessJobDescription(''),
    discovery,
    rolePack,
  });
  const selected = discovery.competencies.slice(0, 5);
  const plan = overlayEmployerQuestions(fallbackPlan(selected, profile, rolePack), input.role.questions, mapped.ids);
  const active = activateInterview(state, selected.map((competency) => competency.id), plan);
  active.screening = {
    pack_id: input.packId,
    processed_answer_count: 0,
    evidence_after_answers: [],
    competency_id_map: Object.fromEntries([...mapped.ids].map(([legacyId, brainId]) => [brainId, legacyId])),
  };
  return active;
}

export function employerBrainQuestionSnapshot(question: GeneratedQuestion, turnIndex: number): Question {
  const safeQuestion = candidateSafeQuestion(question);
  return {
    id: `brain_${turnIndex}_${safeQuestion.kind.toLowerCase()}`,
    text: safeQuestion.candidate_text,
    textAr: safeQuestion.candidate_text,
    competencies: safeQuestion.target_competencies,
    hint: '',
    hintAr: '',
    prepSeconds: 30,
    answerSeconds: 120,
  };
}

/** Candidate-safe adaptive state. Employer evidence and coverage never leave the server here. */
export function publicEmployerBrainState(state: InterviewState) {
  return {
    stage: state.phase === 'COMPLETE' ? 'complete' as const : 'questions' as const,
    current_question: state.current_question
      ? serialiseCandidateQuestion(candidateSafeQuestion(state.current_question), state.question_number, state.plan.length)
      : null,
  };
}

const strengthScore = { WEAK: 35, MEDIUM: 65, STRONG: 85 } as const;

export function employerBrainAnswerFeedback(input: {
  state: InterviewState;
  question: GeneratedQuestion;
  questionId: string;
  evidenceStart: number;
}): AnswerFeedback {
  const evidence = input.state.evidence_ledger.slice(input.evidenceStart).at(-1);
  const automatedAnalysisUnavailable = evidence?.summary === 'extraction failed'
    && Object.keys(evidence.competencies).length === 0;
  if (!evidence || automatedAnalysisUnavailable) {
    return {
      questionId: input.questionId,
      score: 0,
      status: 'unscored',
      unscoredReason: 'question_not_answered',
      headline: 'No reliable evidence was extracted from this answer.',
      competencies: [],
      strengths: [],
      improvements: ['Review the recording and transcript directly.'],
      coachTip: '',
      source: 'none',
      scoringVersion: 'universal-brain-v2',
      rubricVersion: input.state.prompt_version,
    };
  }
  const competencies = input.question.target_competencies.map((id) => {
    const competency = input.state.discovery.find((item) => item.id === id);
    const strength = evidence.competencies[id] ?? 'WEAK';
    return {
      id: input.state.screening?.competency_id_map[id] ?? id,
      label: competency?.name ?? id,
      score: Math.round(strengthScore[strength] / 10),
      evidence: evidence.summary,
    };
  });
  const missing = Object.entries(evidence.criteria)
    .filter(([, status]) => status === 'MISSING' || status === 'WEAK')
    .map(([criterion]) => criterion.replaceAll('_', ' '));
  const score = competencies.length
    ? Math.round(competencies.reduce((total, item) => total + item.score * 10, 0) / competencies.length)
    : 35;
  return {
    questionId: input.questionId,
    score,
    status: 'scored',
    headline: evidence.summary,
    competencies,
    strengths: missing.length ? [] : ['The answer covered the expected evidence clearly.'],
    improvements: missing.length ? [`The evidence needs clearer ${missing.slice(0, 2).join(' and ')}.`] : [],
    coachTip: missing.length ? `Check the recording for ${missing[0]}.` : 'Verify this analysis against the recording.',
    source: 'ai',
    scoringVersion: 'universal-brain-v2',
    rubricVersion: input.state.prompt_version,
  };
}
