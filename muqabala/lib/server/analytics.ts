import 'server-only';
import type { EmployerVolumeEventName } from '@/lib/analytics';

type ServerProps = Partial<{
  role_id: string;
  channel: 'email' | 'whatsapp' | 'both';
  flag_state: 'on' | 'off';
  count: number;
  type: string;
}>;

/**
 * Server-side capture for events that happen in cron jobs and API routes. Uses
 * the same PostHog project as the browser. Fire and forget; a failure is never
 * surfaced to the request. Properties are ids and counts only.
 */
export function trackServer(event: EmployerVolumeEventName, props: ServerProps = {}): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com').replace(/\/$/, '');
  const body = JSON.stringify({
    api_key: key,
    event,
    distinct_id: `server:${props.role_id ?? 'muqabala'}`,
    properties: { ...props, device: 'server', $process_person_profile: false },
    timestamp: new Date().toISOString(),
  });
  fetch(`${host}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(3_000),
  }).catch(() => null);
}
