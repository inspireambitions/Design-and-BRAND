import { hospitalityRoles, aviationRoles } from './hospitality';
import { tradesRoles } from './trades';
import { logisticsRoles, retailRoles, facilitiesRoles } from './operations';
import { careRoles } from './care';
import { officeRoles } from './office';
import { energyRoles, automotiveRoles } from './industrial';
import { creativeRoles } from './creative';
import { CUSTOM_ROLE_ID, buildCustomRole } from './custom';
import { serviceCompetencies, technicalCompetencies, careCompetencies, type Role } from './shared';
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
 * Attach the shared question bank matching each role's competency family, so
 * repeat practice draws fresh questions instead of the same five. Matched by
 * reference: every catalogue role imports one of the three shared competency
 * arrays. Roles with bespoke competencies (none today) get no bank, which the
 * draw logic treats as "no rotation" — never an error.
 */
function withBank(role: Role): Role {
  if (role.competencies === serviceCompetencies) return { ...role, bank: serviceBank };
  if (role.competencies === technicalCompetencies) return { ...role, bank: technicalBank };
  if (role.competencies === careCompetencies) return { ...role, bank: careBank };
  return role;
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
