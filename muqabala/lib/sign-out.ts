/** Local storage failure must never prevent an attempt to end the session. */
export async function signOutWithLocalCleanup(operations: {
  clearLocal: () => Promise<void>;
  endSession: () => Promise<boolean>;
}) {
  const [local, session] = await Promise.allSettled([
    Promise.resolve().then(operations.clearLocal),
    Promise.resolve().then(operations.endSession),
  ]);
  return {
    purgeFailed: local.status === 'rejected',
    signedOut: session.status === 'fulfilled' && session.value,
  };
}
