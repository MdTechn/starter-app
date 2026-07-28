type LoadingListener = (count: number) => void;

let count = 0;
const listeners = new Set<LoadingListener>();

function notify() {
  for (const listener of listeners) {
    listener(count);
  }
}

/** Increment global in-flight loading counter (navigation, API, …). */
export function beginGlobalLoading(): void {
  count += 1;
  notify();
}

/** Decrement global loading counter (never below 0). */
export function endGlobalLoading(): void {
  count = Math.max(0, count - 1);
  notify();
}

export function getGlobalLoadingCount(): number {
  return count;
}

export function subscribeGlobalLoading(listener: LoadingListener): () => void {
  listeners.add(listener);
  listener(count);
  return () => {
    listeners.delete(listener);
  };
}

/** Run an async task while the global overlay is active. */
export async function withGlobalLoading<T>(task: () => Promise<T>): Promise<T> {
  beginGlobalLoading();
  try {
    return await task();
  } finally {
    endGlobalLoading();
  }
}
