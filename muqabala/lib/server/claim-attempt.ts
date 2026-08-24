import 'server-only';

import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { ATTEMPT_COOKIE, AUTH_STATE_COOKIE, emailHash, isOpaqueToken, tokenHash } from './security';

export type ClaimedAttempt = { id: string; roleId: string; status: 'in_progress' | 'completed' };

export async function claimCurrentAttempt(user: User, suppliedState?: string | null): Promise<ClaimedAttempt | null> {
  const admin = createAdminClient();
  if (!admin || !user.email) return null;
  const cookieStore = await cookies();
  const state = suppliedState ?? cookieStore.get(AUTH_STATE_COOKIE)?.value;
  if (!isOpaqueToken(state)) return null;

  const { data, error } = await admin.rpc('redeem_interview_claim', {
    p_state_hash: tokenHash(state),
    p_user_id: user.id,
    p_email_hash: emailHash(user.email),
  });
  if (error || typeof data !== 'string') return null;
  const { data: interview } = await admin.from('interviews').select('id,role_id,status')
    .eq('id', data).eq('user_id', user.id).maybeSingle();
  if (!interview || (interview.status !== 'in_progress' && interview.status !== 'completed')) return null;

  cookieStore.delete(ATTEMPT_COOKIE);
  cookieStore.delete(AUTH_STATE_COOKIE);
  return { id: interview.id, roleId: interview.role_id, status: interview.status };
}
