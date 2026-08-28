import { describe, expect, it } from "vitest";
import { planClaims } from "./claim-plan";

describe("ClaimPlan", () => {
  it("redeems only the winning side after resolve", () => {
    expect(
      planClaims({
        isResolved: true,
        isVoided: false,
        winningOutcome: 0,
        up: 10n,
        down: 7n,
      }),
    ).toEqual([{ outcomeIdx: 0, amount: 10n }]);
  });

  it("skips a zero winning balance", () => {
    expect(
      planClaims({
        isResolved: true,
        isVoided: false,
        winningOutcome: 1,
        up: 10n,
        down: 0n,
      }),
    ).toEqual([]);
  });

  it("redeems both sides on a void", () => {
    expect(
      planClaims({
        isResolved: false,
        isVoided: true,
        winningOutcome: null,
        up: 3n,
        down: 5n,
      }),
    ).toEqual([
      { outcomeIdx: 0, amount: 3n },
      { outcomeIdx: 1, amount: 5n },
    ]);
  });

  it("does nothing while the Window is still live", () => {
    expect(
      planClaims({
        isResolved: false,
        isVoided: false,
        winningOutcome: null,
        up: 1n,
        down: 1n,
      }),
    ).toEqual([]);
  });
});
