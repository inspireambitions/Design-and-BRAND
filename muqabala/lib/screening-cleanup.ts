type CleanupResult = { error: { code?: string; name?: string } | null };

/** Keep the deletion order explicit: never discard the last Storage references. */
export async function deleteExpiredScreeningInterview(operations: {
  readPaths: () => PromiseLike<CleanupResult & { data: { video_path: string | null }[] | null }>;
  removeVideos: (paths: string[]) => PromiseLike<CleanupResult>;
  removeInterview: () => PromiseLike<CleanupResult>;
}): Promise<{ deleted: boolean; code?: string }> {
  const answers = await operations.readPaths();
  if (answers.error || answers.data === null) {
    return { deleted: false, code: answers.error?.code || 'answer_lookup_failed' };
  }
  const paths = answers.data.map((answer) => answer.video_path).filter((path): path is string => Boolean(path));
  if (paths.length) {
    const result = await operations.removeVideos(paths);
    if (result.error) return { deleted: false, code: result.error.name || 'storage_delete_failed' };
  }
  const result = await operations.removeInterview();
  if (result.error) return { deleted: false, code: result.error.code || 'interview_delete_failed' };
  return { deleted: true };
}
