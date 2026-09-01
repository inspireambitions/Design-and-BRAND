import { INDUSTRIES, ROLES } from './roles';

export type CatalogueStats = {
  roles: number;
  questions: number;
  industries: number;
};

/** Real counts from the role catalogue. Nothing here is estimated. */
export function catalogueStats(): CatalogueStats {
  const ids = new Set<string>();
  for (const role of ROLES) {
    for (const question of role.questions) ids.add(question.id);
    for (const question of role.bank ?? []) ids.add(question.id);
  }
  return { roles: ROLES.length, questions: ids.size, industries: INDUSTRIES.length };
}
