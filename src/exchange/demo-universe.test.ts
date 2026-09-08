import { describe, expect, it } from "vitest";
import {
  DEMO_EPOCH_SEC,
  DEMO_WINDOW_SEC,
  demoBookFor,
  demoHistoryFor,
  demoResultFor,
  demoWindowAt,
} from "./demo-universe";

describe("demo universe", () => {
  it("derives the same Window for the same moment on every browser", () => {
    const at = DEMO_EPOCH_SEC + DEMO_WINDOW_SEC * 7 + 30;
    const a = demoWindowAt("BTC", 300, at);
    const b = demoWindowAt("BTC", 300, at);
    expect(a).toEqual(b);
    expect(a.marketId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a.asset).toBe("BTC");
    expect(a.intervalSec).toBe(300);
    expect(a.status).toBe(1);
    expect(a.openingPrice).toMatch(/^\d[\d,]*\.\d{2}$/);
    expect(a.expiry).toBe(DEMO_EPOCH_SEC + DEMO_WINDOW_SEC * 8);
  });

  it("rolls to a successor with a different marketId each window", () => {
    const first = demoWindowAt("ETH", 300, DEMO_EPOCH_SEC + 10);
    const next = demoWindowAt("ETH", 300, DEMO_EPOCH_SEC + DEMO_WINDOW_SEC + 10);
    expect(next.marketId).not.toBe(first.marketId);
    expect(next.pool).not.toBe(first.pool);
  });

  it("every window has a deep, two-sided, tradable book", () => {
    for (let i = 0; i < 8; i += 1) {
      const w = demoWindowAt("BTC", 300, DEMO_EPOCH_SEC + DEMO_WINDOW_SEC * i + 5);
      const book = demoBookFor(w);
      expect(book.bid).toBeGreaterThan(0.35);
      expect(book.ask).toBeLessThan(0.65);
      expect(book.ask!).toBeGreaterThan(book.bid!);
      expect(book.ask! - book.bid!).toBeLessThan(0.06);
    }
  });

  it("settles deterministically from the marketId — same verdict on every browser", () => {
    const w = demoWindowAt("BTC", 300, DEMO_EPOCH_SEC + 3);
    expect(["up", "down"]).toContain(demoResultFor(w.marketId));
    expect(demoResultFor(w.marketId)).toBe(demoResultFor(w.marketId.toUpperCase()));
  });

  it("history lists the finalized windows before a moment, newest first, with results", () => {
    const at = DEMO_EPOCH_SEC + DEMO_WINDOW_SEC * 5;
    const rows = demoHistoryFor("BTC", 300, at);
    expect(rows.length).toBeGreaterThanOrEqual(4);
    for (const r of rows) {
      expect(["up", "down"]).toContain(r.result);
      expect(r.expiry).toBeLessThanOrEqual(at - DEMO_WINDOW_SEC * 0 + 1);
      expect(r.oracleQuestionId).toBeTruthy();
    }
    expect(rows[0].expiry).toBeGreaterThanOrEqual(rows[rows.length - 1].expiry);
  });
});
