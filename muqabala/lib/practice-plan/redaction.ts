const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const TOKEN = /\b[A-Za-z0-9_-]{32,}(?:\.[A-Za-z0-9_-]{32,})?\b/g;
const SAFE_FIELD_NAMES = new Set(['error', 'code', 'attempt', 'state', 'count']);

export function redactText(value: unknown): string {
  const text = value instanceof Error ? value.name : String(value ?? 'unknown');
  return text.replace(EMAIL, '[email]').replace(TOKEN, '[token]').slice(0, 160);
}

export function safeEvent(name: string, fields: Record<string, string | number | boolean | null> = {}) {
  const allowed = Object.fromEntries(
    Object.entries(fields)
      .filter(([key]) => SAFE_FIELD_NAMES.has(key))
      .map(([key, value]) => [key, typeof value === 'string' ? redactText(value) : value]),
  );
  return { event: name, ...allowed };
}
