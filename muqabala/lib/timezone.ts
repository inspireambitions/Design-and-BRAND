function partsAt(value: Date, timeZone: string) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(value).map((part) => [part.type, part.value]));
  return {
    year: Number(values.year), month: Number(values.month), day: Number(values.day),
    hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second),
  };
}

export function formatZonedLocalDateTime(iso: string, timeZone: string) {
  const parts = partsAt(new Date(iso), timeZone);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** Converts a datetime-local wall-clock value in a named IANA zone to UTC. */
export function zonedLocalDateTimeToIso(value: string, timeZone: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format();
  } catch {
    return null;
  }
  const wanted = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), 0);
  let estimate = wanted;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shown = partsAt(new Date(estimate), timeZone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    estimate += wanted - shownAsUtc;
  }
  const verified = partsAt(new Date(estimate), timeZone);
  if (verified.year !== Number(match[1]) || verified.month !== Number(match[2]) || verified.day !== Number(match[3])
    || verified.hour !== Number(match[4]) || verified.minute !== Number(match[5])) return null;
  return new Date(estimate).toISOString();
}
