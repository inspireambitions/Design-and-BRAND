import { type SupabaseClient } from '@supabase/supabase-js';

export interface StuckAttemptRecord {
  id: string;
  status: string;
  feedback_status: string;
  feedback_tries: number;
  feedback_failure_code: string | null;
  answers?: unknown;
}

/**
 * Validates whether an attempt is specifically eligible for post-Neb defect recovery.
 * Strictly avoids resetting non-submitted attempts, drafts, or unrelated failures.
 */
export function isEligibleForFeedbackRecovery(attempt: StuckAttemptRecord): boolean {
  if (attempt.status !== 'submitted') return false;
  if (attempt.feedback_status !== 'failed') return false;
  if (attempt.feedback_tries < 3) return false;

  // If already recovered and failed again for another reason, do not enter infinite recovery loop
  if (attempt.feedback_failure_code && attempt.feedback_failure_code.startsWith('recovered:')) {
    return false;
  }

  // Defect signatures from Phase 1:
  // 1. questions:TypeError / questions:failed (Intl.Segmenter on undefined or missing question links)
  // 2. evidence:failed / evidence:schema / evidence:excerpt (Intl.Segmenter/slice on sparse answers)
  // 3. wording:failed
  // 4. Null or generic failure code with exhausted retries on submitted attempt
  const failure = attempt.feedback_failure_code || '';
  const knownDefectSignatures = [
    'questions:',
    'evidence:',
    'provider:',
    'wording:',
    'storage:',
  ];

  const hasKnownSignature = failure === '' || knownDefectSignatures.some(sig => failure.startsWith(sig));
  return hasKnownSignature;
}

/**
 * Recovers stuck feedback attempts in a database (Supabase client or PGlite instance).
 * Bounded: Only resets attempts meeting strict eligibility criteria.
 * Preserves answers, evidence ledger, adaptive turns, and audit history.
 */
export async function recoverStuckFeedbackAttempts(
  db: SupabaseClient | { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }> }
): Promise<number> {
  // Check if PGlite / direct pg client
  if ('query' in db && typeof db.query === 'function') {
    const candidateQuery = await db.query(
      `select id, status, feedback_status, feedback_tries, feedback_failure_code, answers
       from public.schools_assignment_attempts
       where status = 'submitted' and feedback_status = 'failed' and feedback_tries >= 3`
    );

    const eligibleIds = (candidateQuery.rows as StuckAttemptRecord[])
      .filter(isEligibleForFeedbackRecovery)
      .map(r => r.id);

    if (eligibleIds.length === 0) return 0;

    let recovered = 0;
    for (const id of eligibleIds) {
      const res = await db.query(
        `update public.schools_assignment_attempts
         set feedback_status = 'pending',
             feedback_tries = 0,
             feedback_claim = null,
             feedback_failure_code = 'recovered:post_neb_defect:' || timezone('utc', now())::text
         where id = $1 and status = 'submitted' and feedback_status = 'failed' and feedback_tries >= 3`,
        [id]
      );
      recovered += (res.rowCount ?? 1);
    }
    return recovered;
  }

  // Supabase admin client
  const supabase = db as SupabaseClient;
  const { data: candidates, error } = await supabase
    .from('schools_assignment_attempts')
    .select('id, status, feedback_status, feedback_tries, feedback_failure_code')
    .eq('status', 'submitted')
    .eq('feedback_status', 'failed')
    .gte('feedback_tries', 3);

  if (error || !candidates || candidates.length === 0) return 0;

  const eligible = (candidates as StuckAttemptRecord[]).filter(isEligibleForFeedbackRecovery);
  if (eligible.length === 0) return 0;

  let count = 0;
  for (const item of eligible) {
    const recoveryStamp = `recovered:post_neb_defect:${new Date().toISOString()}`;
    const { error: updateError } = await supabase
      .from('schools_assignment_attempts')
      .update({
        feedback_status: 'pending',
        feedback_tries: 0,
        feedback_claim: null,
        feedback_failure_code: recoveryStamp,
      })
      .eq('id', item.id)
      .eq('status', 'submitted')
      .eq('feedback_status', 'failed')
      .gte('feedback_tries', 3);

    if (!updateError) {
      count++;
    }
  }

  return count;
}
