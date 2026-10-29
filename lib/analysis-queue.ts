/** One in-flight cloud analysis per tab; queue spacing protects small free-tier quotas. */
let active = false;
let nextAllowed = 0;
export async function queuedAnalysis<T>(
  task: () => Promise<T>,
  minimumInterval = 20000,
): Promise<T> {
  if (active)
    throw new Error(
      "Another camera analysis is running. Wait for it to finish.",
    );
  const remaining = nextAllowed - Date.now();
  if (remaining > 0)
    throw new Error(
      `Analysis cooldown: try again in ${Math.ceil(remaining / 1000)} seconds.`,
    );
  active = true;
  nextAllowed = Date.now() + minimumInterval;
  try {
    return await task();
  } catch (error) {
    if ((error as any)?.status === 429) nextAllowed = Date.now() + 60000;
    throw error;
  } finally {
    active = false;
  }
}
