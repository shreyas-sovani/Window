import { describe, expect, it } from "vitest";
import { planRest, restLimit } from "./rest-quote";

describe("restLimit", () => {
  it("rests Up at the bid, not the ask", () => {
    expect(restLimit("up", { bid: 0.5, ask: 0.6 })).toBe(0.5);
  });

  it("rests Down at one minus the Up ask", () => {
    expect(restLimit("down", { bid: 0.5, ask: 0.6 })).toBeCloseTo(0.4);
  });

  it("refuses a crossed book that would take", () => {
    expect(restLimit("up", { bid: 0.6, ask: 0.5 })).toBeUndefined();
  });

  it("needs a bid to rest Up", () => {
    expect(restLimit("up", { ask: 0.6 })).toBeUndefined();
  });
});

describe("planRest", () => {
  it("sizes the Rest at the bid, not the take ask", () => {
    const plan = planRest({
      stake: 10,
      book: { bid: 0.5, ask: 0.6 },
      side: "up",
      decimals: 6,
      tick: 1000n,
      lot: 1000n,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.price).toBe(0.5);
    expect(plan.contracts).toBe(20);
    expect(plan.maxLoss).toBe(10);
  });
});
