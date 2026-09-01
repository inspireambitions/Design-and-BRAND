/**
 * A quick check for the browser so an obvious typo is caught before the
 * request. The server (lib/landing/interview-pack.ts, zod) remains the
 * authority. Kept apart from that module so zod never enters the client bundle.
 */
export function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}
