import { describe, expect, it } from "vitest";
import { callability, windowPhase, windowPhaseCopy } from "./lifecycle";

describe("Lifecycle", () => {
  it("refuses a Window that is not Trading", () => {
    const r = callability({
      status: 2,
      nowSec: 1_000,
      expirySec: 2_000,
      intervalSec: 900,
    });
    expect(r.callable).toBe(false);
    expect(r.reason).toBe("not-trading");
  });

  it("refuses a Trading Window inside scaled expiry headroom", () => {
    const r = callability({
      status: 1,
      nowSec: 1_000,
      expirySec: 1_020,
      intervalSec: 900,
    });
    expect(r.callable).toBe(false);
    expect(r.reason).toBe("too-close");
  });

  it("allows a Trading Window with headroom left", () => {
    const r = callability({
      status: 1,
      nowSec: 1_000,
      expirySec: 1_900,
      intervalSec: 900,
    });
    expect(r.callable).toBe(true);
  });

  it("names Trading vs locking vs Locked for the board", () => {
    expect(
      windowPhase({ status: 1, nowSec: 1_000, expirySec: 1_900, intervalSec: 900 }),
    ).toEqual({ kind: "trading" });
    expect(
      windowPhase({ status: 1, nowSec: 1_950, expirySec: 2_000, intervalSec: 900 }),
    ).toEqual({ kind: "too-close" });
    expect(
      windowPhase({ status: 2, nowSec: 2_010, expirySec: 2_000, intervalSec: 900 }),
    ).toEqual({ kind: "locked" });
  });

  it("formats Window phase copy for the tote", () => {
    expect(windowPhaseCopy({ kind: "trading" })).toBe("Trading");
    expect(windowPhaseCopy({ kind: "too-close" })).toBe("Locking — new Calls closed");
    expect(windowPhaseCopy({ kind: "locked" })).toBe("Locked — waiting on the close");
  });

  it("does not use a fixed 300s headroom that would kill 5-minute Windows", () => {
    const r = callability({
      status: 1,
      nowSec: 0,
      expirySec: 280,
      intervalSec: 300,
    });
    expect(r.callable).toBe(true);
  });
});
