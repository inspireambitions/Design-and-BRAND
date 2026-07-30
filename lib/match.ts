/**
 * Match score bands. A single number implies precision the model doesn't have,
 * so the band leads and the score supports it. Shared between the report header
 * and the roadmap email so they can never disagree.
 */
export function matchBand(score: number): string {
  if (score >= 78) return "Strong fit";
  if (score >= 55) return "Achievable with focus";
  if (score >= 38) return "Ambitious";
  return "Steep — read the risk section first";
}
