import { describe, expect, it, vi } from "vitest";
import { withTimeoutMs } from "./timeout";

const never = <T>() => new Promise<T>(() => {});

describe("withTimeoutMs", () => {
  it("passes a value through when the read resolves in time", async () => {
    await expect(withTimeoutMs(Promise.resolve(7), 1_000, "read")).resolves.toBe(7);
  });

  it("propagates an early rejection with its own message", async () => {
    await expect(withTimeoutMs(Promise.reject(new Error("indexer 503")), 1_000, "read")).rejects.toThrow("indexer 503");
  });

  it("rejects a hung read after the deadline instead of pending forever", async () => {
    vi.useFakeTimers();
    const pending = withTimeoutMs(never<number>(), 5_000, "loadMarkets sweep");
    vi.advanceTimersByTime(5_001);
    await expect(pending).rejects.toThrow("loadMarkets sweep timed out");
    vi.useRealTimers();
  });

  it("does not reject after the value already landed", async () => {
    vi.useFakeTimers();
    const got = await withTimeoutMs(Promise.resolve(2), 5_000, "read");
    expect(got).toBe(2);
    vi.advanceTimersByTime(6_000);
    vi.useRealTimers();
  });
});
