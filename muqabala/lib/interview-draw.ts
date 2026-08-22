import type { Question, Role } from './roles';


/**
 * Draws the interview a candidate actually takes.
 *
 * Every catalogue role is opener + three role-specific questions + closer, and
 * a shared bank extends the middle pool. Attempt one gets the curated core
 * questions; each following attempt rotates to the next block of the pool, so
 * practising again means a fresh interview rather than rehearsing memorised
 * answers.
 *
 * Deterministic on purpose: the variant comes from how many attempts the
 * candidate has completed for this role, so a reload mid-interview shows the
 * same questions, and scoring stays reproducible. No randomness.
 *
 * Scoring safety: every question here comes from role.questions or role.bank,
 * both of which the score route accepts — a drawn question can never 404.
 */
export function drawInterview(role: Role, completedAttempts: number): Role {
  const bank = role.bank ?? [];
  // Not a standard opener/middles/closer shape, or nothing to rotate through:
  // leave the role exactly as authored.
  if (bank.length === 0 || role.questions.length < 3) return role;

  const opener = role.questions[0];
  const closer = role.questions[role.questions.length - 1];
  const coreMiddles = role.questions.slice(1, -1);
  const pool: Question[] = [...coreMiddles, ...bank];
  const perSet = coreMiddles.length;
  if (perSet === 0 || pool.length <= perSet) return role;

  const variant = Math.max(0, Math.floor(completedAttempts));
  const start = (variant * perSet) % pool.length;
  const middles: Question[] = [];
  for (let i = 0; i < perSet; i += 1) {
    middles.push(pool[(start + i) % pool.length]);
  }

  return { ...role, questions: [opener, ...middles, closer] };
}

/**
 * The Full Mock set: opener + six middles + closer, drawn from the same pool
 * with the same determinism. Null when the role has no bank to widen with —
 * callers hide the mock option rather than faking one.
 */
export function drawMockQuestions(role: Role, completedAttempts: number): Question[] | null {
  const bank = role.bank ?? [];
  if (bank.length === 0 || role.questions.length < 3) return null;

  const opener = role.questions[0];
  const closer = role.questions[role.questions.length - 1];
  const pool: Question[] = [...role.questions.slice(1, -1), ...bank];
  const take = 6;
  if (pool.length < take) return null;

  const variant = Math.max(0, Math.floor(completedAttempts));
  const start = (variant * take) % pool.length;
  const middles: Question[] = [];
  for (let i = 0; i < take; i += 1) middles.push(pool[(start + i) % pool.length]);
  return [opener, ...middles, closer];
}
