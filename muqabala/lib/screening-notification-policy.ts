export function screeningNotificationIdempotencyKey(jobId: string): string {
  return `screening_submission_${jobId}`;
}

export function notificationRetry(status: number | null, attempt: number) {
  const permanent = status !== null && status >= 400 && status < 500 && status !== 429;
  const delayMs = Math.min(6 * 60 * 60_000, 30_000 * (2 ** Math.max(0, attempt - 1)));
  return { permanent, delayMs };
}
