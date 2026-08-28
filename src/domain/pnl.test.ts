import { describe, expect, it } from "vitest";
import { fillCashflow, pnlCopy, pnlTotals, seriesPnl, seriesPnlCopy, sessionTape } from "./pnl";
import type { PositionPnl, WalletFill } from "../exchange/port";

const M = "0x" + "a1".repeat(32);

function fill(over: Partial<WalletFill> = {}): WalletFill {
  return {
    id: "1_2",
    asset: "BTC",
    intervalSec: 900,
    side: "up",
    direction: "buy",
    price: 0.6,
    quantity: 10,
    quote: 6,
    timestamp: 1000,
    txHash: "0xabc",
    ...over,
  };
}

function pos(over: Partial<PositionPnl> = {}): PositionPnl {
  return {
    marketId: M as `0x${string}`,
    asset: "BTC",
    intervalSec: 900,
    up: 10n * 10n ** 6n,
    down: 0n,
    costBasis: 6n * 10n ** 6n,
    avgCost: 600_000n,
    markValue: 7n * 10n ** 6n,
    unrealizedPnl: 1n * 10n ** 6n,
    realizedPnl: -500_000n,
    decimals: 6,
    ...over,
  };
}

describe("fillCashflow", () => {
  it("buys cost quote, sells return quote", () => {
    expect(fillCashflow(fill({ direction: "buy", quote: 6 }))).toBe(-6);
    expect(fillCashflow(fill({ direction: "sell", quote: 6 }))).toBe(6);
  });

  it("returns null when the side is unknown", () => {
    expect(fillCashflow(fill({ direction: null }))).toBeNull();
    expect(fillCashflow(fill({ side: null, direction: "buy" }))).toBeNull();
  });
});

describe("sessionTape", () => {
  it("sorts newest first and skips unattributable rows", () => {
    const rows = sessionTape([
      fill({ id: "old", timestamp: 900 }),
      fill({ id: "new", timestamp: 2000, side: null }),
      fill({ id: "mid", timestamp: 1000, direction: "sell", quote: 4 }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["mid", "old"]);
    expect(rows[0].cashflow).toBe(4);
  });

  it("caps the tape length", () => {
    const many = Array.from({ length: 12 }, (_, i) => fill({ id: `f${i}`, timestamp: i }));
    expect(sessionTape(many, 5)).toHaveLength(5);
    expect(sessionTape(many, 5)[0].id).toBe("f11");
  });
});

describe("pnlTotals", () => {
  it("sums realized and unrealized across positions in human units", () => {
    const t = pnlTotals([
      pos(),
      pos({ unrealizedPnl: 250_000n, realizedPnl: 0n, decimals: 6 }),
    ]);
    expect(t.realized).toBeCloseTo(-0.5);
    expect(t.unrealized).toBeCloseTo(1.25);
    expect(t.net).toBeCloseTo(0.75);
  });

  it("handles decimals mismatch between venues", () => {
    const t = pnlTotals([pos(), pos({ unrealizedPnl: 1n * 10n ** 18n, realizedPnl: 0n, decimals: 18 })]);
    expect(t.unrealized).toBeCloseTo(2);
  });

  it("sums signed tape cashflow into flow", () => {
    const t = pnlTotals([], [fill({ quote: 6, direction: "buy" }), fill({ quote: 4, direction: "sell" })]);
    expect(t.flow).toBe(-2);
  });
});

describe("pnlCopy", () => {
  it("formats signed totals with explicit positive/negative", () => {
    expect(pnlCopy({ realized: 1.5, unrealized: -0.25, net: 1.25, flow: -2 })).toBe(
      "P&L +1.50 unrealized −0.25 · net +1.25 tUSDC",
    );
    expect(pnlCopy({ realized: 0, unrealized: 0, net: 0, flow: 0 })).toBe("P&L 0.00 tUSDC");
  });
});

describe("seriesPnl", () => {
  it("keeps P&L for the selected series and drops other cadences", () => {
    const t = seriesPnl(
      [pos(), pos({ asset: "ETH", intervalSec: 900, unrealizedPnl: 9n * 10n ** 6n, realizedPnl: 0n })],
      [fill(), fill({ asset: "BTC", intervalSec: 3600, quote: 99, direction: "sell" })],
      "BTC",
      900,
    );
    expect(t.realized).toBeCloseTo(-0.5);
    expect(t.unrealized).toBeCloseTo(1);
    expect(t.flow).toBe(-6);
    expect(seriesPnlCopy(t, "BTC", 900)).toBe("BTC · 15m · P&L −0.50 unrealized +1.00 · net +0.50 tUSDC");
  });

  it("snaps indexer intervalSec onto the same series", () => {
    const t = seriesPnl([pos({ intervalSec: 3598 })], [], "BTC", 3600);
    expect(t.unrealized).toBeCloseTo(1);
  });
});
