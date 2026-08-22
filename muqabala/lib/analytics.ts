'use client';

import posthog from 'posthog-js';

/**
 * Anonymous usage analytics (PostHog EU), active only when
 * NEXT_PUBLIC_POSTHOG_KEY is configured.
 *
 * Hard boundary, enforced here and disclosed in the UI: events carry role ids,
 * language, scores and ratings — NEVER transcripts, typed job titles, video,
 * audio, names, or anything else a candidate said. Autocapture, pageviews and
 * session recording are all off; the only events that exist are the explicit
 * `track` calls below, so nothing can leak by accident.
 */

let ready = false;

export function initAnalytics(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || ready || typeof window === 'undefined') return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    persistence: 'localStorage',
    person_profiles: 'identified_only',
  });
  ready = true;
}

type EventName = 'interview_started' | 'interview_completed' | 'rating_submitted';

/** Allowed property keys, as a second line of defence against accidental leaks. */
type EventProps = Partial<{
  role_id: string;
  lang: string;
  input_mode: 'voice' | 'typing';
  overall_score: number;
  questions_answered: number;
  scoring_source: string;
  stars: number;
  confidence: string;
}>;

export function track(event: EventName, props: EventProps = {}): void {
  if (!ready) return;
  posthog.capture(event, props);
}
