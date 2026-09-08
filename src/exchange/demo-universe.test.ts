import { describe, expect, it } from "vitest";
import { fillEstimate } from "../domain/liquidity";
import { headroomSec } from "../domain/lifecycle";
import { marketHealth } from "../domain/market-health";
import { cadenceLabel } from "../domain/series";
import {
  DEMO_EPOCH_SEC,
  DEMO_WINDOW_SEC,
  demoBookFor,
  demoDepthFor,
  demoHistoryFor,
  demoPriceFor,
  demoResultFor,
  demoTapeFor,
  demoWindowAt,
  demoWindowSec,
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
    expect(a.expiry).toBe(DEMO_EPOCH_SEC + demoWindowSec(300) * 8);
  });

  it("rolls to a successor with a different marketId each window", () => {
    const first = demoWindowAt("ETH", 300, DEMO_EPOCH_SEC + 10);
    const next = demoWindowAt("ETH", 300, DEMO_EPOCH_SEC + demoWindowSec(300) + 10);
    expect(next.marketId).not.toBe(first.marketId);
    expect(next.pool).not.toBe(first.pool);
  });

  it("gives every cadence of one asset its own pool — two tapes never merge", () => {
    const at = DEMO_EPOCH_SEC + 3_600;
    const pools = [300, 900, 3600, 14400, 86400].map((c) => demoWindowAt("BTC", c, at).pool);
    expect(new Set(pools).size).toBe(pools.length);
  });

  it("every window has a deep, two-sided, tradable book", () => {
    for (let i = 0; i < 8; i += 1) {
      const w = demoWindowAt("BTC", 300, DEMO_EPOCH_SEC + demoWindowSec(300) * i + 5);
      const book = demoBookFor(w);
      expect(book.bid).toBeGreaterThan(0.35);
      expect(book.ask).toBeLessThan(0.65);
      expect(book.ask!).toBeGreaterThan(book.bid!);
      expect(book.ask! - book.bid!).toBeLessThan(0.06);
    }
  });

  it("stays callable for most of a compressed Window on every cadence", () => {
    for (const cadence of [300, 900, 3600, 14400, 86400]) {
      const span = demoWindowSec(cadence);
      // Calls close one headroom slice before expiry, so at least two thirds of
      // a demo Window is tradable — and a minted invite outlives its sharing.
      expect(span - headroomSec(cadence)).toBeGreaterThanOrEqual(span * (2 / 3));
      expect(span).toBeLessThanOrEqual(420);
    }
  });

  it("walks its own ladder deep enough to grade Strong and absorb a big Call", () => {
    const w = demoWindowAt("BTC", 900, DEMO_EPOCH_SEC + 900);
    const depth = demoDepthFor(w);
    expect(depth.empty).toBe(false);
    expect(depth.asks.length).toBeGreaterThanOrEqual(5);
    expect(depth.bids.length).toBeGreaterThanOrEqual(5);
    for (const side of ["up", "down"] as const) {
      const est = fillEstimate(depth, side, 500);
      expect(est).not.toBeNull();
      // 500 tUSDC fills whole, and the ladder holds far more behind it.
      expect(est!.unfilledStake).toBe(0);
      expect(est!.maxStake).toBeGreaterThan(1_000);
      expect(est!.avgOdds).toBeGreaterThan(0);
      expect(est!.avgOdds).toBeLessThan(1);
    }
    const health = marketHealth({
      book: demoBookFor(w),
      depth,
      expirySec: w.expiry,
      intervalSec: w.intervalSec,
      nowSec: w.expiry - demoWindowSec(900),
    });
    expect(health.grade).toBe("strong");
    expect(health.executableStake).toBeGreaterThan(1_000);
  });

  it("a bigger Call pays a worse average than a small one — depth is finite", () => {
    const depth = demoDepthFor(demoWindowAt("ETH", 900, DEMO_EPOCH_SEC + 900));
    const small = fillEstimate(depth, "up", 25)!;
    const large = fillEstimate(depth, "up", 900)!;
    expect(large.avgOdds).toBeGreaterThan(small.avgOdds);
  });

  it("settles deterministically from the marketId — same verdict on every browser", () => {
    const w = demoWindowAt("BTC", 300, DEMO_EPOCH_SEC + 3);
    expect(["up", "down"]).toContain(demoResultFor(w.marketId));
    expect(demoResultFor(w.marketId)).toBe(demoResultFor(w.marketId.toUpperCase()));
  });

  it("puts anonymous market colour on the tape, never past the moment asked for", () => {
    const w = demoWindowAt("BTC", 900, DEMO_EPOCH_SEC + 900);
    const start = w.expiry - demoWindowSec(900);
    const early = demoTapeFor(w.marketId, w.expiry, w.intervalSec, start + 30);
    const whole = demoTapeFor(w.marketId, w.expiry, w.intervalSec, w.expiry);
    expect(early.length).toBeGreaterThan(0);
    expect(whole.length).toBeGreaterThan(early.length);
    for (const row of whole) {
      expect(row.ts).toBeLessThanOrEqual(w.expiry);
      expect(row.marketId).toBe(w.marketId);
      // Colour is never a duel leg: no named wallet, so no proof and no claim.
      expect(row.taker).toBeNull();
      expect(row.quantity).toBeGreaterThan(0);
      expect(row.quote).toBeGreaterThan(0);
    }
    expect(new Set(whole.map((r) => r.txHash)).size).toBe(whole.length);
  });

  it("prints a moving underlying price for the Pulse spark", () => {
    const a = demoPriceFor("BTC", DEMO_EPOCH_SEC);
    const b = demoPriceFor("BTC", DEMO_EPOCH_SEC + 45);
    expect(a.asset).toBe("BTC");
    expect(a.price).toBeGreaterThan(0);
    expect(b.price).not.toBe(a.price);
    expect(demoPriceFor("BTC", DEMO_EPOCH_SEC).price).toBe(a.price);
  });

  it("history lists the finalized windows before a moment, newest first, with results", () => {
    const at = DEMO_EPOCH_SEC + demoWindowSec(300) * 5;
    const rows = demoHistoryFor("BTC", 300, at);
    expect(rows.length).toBeGreaterThanOrEqual(4);
    for (const r of rows) {
      expect(["up", "down"]).toContain(r.result);
      expect(r.expiry).toBeLessThanOrEqual(at + 1);
      expect(r.oracleQuestionId).toBeTruthy();
    }
    expect(rows[0].expiry).toBeGreaterThanOrEqual(rows[rows.length - 1].expiry);
  });
});

describe("demo universe cadence coverage", () => {
  it("serves every selectable cadence — no chip is ever waiting", () => {
    const at = DEMO_EPOCH_SEC + DEMO_WINDOW_SEC * 9 + 20;
    for (const c of [300, 900, 3600, 14400, 86400]) {
      const w = demoWindowAt("BTC", c, at);
      expect(w.intervalSec).toBe(c);
      expect(w.status).toBe(1);
      expect(w.symbol).toBe(`BTC-${cadenceLabel(c)}`);
    }
  });
});
