type ScrubbableEvent = {
  request?: unknown;
  user?: unknown;
  breadcrumbs?: unknown;
  contexts?: unknown;
  extra?: unknown;
};

/** Remove every request-scoped field that could contain candidate data. */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  event.request = undefined;
  event.user = undefined;
  event.breadcrumbs = undefined;
  event.contexts = undefined;
  event.extra = undefined;
  return event;
}
