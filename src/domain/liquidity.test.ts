import { describe, expect, it } from "vitest";
import type { BookDepth, DepthLevel } from "./book-depth";
import { fillEstimate, fillCopy } from "./liquidity";

const lv = (upPrice: number, contracts: number): DepthLevel => ({
  upPrice,
  downPrice: 1 - upPrice,
  contracts,
  cumContracts: contracts,
});

const depth = (asks: DepthLevel[], bids: DepthLevel[] = []): BookDepth => ({
  asks,
  bids,
  empty: asks.length === 0 && bids.length === 0,
});

describe("fillEstimate", () => {
  it("walks Up through asks cheapest-first and reports the average", () => {
    // 5 contracts @ 0.60 (3.0) + 10 @ 0.62 (6.2) → 9.2 tUSDC buys 15 contracts @ ~0.6133
    const est = fillEstimate(depth([lv(0.62, 10), lv(0.6, 5)]), "up", 9.2);
    expect(est).not.toBeNull();
    if (!est) return;
    expect(est.stake).toBeCloseTo(9.2, 5);
    expect(est.contracts).toBeCloseTo(15, 5);
    expect(est.avgOdds).toBeGreaterThan(0.61);
    expect(est.avgOdds).toBeLessThan(0.62);
    expect(est.unfilledStake).toBeCloseTo(0, 5);
  });

  it("walks Down through the best NO asks (highest YES bids first)", () => {
    // Down asks = 1 − YES bids: 0.40 then 0.38
    const est = fillEstimate(depth([], [lv(0.6, 5), lv(0.62, 10)]), "down", 10);
    expect(est).not.toBeNull();
    if (!est) return;
    expect(est.avgOdds).toBeGreaterThan(0.38);
    expect(est.avgOdds).toBeLessThan(0.4);
  });

  it("caps at walked depth and reports the unfilled remainder honestly", () => {
    const est = fillEstimate(depth([lv(0.6, 5)]), "up", 10);
    if (!est) return;
    expect(est.stake).toBeCloseTo(3, 5);
    expect(est.unfilledStake).toBeCloseTo(7, 5);
    expect(est.maxStake).toBeCloseTo(3, 5);
  });

  it("reports the max executable stake across the whole walked book", () => {
    const est = fillEstimate(depth([lv(0.6, 5), lv(0.62, 10)]), "up", 1);
    if (!est) return;
    expect(est.maxStake).toBeCloseTo(3 + 6.2, 5);
    expect(est.maxContracts).toBeCloseTo(15, 5);
  });

  it("returns null when there is nothing executable on that side", () => {
    expect(fillEstimate(depth([], [lv(0.6, 5)]), "up", 10)).toBeNull();
    expect(fillEstimate(depth([]), "down", 10)).toBeNull();
  });

  it("ignores zero-size levels", () => {
    const est = fillEstimate(depth([lv(0.6, 0), lv(0.61, 10)]), "up", 5);
    expect(est).not.toBeNull();
  });
});

describe("fillCopy", () => {
  it("states the estimate and the executable ceiling without promising a fill", () => {
    const copy = fillCopy({
      side: "up",
      stake: 9.4,
      contracts: 15.2,
      avgOdds: 0.61,
      unfilledStake: 0.6,
      maxStake: 9.4,
      maxContracts: 15.2,
    });
    expect(copy).toContain("est");
    expect(copy).toContain("~61%");
    expect(copy).toContain("9.4");
    expect(copy).not.toContain("guarantee");
  });

  it("names the unfilled remainder when the book is short", () => {
    const copy = fillCopy({
      side: "up",
      stake: 3,
      contracts: 5,
      avgOdds: 0.6,
      unfilledStake: 7,
      maxStake: 3,
      maxContracts: 5,
    });
    expect(copy).toContain("≈7.0 tUSDC may not fill");
  });
});
