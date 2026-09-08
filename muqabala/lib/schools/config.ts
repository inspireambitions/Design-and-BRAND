/** This server setting is opt-in; missing or ambiguous values keep schools closed. */
export function schoolsEnabled(value: string | undefined = process.env.SCHOOLS_ENABLED): boolean {
  return value === 'true';
}
