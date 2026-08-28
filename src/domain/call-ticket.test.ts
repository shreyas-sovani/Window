import { describe, expect, it } from "vitest";
import { planCall } from "./call-ticket";

describe("CallTicket", () => {
  it("turns a 60 stake at 0.60 Up into 100 contracts, max loss 60, win 100", () => {
    const plan = planCall({
      stake: 60,
      upPrice: 0.6,
      side: "up",
      decimals: 6,
      tick: 1000n,
      lot: 1000n,
    });
    expect(plan.kind).toBe("take");
    if (plan.kind !== "take") return;
    expect(plan.contracts).toBe(100);
    expect(plan.maxLoss).toBe(60);
    expect(plan.payoutIfWin).toBe(100);
  });

  it("prices a Down Call as 1 minus Up", () => {
    const plan = planCall({
      stake: 40,
      upPrice: 0.6,
      side: "down",
      decimals: 6,
      tick: 1000n,
      lot: 1000n,
    });
    expect(plan.kind).toBe("take");
    if (plan.kind !== "take") return;
    expect(plan.contracts).toBe(100);
    expect(plan.maxLoss).toBe(40);
  });

  it("skips when stake cannot buy one lot", () => {
    const plan = planCall({
      stake: 0.0004,
      upPrice: 0.5,
      side: "up",
      decimals: 18,
      tick: 10n ** 15n,
      lot: 10n ** 15n,
    });
    expect(plan).toEqual({ kind: "skip", reason: "below-lot" });
  });
});
