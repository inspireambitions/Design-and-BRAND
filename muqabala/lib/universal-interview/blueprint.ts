import { boilerplateCompetencyNames } from './sanitise.ts';
import type {
  CandidateProfile,
  DiscoveredCompetency,
  DiscoveryResult,
  PlannedQuestion,
  QuestionType,
  RolePack,
} from './types.ts';
import { frameworkForQuestionType } from './questions.ts';

const CATALOGUE: Record<string, Omit<DiscoveredCompetency, 'source' | 'source_text' | 'importance'>> = {
  c_role_relevance: { id: 'c_role_relevance', name: 'Role relevance', family: 'motivation' },
  c_motivation: { id: 'c_motivation', name: 'Motivation', family: 'motivation' },
  c_communication: { id: 'c_communication', name: 'Clear communication', family: 'behavioural' },
  c_problem_solving: { id: 'c_problem_solving', name: 'Problem solving', family: 'cognitive' },
  c_guest_service: { id: 'c_guest_service', name: 'Guest service', family: 'behavioural' },
  c_complaint_handling: { id: 'c_complaint_handling', name: 'Complaint handling', family: 'behavioural' },
  c_prioritisation: { id: 'c_prioritisation', name: 'Prioritisation', family: 'cognitive' },
  c_technical_reasoning: { id: 'c_technical_reasoning', name: 'Technical reasoning', family: 'technical' },
  c_collaboration: { id: 'c_collaboration', name: 'Collaboration', family: 'behavioural' },
  c_commercial_judgement: { id: 'c_commercial_judgement', name: 'Commercial judgement', family: 'commercial' },
  c_coaching: { id: 'c_coaching', name: 'Coaching others', family: 'leadership' },
  c_sales_delivery: { id: 'c_sales_delivery', name: 'Sales delivery', family: 'commercial' },
  c_leadership: { id: 'c_leadership', name: 'Leadership', family: 'leadership' },
  c_learning_agility: { id: 'c_learning_agility', name: 'Learning agility', family: 'cognitive' },
  c_teamwork: { id: 'c_teamwork', name: 'Teamwork', family: 'behavioural' },
};

function assumedCompetency(id: string, rolePackCore: boolean): DiscoveredCompetency {
  const known = CATALOGUE[id] ?? {
    id,
    name: id.replace(/^c_/, '').replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase()),
    family: 'behavioural' as const,
  };
  return {
    ...known,
    source: 'ASSUMED',
    source_text: '',
    importance: rolePackCore ? 'HIGH' : 'MEDIUM',
  };
}

function acceptableCompetency(competency: DiscoveredCompetency): boolean {
  const name = competency.name.trim().toLowerCase();
  return !boilerplateCompetencyNames.has(name) && !/^(?:good|great|excellent|strong|flexible)$/.test(name);
}

export function mergeAndRankCompetencies(
  discovered: DiscoveredCompetency[],
  pack: RolePack,
  careerChange: boolean,
): DiscoveredCompetency[] {
  const merged = new Map<string, DiscoveredCompetency>();
  discovered.filter(acceptableCompetency).slice(0, 12).forEach((competency, index) => {
    merged.set(competency.id, { ...competency, jd_order: competency.jd_order ?? index });
  });
  for (const id of [...pack.implicit_competencies, ...pack.core_competencies]) {
    if (!merged.has(id)) merged.set(id, assumedCompetency(id, pack.core_competencies.includes(id)));
  }
  if (careerChange && !merged.has('c_motivation')) {
    merged.set('c_motivation', { ...assumedCompetency('c_motivation', true), importance: 'HIGH' });
  }

  const importanceWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
  const sourceWeight = { EXPLICIT: 2, INFERRED: 1, ASSUMED: 0 } as const;
  return [...merged.values()]
    .map((competency) => ({
      competency,
      score:
        importanceWeight[competency.importance]
        + sourceWeight[competency.source]
        + (pack.core_competencies.includes(competency.id) ? 1 : 0)
        + (careerChange && competency.family === 'motivation' ? 2 : 0),
    }))
    .sort((left, right) => right.score - left.score || (left.competency.jd_order ?? 999) - (right.competency.jd_order ?? 999))
    .map(({ competency }) => competency)
    .slice(0, 12);
}

