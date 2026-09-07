import frontDeskAgent from './front-desk-agent.json';
import graduateTrainee from './graduate-trainee.json';
import salesManager from './sales-manager.json';
import softwareEngineer from './software-engineer.json';
import { fixedRephrase, loadValidatedQuestionBank } from '../candidate-question.ts';
import { frameworkForQuestionType } from '../questions.ts';
import type { ExperienceLevel, QuestionType, RolePack } from '../types.ts';

type RawPack = Omit<RolePack, 'question_bank'> & {
  question_bank: Array<{
    question_id: string;
    candidate_text: string;
    question_type: QuestionType;
    target_competencies: string[];
    interviewer_intent: string;
  }>;
};

function loadPack(raw: RawPack, seniority: ExperienceLevel): RolePack {
  const question_bank = loadValidatedQuestionBank(raw.question_bank.map((question) => ({
    ...question,
    probe_targets: [],
    seniority,
    language: 'en' as const,
    source: 'BANK' as const,
    prompt_version: null,
    rephrase_text: fixedRephrase(question.question_type),
    framework: frameworkForQuestionType(question.question_type),
    kind: 'MAIN' as const,
  })));
  return { ...raw, question_bank };
}

const packs = [
  loadPack(frontDeskAgent as RawPack, 'ENTRY'),
  loadPack(softwareEngineer as RawPack, 'ENTRY'),
  loadPack(salesManager as RawPack, 'ENTRY'),
  loadPack(graduateTrainee as RawPack, 'ENTRY'),
];

const genericPack: RolePack = {
  role: 'Generic role',
  version: '1.0',
  author: 'Inspire Ambitions HR Career Specialist',
  reviewed_by: null,
  reviewed_at: null,
  implicit_competencies: ['c_communication', 'c_problem_solving', 'c_motivation'],
  core_competencies: ['c_role_relevance'],
  question_bank: [],
  assessment_type: 'COMPETENCY',
  technical_reference: null,
  is_fallback: true,
};

function normaliseRole(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function getRolePack(role: string): RolePack {
  const wanted = normaliseRole(role);
  const exact = packs.find((pack) => normaliseRole(pack.role) === wanted);
  if (exact) return exact;

  if (/front desk|front office|reception/.test(wanted)) return frontDeskAgent as RolePack;
  if (/software|developer|programmer/.test(wanted)) return softwareEngineer as RolePack;
  if (/sales manager|business development manager/.test(wanted)) return salesManager as RolePack;
  if (/graduate|trainee|intern/.test(wanted)) return graduateTrainee as RolePack;
  return { ...genericPack, role: role || genericPack.role };
}

export function rolePackFound(role: string): boolean {
  return !getRolePack(role).is_fallback;
}

export const VALIDATION_ROLE_PACKS = packs;
