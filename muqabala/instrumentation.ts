import type { Instrumentation } from 'next';
import { reportOperationalFailure } from '@/lib/sentry-server';

export function register() {}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const code = error instanceof Error ? error.name : 'unknown_error';
  reportOperationalFailure('next_request_error', {
    area: 'server',
    code,
    route: context.routePath,
    status: request.method === 'GET' ? 500 : 503,
  });
};
