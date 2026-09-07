/**
 * Race an indexer read against a deadline. A hung HTTP request is a pending
 * promise no try/catch can save — the board would read "loading" forever while
 * the live tail still flows. On timeout the read rejects with `"<label> timed
 * out"`, which the existing catch paths turn into their honest degraded states
 * (defaults, blank Line, board Retry) instead of a permanent spinner.
 */
export function withTimeoutMs<T>(read: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    read.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}
