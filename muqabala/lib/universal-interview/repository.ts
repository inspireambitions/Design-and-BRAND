import 'server-only';

import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';
import { newOpaqueToken, tokenHash } from '@/lib/server/security';
import { openInterviewState, sealInterviewState } from './crypto';
import type { InterviewState } from './types';

export const UNIVERSAL_INTERVIEW_COOKIE = 'muqabala_brain_v2';

type StoredRow = {
  id: string;
  owner_token_hash: string;
  state_ciphertext: string;
  status: 'ACTIVE' | 'COMPLETE';
};

function parseCookie(value: string | undefined): { id: string; token: string } | null {
  if (!value) return null;
  const separator = value.indexOf('.');
  if (separator < 1) return null;
  const id = value.slice(0, separator);
  const token = value.slice(separator + 1);
  if (!/^[a-f0-9-]{36}$/i.test(id) || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  return { id, token };
}

export async function createStoredInterview(state: InterviewState): Promise<void> {
  const admin = createAdminClient();
  if (!admin) throw new Error('universal_interview_storage_not_configured');
  const rawToken = newOpaqueToken();
  const { error } = await admin.from('universal_interviews').insert({
    id: state.interview_id,
    owner_token_hash: tokenHash(rawToken),
    state_ciphertext: sealInterviewState(state),
    status: state.status,
  });
  if (error) throw new Error(`universal_interview_create_failed:${error.code}`);

  const user = await currentUser();
  if (user) {
    const { error: linkError } = await admin.from('universal_interview_accounts').insert({
      interview_id: state.interview_id,
      user_id: user.id,
    });
    if (linkError) {
      await admin.from('universal_interviews').delete().eq('id', state.interview_id);
      throw new Error(`universal_interview_link_failed:${linkError.code}`);
    }
  }

  const store = await cookies();
  store.set(UNIVERSAL_INTERVIEW_COOKIE, `${state.interview_id}.${rawToken}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Removes a just-created state when the matching employer interview could not start. */
export async function discardStoredInterview(interviewId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from('universal_interviews').delete().eq('id', interviewId);
}

export async function loadStoredInterview(interviewId: string): Promise<InterviewState | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from('universal_interviews')
    .select('id, owner_token_hash, state_ciphertext, status')
    .eq('id', interviewId)
    .maybeSingle<StoredRow>();
  if (!data) return null;

  let authorised = false;
  const store = await cookies();
  const owned = parseCookie(store.get(UNIVERSAL_INTERVIEW_COOKIE)?.value);
  if (owned?.id === interviewId && tokenHash(owned.token) === data.owner_token_hash) authorised = true;

  if (!authorised) {
    const user = await currentUser();
    if (user) {
      const { data: link } = await admin
        .from('universal_interview_accounts')
        .select('interview_id')
        .eq('interview_id', interviewId)
        .eq('user_id', user.id)
        .maybeSingle();
      authorised = Boolean(link);
    }
  }
  return authorised ? openInterviewState(data.state_ciphertext) : null;
}

export async function releaseInterviewClaim(interviewId: string, claim: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from('universal_interviews').update({
    processing_token_hash: null,
    processing_until: null,
  })
    .eq('id', interviewId)
    .eq('processing_token_hash', tokenHash(claim));
}

export async function claimStoredInterview(state: InterviewState): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const claim = newOpaqueToken();
  const now = new Date();
  const until = new Date(now.getTime() + 45_000);
  const { data, error } = await admin
    .from('universal_interviews')
    .update({ processing_token_hash: tokenHash(claim), processing_until: until.toISOString() })
    .eq('id', state.interview_id)
    .or(`processing_until.is.null,processing_until.lt.${now.toISOString()}`)
    .select('id')
    .maybeSingle();
  return error || !data ? null : claim;
}

export async function saveClaimedInterview(state: InterviewState, claim: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) throw new Error('universal_interview_storage_not_configured');
  const { data, error } = await admin.from('universal_interviews').update({
    state_ciphertext: sealInterviewState(state),
    status: state.status,
    updated_at: new Date().toISOString(),
    completed_at: state.status === 'COMPLETE' ? new Date().toISOString() : null,
    processing_token_hash: null,
    processing_until: null,
  })
    .eq('id', state.interview_id)
    .eq('processing_token_hash', tokenHash(claim))
    .select('id')
    .maybeSingle();
  if (error || !data) throw new Error('universal_interview_claim_lost');

  const decision = state.decision_log.at(-1);
  if (decision) {
    await admin.from('universal_decision_logs').upsert({
      interview_id: decision.interview_id,
      turn: decision.turn,
      prompt_version: decision.prompt_version,
      precheck: decision.precheck,
      t1_action: decision.t1_action,
      code_action: decision.code_action,
      override_reason: decision.override_reason,
      dedupe_hit: decision.dedupe_hit,
      probe_count: decision.probe_count,
      model_calls: decision.model_calls,
      latency_ms: decision.latency_ms,
      schema_retry: decision.schema_retry,
      fallback_used: decision.fallback_used,
      sufficient_competencies: decision.sufficient_competencies,
      stripped_patterns: decision.stripped_patterns,
    }, { onConflict: 'interview_id,turn' });
  }
}

export async function recordStageMetric(input: {
  interviewId: string;
  stage: 'P1' | 'P2' | 'TURN' | 'F1' | 'RETRY';
  promptVersion: string;
  modelCalls: number;
  schemaRetry: boolean;
  fallbackUsed: boolean;
  latencyMs: number;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from('universal_stage_logs').insert({
    interview_id: input.interviewId,
    stage: input.stage,
    prompt_version: input.promptVersion,
    model_calls: input.modelCalls,
    schema_retry: input.schemaRetry,
    fallback_used: input.fallbackUsed,
    latency_ms: input.latencyMs,
  });
}

export async function deleteStoredInterview(interviewId: string): Promise<boolean> {
  const state = await loadStoredInterview(interviewId);
  if (!state) return false;
  const admin = createAdminClient();
  if (!admin) return false;
  const { error } = await admin.from('universal_interviews').delete().eq('id', interviewId);
  if (!error) {
    const store = await cookies();
    store.delete(UNIVERSAL_INTERVIEW_COOKIE);
  }
  return !error;
}
