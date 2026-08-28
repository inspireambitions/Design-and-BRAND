import 'server-only';

import { cache } from 'react';
import { roleFromToken, verifyInterview } from '@/lib/interview-token';
import { createAdminClient } from '@/lib/supabase/admin';

const PUBLIC_CODE = /^[A-Za-z0-9_-]{6,16}$/;

export const getScreeningPack = cache(async (code: string) => {
  if (!PUBLIC_CODE.test(code)) return null;

  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from('screening_packs')
    .select('signed_token, workplace, expires_at')
    .eq('public_code', code)
    .not('employer_id', 'is', null)
    .maybeSingle();
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) return null;

  const payload = verifyInterview(data.signed_token);
  if (!payload || payload.kind !== 'proof' || payload.questions.length !== 3) return null;

  return {
    signedToken: data.signed_token,
    workplace: payload.workplace || data.workplace || '',
    recruiterName: payload.recruiterName,
    payload,
    role: roleFromToken(payload),
  };
});