export function fallbackDiscovery(profile: CandidateProfile, pack: RolePack): DiscoveryResult {
  const required = [...pack.core_competencies, ...pack.implicit_competencies];
  const general = ['c_role_relevance', 'c_communication', 'c_problem_solving', 'c_motivation', 'c_teamwork'];
  const competencies = [...new Set([...required, ...general])].slice(0, 12).map((id, index) => ({
    ...assumedCompetency(id, pack.core_competencies.includes(id)),
    jd_order: index,
  }));
  return {
    competencies,
    role_summary: `A competency interview for ${profile.target_role}.`,
    seniority_detected: profile.experience_level,
    management_scope: profile.management_experience ? 'Candidate reports management experience.' : 'none',
  };
}

export function confirmBlueprint(discovery: DiscoveredCompetency[], competencyIds: string[]): DiscoveredCompetency[] {
  if (competencyIds.length !== 5 || new Set(competencyIds).size !== 5) {
    throw new Error('Exactly five different competencies must be confirmed.');
  }
  const byId = new Map(discovery.map((competency) => [competency.id, competency]));
  const selected = competencyIds.map((id) => byId.get(id));
  if (selected.some((competency) => !competency)) {
    throw new Error('The confirmed blueprint contains an unknown competency.');
  }
  return selected as DiscoveredCompetency[];
}

function questionTypeFor(competency: DiscoveredCompetency): QuestionType {
  if (competency.family === 'technical') return 'TECHNICAL';
  if (competency.family === 'leadership') return 'LEADERSHIP';
  if (competency.family === 'commercial') return 'COMMERCIAL';
  if (competency.family === 'motivation') return 'MOTIVATION';
  return 'BEHAVIOURAL';
}

function question(slot: number, text: string, type: QuestionType, competency: DiscoveredCompetency, intent: string): PlannedQuestion {
  return {
    slot,
    text,
    rephrase: `Please answer this in another way: ${text}`,
    question_type: type,
    primary_intent: intent,
    target_competencies: [competency.id],
    framework: frameworkForQuestionType(type),
  };
}

export function fallbackPlan(blueprint: DiscoveredCompetency[], profile: CandidateProfile, pack: RolePack): PlannedQuestion[] {
  if (blueprint.length !== 5) throw new Error('A confirmed five-competency blueprint is required.');
  const [first, second, third, fourth, fifth] = blueprint;
  const role = profile.target_role;
  const motivation = blueprint.find((competency) => competency.family === 'motivation') ?? first;
  const behavioural = blueprint.find((competency) => competency.family === 'behavioural') ?? third;
  const situational = blueprint.find((competency) => competency.family === 'cognitive') ?? fourth;
  const bank = pack.question_bank;

  return [
    question(
      1,
      profile.career_change
        ? `Talk me through your career change and why ${role} is the right next step.`
        : `Tell me about your background and why it fits this ${role} role.`,
      'INTRODUCTION',
      motivation,
      profile.career_change ? 'CAREER_COHERENCE' : 'ROLE_RELEVANCE',
    ),
    question(2, `Tell me about a time you showed ${first.name.toLowerCase()}.`, questionTypeFor(first), first, first.id),
    question(3, `Give me a specific example of how you used ${second.name.toLowerCase()}.`, questionTypeFor(second), second, second.id),
    question(4, `Describe a difficult situation that tested your ${third.name.toLowerCase()}.`, questionTypeFor(third), third, third.id),
    question(5, bank[0]?.text ?? 'Tell me about a challenging disagreement and how you handled it.', 'BEHAVIOURAL', behavioural, 'CHALLENGE_OR_CONFLICT'),
    question(6, bank[1]?.text ?? `Imagine priorities change suddenly in this ${role} role. What would you do first?`, 'SITUATIONAL', situational, 'SITUATIONAL_JUDGEMENT'),
    question(7, `Tell me about a result that shows your ${fourth.name.toLowerCase()}.`, questionTypeFor(fourth), fourth, fourth.id),
    question(8, `What example best shows your ${fifth.name.toLowerCase()} for this role?`, questionTypeFor(fifth), fifth, 'HIGHEST_VALUE_UNCOVERED'),
  ];
}

export function addPlanRephrases(plan: Omit<PlannedQuestion, 'rephrase'>[]): PlannedQuestion[] {
  const slots = new Set<number>();
  return plan.map((item) => {
    if (slots.has(item.slot)) throw new Error('Interview plan contains a duplicate slot.');
    slots.add(item.slot);
    return { ...item, rephrase: `Please answer this in another way: ${item.text}` };
  }).sort((left, right) => left.slot - right.slot);
}
