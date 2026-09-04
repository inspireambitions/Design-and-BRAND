import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from './sentry-scrub';

const dsn = process.env.SENTRY_DSN;

if (dsn && !Sentry.isInitialized()) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    includeLocalVariables: false,
    beforeSend(event) {
      // Candidate text must not reach observability. Remove all request-scoped
      // material even if a future SDK integration adds it automatically.
      return scrubSentryEvent(event);
    },
  });
}

export function reportScoringFailure(details: {
  provider: 'openai' | 'openrouter' | 'anthropic';
  model: string;
  status: number;
  code: string;
}): void {
  if (!dsn) return;
  try {
    Sentry.withScope((scope) => {
      scope.setTags({
        route: '/api/score',
        provider: details.provider,
        model: details.model,
        provider_status: String(details.status),
        failure_code: details.code,
      });
      Sentry.captureMessage('scoring_provider_failure', 'error');
    });
  } catch {
    // Observability must never break candidate scoring or retry responses.
  }
}

type OperationalDetails = {
  area: 'screening' | 'upload' | 'evaluation' | 'cron' | 'server';
  code: string;
  route?: string;
  job?: string;
  status?: number;
  count?: number;
};

function safeOperationalPayload(event: string, level: 'info' | 'error', details: OperationalDetails) {
  const safe = (value: string | undefined) => value?.replace(/[^a-zA-Z0-9_./\[\]-]/g, '_').slice(0, 100);
  return {
    event: safe(event) || 'operational_event',
    level,
    area: details.area,
    code: safe(details.code) || 'unknown',
    ...(details.route ? { route: safe(details.route) } : {}),
    ...(details.job ? { job: safe(details.job) } : {}),
    ...(Number.isFinite(details.status) ? { status: details.status } : {}),
    ...(Number.isFinite(details.count) ? { count: details.count } : {}),
  };
}

export function reportOperationalEvent(event: string, details: OperationalDetails): void {
  console.info(JSON.stringify(safeOperationalPayload(event, 'info', details)));
}

export function reportOperationalFailure(event: string, details: OperationalDetails): void {
  const payload = safeOperationalPayload(event, 'error', details);
  console.error(JSON.stringify(payload));
  if (!dsn) return;
  try {
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(payload)) scope.setTag(key, String(value));
      Sentry.captureMessage(payload.event, 'error');
    });
  } catch {
    // Reporting must never interrupt an interview, upload or scheduled job.
  }
}
