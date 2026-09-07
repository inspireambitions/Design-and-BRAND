import { hospitalityRoles, aviationRoles } from './hospitality';
import { tradesRoles } from './trades';
import { logisticsRoles, retailRoles, facilitiesRoles } from './operations';
import { careRoles } from './care';
import { officeRoles } from './office';
import { energyRoles, automotiveRoles } from './industrial';
import { creativeRoles } from './creative';
import { CUSTOM_ROLE_ID, buildCustomRole } from './custom';
import { serviceCompetencies, technicalCompetencies, careCompetencies, type Competency, type Role } from './shared';
import { serviceBank, technicalBank, careBank } from './banks';

export type { Competency, Question, Role } from './shared';
export { CUSTOM_ROLE_ID, buildCustomRole };

/**
 * The small first-use shortlist shared by the marketing homepage and practice
 * picker. Keep this ordered: it deliberately spans the largest candidate
 * journeys instead of mirroring the full catalogue.
 */
export const POPULAR_ROLE_IDS = [
  'front-office-agent',
  'customer-service',
  'nurse',
  'accountant',
  'sales-executive',
  'electrician',
] as const;

/**
 * Some service questions assess standards and safety, while some technical or
 * care questions assess customer focus. Those two criteria live outside the
 * role's usual five-item family. Add the exact shared definition when a
 * question needs it so the candidate never receives a hidden or partial
 * rubric. Any future unknown criterion fails at catalogue load instead of
 * silently disappearing from the interview.
 */
const CROSS_FAMILY_COMPETENCIES = new Map(
  [
    (() => {
      const competency = serviceCompetencies.find((item) => item.id === 'customer_focus');
      return competency
        ? {
            ...competency,
            anchor: 'Keeps the person being served and their needs central throughout the answer.',
            anchorAr: 'يجعل الشخص الذي يتلقى الخدمة واحتياجاته محور الإجابة بالكامل.',
          }
        : undefined;
    })(),
    technicalCompetencies.find((competency) => competency.id === 'compliance'),
  ]
    .filter((competency): competency is Competency => Boolean(competency))
    .map((competency) => [competency.id, competency]),
);

/**
 * Attach the shared question bank matching each role's competency family, so
 * repeat practice draws fresh questions instead of the same five. Matched by
 * reference: every catalogue role imports one of the three shared competency
 * arrays. Roles with bespoke competencies (none today) get no bank, which the
 * draw logic treats as "no rotation": never an error.
 */
function withBank(role: Role): Role {
  const bank = role.competencies === serviceCompetencies
    ? serviceBank
    : role.competencies === technicalCompetencies
      ? technicalBank
      : role.competencies === careCompetencies
        ? careBank
        : role.bank;
  const available = new Set(role.competencies.map((competency) => competency.id));
  const required = new Set(
    [...role.questions, ...(bank ?? [])].flatMap((question) => question.competencies),
  );
  const additions = [...required]
    .filter((id) => !available.has(id))
    .map((id) => {
      const competency = CROSS_FAMILY_COMPETENCIES.get(id);
      if (!competency) throw new Error(`Role ${role.id} uses an unknown rubric criterion: ${id}`);
      return competency;
    });
  return { ...role, competencies: [...role.competencies, ...additions], bank };
}

export const ROLES = [
  ...hospitalityRoles,
  ...aviationRoles,
  ...tradesRoles,
  ...logisticsRoles,
  ...retailRoles,
  ...facilitiesRoles,
  ...careRoles,
  ...officeRoles,
  ...energyRoles,
  ...automotiveRoles,
  ...creativeRoles,
].map(withBank);

export function getRole(id: string) {
  if (id === CUSTOM_ROLE_ID) return buildCustomRole();
  return ROLES.find((r) => r.id === id);
}

export const INDUSTRIES = Array.from(new Set(ROLES.map((r) => r.industry))).sort();
