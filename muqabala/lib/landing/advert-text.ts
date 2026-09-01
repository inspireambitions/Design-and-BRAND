/** Matches the server threshold in /api/interview for building from an advert. */
export const MIN_ADVERT_CHARS = 120;

/** Someone pasted a link instead of the advert text. */
export function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) || (/^www\.\S+$/i.test(trimmed) && !trimmed.includes(' '));
}

/** Long enough to tailor from, and actual text rather than a link. */
export function advertUsable(value: string): boolean {
  const trimmed = value.trim();
  return !looksLikeUrl(trimmed) && trimmed.length >= MIN_ADVERT_CHARS;
}
