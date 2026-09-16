import 'server-only';

import { cache } from 'react';
import { roleFromToken, verifyStoredInterview } from '@/lib/interview-token';
import { createAdminClient } from '@/lib/supabase/admin';

const PUBLIC_CODE = /^[A-Za-z0-9_-]{6,16}$/;

export const getScreeningPack = cache(async (code: string) => {
  if (!PUBLIC_CODE.test(code)) return { status: 'unavailable' as const };

  const admin = createAdminClient();
  if (!admin) return { status: 'unavailable' as const };
  const columns = 'id, signed_token, workplace, expires_at, max_candidates, starts_used, location, timezone, published_facts, question_source, questionnaire_language';
  const openedAt = new Date().toISOString();

  // Freeze the signed questions before returning them. This conditional update
  // races safely with the conditional AI enhancement update: one wins the row
  // lock, and every candidate then receives that same immutable token.
  const opened = await admin
    .from('screening_packs')
    .update({ first_opened_at: openedAt })
    .eq('public_code', code)
    .is('first_opened_at', null)
    .not('employer_id', 'is', null)
    .select(columns)
    .maybeSingle();
  if (opened.error) return { status: 'unavailable' as const };

  let data = opened.data;
  if (!data) {
    const existing = await admin
      .from('screening_packs')
      .select(columns)
      .eq('public_code', code)
      .not('employer_id', 'is', null)
      .maybeSingle();
    if (existing.error) return { status: 'unavailable' as const };
    data = existing.data;
  }
  if (!data) return { status: 'unavailable' as const };
  if (new Date(data.expires_at).getTime() <= Date.now()) return { status: 'expired' as const };

  const payload = verifyStoredInterview(data.signed_token);
  if (!payload || payload.kind !== 'proof' || payload.questions.length < 3 || payload.questions.length > 8) {
    return { status: 'unavailable' as const };
  }

  return {
    status: data.starts_used >= data.max_candidates ? 'full' as const : 'active' as const,
    id: data.id as string,
    signedToken: data.signed_token,
    workplace: payload.workplace || data.workplace || '',
    recruiterName: payload.recruiterName,
    location: typeof data.location === 'string' ? data.location : null,
    timezone: typeof data.timezone === 'string' ? data.timezone : 'Asia/Dubai',
    publishedFacts: data.published_facts && typeof data.published_facts === 'object' ? data.published_facts : {},
    questionSource: typeof data.question_source === 'string' ? data.question_source : 'legacy',
    questionnaireLanguage: data.questionnaire_language === 'en' ? 'en' as const : 'both' as const,
    expiresAt: data.expires_at as string,
    payload,
    role: roleFromToken(payload),
  };
});

