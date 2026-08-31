export const GOOGLE_ANALYTICS_ID = 'G-P0ZRD76L3J';

const PRIVATE_ROUTE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/s\/[^/]+(?:\/.*)?$/, '/s/[code]'],
  [/^\/share\/[^/]+(?:\/.*)?$/, '/share/[token]'],
  [/^\/account\/reports\/[^/]+(?:\/.*)?$/, '/account/reports/[id]'],
  [/^\/employer\/interviews\/[^/]+(?:\/.*)?$/, '/employer/interviews/[id]'],
];

/** Keep useful route-level analytics without sending private link identifiers. */
export function analyticsPagePath(pathname: string): string {
  const path = pathname || '/';
  return PRIVATE_ROUTE_PATTERNS.find(([pattern]) => pattern.test(path))?.[1] ?? path;
}
