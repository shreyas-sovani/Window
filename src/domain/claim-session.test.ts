import { describe, expect, it } from "vitest";
import { executeClaims, planClaimSession, type SettledWindow } from "./claim-session";

const row = (over: Partial<SettledWindow> = {}): SettledWindow => ({
  marketId: "0xaaa",
  market: "0x00000000000000000000000000000000000000aa",
  expiry: 1_000,
  isResolved: true,
  isVoided: false,
  winningOutcome: 0,
  up: 5n,
  down: 9n,
  ...over,
});

describe("planClaimSession", () => {
  it("redeems only the winner on a resolved Window", () => {
    expect(planClaimSession([row()])).toEqual([
      {
        marketId: "0xaaa",
        market: "0x00000000000000000000000000000000000000aa",
        outcomeIdx: 0,
        amount: 5n,
      },
    ]);
  });

  it("keeps the newest expiries when the scan is capped", () => {
    const intents = planClaimSession(
      [
        row({ marketId: "0xold", expiry: 100, up: 1n, down: 0n }),
        row({ marketId: "0xmid", expiry: 200, up: 1n, down: 0n }),
        row({ marketId: "0xnew", expiry: 300, up: 1n, down: 0n }),
      ],
      2,
    );
    expect(intents.map((i) => i.marketId)).toEqual(["0xnew", "0xmid"]);
  });
});

describe("executeClaims", () => {
  it("sends each intent and returns the count", async () => {
    const sent: unknown[] = [];
    const n = await executeClaims(
      {
        redeem: async (intent) => {
          sent.push(intent.marketId);
        },
      },
      planClaimSession([
        row({ isVoided: true, isResolved: false, winningOutcome: null, up: 2n, down: 3n }),
      ]),
    );
    expect(n).toBe(2);
    expect(sent).toEqual(["0xaaa", "0xaaa"]);
  });
});
