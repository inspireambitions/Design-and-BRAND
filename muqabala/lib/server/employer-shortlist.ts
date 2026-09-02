import 'server-only';

/** Filled in by section 4. Kept as a no-op so the hourly cron compiles and runs now. */
export async function scheduleShortlistEmails(): Promise<{ queued: number }> {
  return { queued: 0 };
}
