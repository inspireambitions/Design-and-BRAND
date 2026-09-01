'use client';

import type { PostHog } from 'posthog-js';

/**
 * Anonymous usage analytics (PostHog EU), active only when
 * NEXT_PUBLIC_POSTHOG_KEY is configured.
 *
 * Hard boundary, enforced here and disclosed in the UI: events carry role ids,
 * language, scores, ratings and timings, NEVER transcripts, typed job titles,
 * video, audio, names, or anything else a candidate said. Autocapture,
 * pageviews and session recording are all off; the only events that exist are
 * the explicit `track` calls below, so nothing can leak by accident.
 */

/**
 * The PostHog client is loaded on demand, not bundled with the page. It is
 * around 80 KB gzipped, which is more than the rest of the practice page, and
 * nothing on screen depends on it. `posthog` stays null until `initAnalytics`
 * has loaded and initialised it.
 */
let posthog: PostHog | null = null;
let loading: Promise<void> | null = null;

/**
 * Timings and Web Vitals often fire before PostHog has loaded. They are held
 * here and flushed on init so early page loads are not missing from p75.
 */
const pending: Array<{ event: EventName; props: EventProps }> = [];
const MAX_PENDING = 32;

export function initAnalytics(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || posthog || loading || typeof window === 'undefined') return;
  loading = import('posthog-js')
    .then(({ default: client }) => {
      client.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        persistence: 'localStorage',
        person_profiles: 'identified_only',
      });
      posthog = client;
      for (const item of pending.splice(0)) client.capture(item.event, item.props);
    })
    .catch(() => {
      // Blocked by an ad blocker or offline: analytics are optional, so the
      // queued events are simply dropped and the page carries on.
      loading = null;
      pending.length = 0;
    });
}

type EventName =
  | 'interview_started'
  | 'interview_completed'
  | 'rating_submitted'
  | 'web_vital'
  | PracticeFlowEventName
  | TimingEventName;

/** Practice flow milestones. Properties are role_id, mode and lang only. */
export type PracticeFlowEventName =
  | 'practice_started'
  | 'mode_selected'
  | 'first_answer_completed'
  | 'feedback_viewed'
  | 'retry_started'
  | 'comparison_viewed';

/** Performance timings, one event per measurement, all in milliseconds. */
export type TimingEventName =
  | 'feedback_first_token_ms'
  | 'feedback_complete_ms'
  | 'advert_to_first_question_ms'
  | 'report_load_ms'
  | 'transcript_ready_ms';

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';

/** Allowed property keys, as a second line of defence against accidental leaks. */
type EventProps = Partial<{
  role_id: string;
  lang: string;
  overall_score: number;
  questions_answered: number;
  scoring_source: string;
  stars: number;
  confidence: string;
  /** Timing value in milliseconds, rounded. */
  duration_ms: number;
  /** Web Vital name: LCP, INP, CLS, FCP, TTFB. */
  metric: string;
  value: number;
  rating: string;
  device_class: DeviceClass;
  /** Route pattern only, never a private link identifier. */
  path: string;
  streamed: boolean;
  outcome: string;
  /** How the candidate answered: type, speak or video. Never the words. */
  mode: 'type' | 'speak' | 'video';
}>;

export function track(event: EventName, props: EventProps = {}): void {
  if (!posthog) {
    if (pending.length < MAX_PENDING) pending.push({ event, props });
    return;
  }
  posthog.capture(event, props);
}

export function deviceClass(): DeviceClass {
  if (typeof navigator === 'undefined') return 'desktop';
  const data = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  const agent = navigator.userAgent || '';
  if (/iPad|Tablet|PlayBook|Silk/i.test(agent) || (/Android/i.test(agent) && !/Mobile/i.test(agent))) {
    return 'tablet';
  }
  if (data?.mobile || /Mobi|Android|iPhone|iPod/i.test(agent)) return 'mobile';
  return 'desktop';
}

/** Records one timing. Negative or absurd values are dropped rather than sent. */
export function trackTiming(
  event: TimingEventName,
  durationMs: number,
  props: Omit<EventProps, 'duration_ms' | 'device_class'> = {},
): void {
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 600_000) return;
  track(event, { ...props, duration_ms: Math.round(durationMs), device_class: deviceClass() });
}
