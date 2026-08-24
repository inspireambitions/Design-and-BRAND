import 'server-only';

import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';
import { ATTEMPT_COOKIE, tokenHash } from './security';
import type { StoredInterview } from '@/lib/interviews';

export async function interviewAccess(id: string) {
  const admin = createAdminClient();
  if (!admin) return { configured: false as const, admin: null, interview: null, user: null, anonymous: false };

  const [{ data, error }, user, cookieStore] = await Promise.all([
    admin.from('interviews').select('*').eq('id', id).maybeSingle(),
    currentUser(),
    cookies(),
  ]);
  const interview = error ? null : (data as StoredInterview | null);
  const activeInterview = interview && (interview.saved || Date.parse(interview.expires_at) > Date.now())
    ? interview
    : null;
  const raw = cookieStore.get(ATTEMPT_COOKIE)?.value;
  const anonymous = Boolean(
    activeInterview && raw && activeInterview.user_id === null && activeInterview.anonymous_token_hash === tokenHash(raw),
  );
  const owner = Boolean(activeInterview && user && activeInterview.user_id === user.id);
  return { configured: true as const, admin, interview: activeInterview, user, anonymous, owner };
}
