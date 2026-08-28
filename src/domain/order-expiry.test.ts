import { describe, expect, it } from "vitest";
import { expireTimestampNs } from "./order-expiry";

describe("order expiry", () => {
  it("encodes unix seconds as nanoseconds and respects the Window expiry cap", () => {
    expect(expireTimestampNs(1_000, 300, 1_200)).toBe(1_200n * 1_000_000_000n);
    expect(expireTimestampNs(1_000, 300, 10_000)).toBe(1_300n * 1_000_000_000n);
  });
});
