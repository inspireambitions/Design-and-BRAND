import 'server-only';

import { cache } from 'react';
import { roleFromToken, verifyInterview } from '@/lib/interview-token';
import { createAdminClient } from '@/lib/supabase/admin';

const PUBLIC_CODE = /^[A-Za-z0-9_-]{6,16}$/;

export const getScreeningPack = cache(async (code: string) => {
  if (!PUBLIC_CODE.test(code)) return { status: 'unavailable' as const };

  const admin = createAdminClient();
  if (!admin) return { status: 'unavailable' as const };
  const { data } = await admin
    .from('screening_packs')
    .select('id, signed_token, workplace, expires_at, max_candidates, starts_used')
    .eq('public_code', code)
    .not('employer_id', 'is', null)
    .maybeSingle();
  if (!data) return { status: 'unavailable' as const };
  if (new Date(data.expires_at).getTime() <= Date.now()) return { status: 'expired' as const };

  const payload = verifyInterview(data.signed_token);
  if (!payload || payload.kind !== 'proof' || (payload.questions.length !== 3 && payload.questions.length !== 8)) {
    return { status: 'unavailable' as const };
  }

  return {
    status: data.starts_used >= data.max_candidates ? 'full' as const : 'active' as const,
    id: data.id as string,
    signedToken: data.signed_token,
    workplace: payload.workplace || data.workplace || '',
    recruiterName: payload.recruiterName,
    payload,
    role: roleFromToken(payload),
  };
});

