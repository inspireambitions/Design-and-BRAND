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
