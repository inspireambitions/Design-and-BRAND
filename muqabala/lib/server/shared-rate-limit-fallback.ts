import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

type LimitDecision = {
  limited: boolean;
  retryAfterSeconds: number;
};

export async function consumeDatabaseRateLimit(options: {
  bucketName: string;
  identifierHash: string;
  limit: number;
  windowSeconds: number;
}): Promise<LimitDecision | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_bucket: options.bucketName,
    p_identifier_hash: options.identifierHash,
    p_limit: options.limit,
    p_window_seconds: options.windowSeconds,
  });
  const decision = data as { limited?: unknown; retry_after_seconds?: unknown } | null;
  if (error || typeof decision?.limited !== 'boolean') return null;
  return {
    limited: decision.limited,
    retryAfterSeconds: typeof decision.retry_after_seconds === 'number'
      ? Math.max(0, Math.ceil(decision.retry_after_seconds))
      : 0,
  };
}
