/**
 * Shared vocabulary for the plan request that the browser also needs. Kept
 * free of zod so the card does not pull the validator into the practice bundle.
 */
export const PLAN_VERSION = '2' as const;
export const CONSENT_VERSION = 'practice-plan-delivery-v2' as const;

export const PLAN_MODES = ['type', 'speak', 'video'] as const;
export type PlanMode = (typeof PLAN_MODES)[number];

export const CONSENT_SOURCES = ['feedback_card', 'advert_pack'] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export function normalizeEmail(value: string): string {
  const collapsed = value.replace(/\s+/g, '').normalize('NFC');
  const at = collapsed.lastIndexOf('@');
  if (at < 1) return collapsed;
  return `${collapsed.slice(0, at)}@${collapsed.slice(at + 1).toLowerCase()}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '••••';
  return `${local.slice(0, 1)}${'•'.repeat(Math.min(5, Math.max(2, local.length - 1)))}@${domain}`;
}
