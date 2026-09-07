type BatchResult = { configured: boolean; claimed: number; accepted: number; failed: number };

/** Drain a pilot-sized backlog without enlarging the database's five-job lease. */
export async function drainScreeningNotifications(
  processBatch: () => Promise<BatchResult>,
  now: () => number = Date.now,
) {
  const result = { configured: true, claimed: 0, accepted: 0, failed: 0, stopped: 'capacity' };
  const startedAt = now();
  // A final five-job batch can take 35 seconds at the seven-second provider timeout.
  // Stop starting batches at 20 seconds to leave headroom in the 60-second route.
  for (let batch = 0; batch < 12; batch += 1) {
    if (now() - startedAt >= 20_000) return { ...result, stopped: 'time_budget' };
    const next = await processBatch();
    result.configured = next.configured;
    result.claimed += next.claimed;
    result.accepted += next.accepted;
    result.failed += next.failed;
    if (!next.configured || next.failed) return { ...result, stopped: 'failure' };
    if (next.claimed < 5) return { ...result, stopped: 'drained' };
  }
  return result;
}
