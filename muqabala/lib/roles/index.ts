import { hospitalityRoles, aviationRoles } from './hospitality';
import { tradesRoles } from './trades';
import { logisticsRoles, retailRoles, facilitiesRoles } from './operations';
import { careRoles } from './care';
import { officeRoles } from './office';
import { CUSTOM_ROLE_ID, buildCustomRole } from './custom';

export type { Competency, Question, Role } from './shared';
export { CUSTOM_ROLE_ID, buildCustomRole };

export const ROLES = [
  ...hospitalityRoles,
  ...aviationRoles,
  ...tradesRoles,
  ...logisticsRoles,
  ...retailRoles,
  ...facilitiesRoles,
  ...careRoles,
  ...officeRoles,
];

export function getRole(id: string) {
  if (id === CUSTOM_ROLE_ID) return buildCustomRole();
  return ROLES.find((r) => r.id === id);
}

export const INDUSTRIES = Array.from(new Set(ROLES.map((r) => r.industry))).sort();
