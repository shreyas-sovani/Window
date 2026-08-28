import { describe, expect, it } from "vitest";
import {
  claimReceiptCopy,
  claimSessionCopy,
  executeClaims,
  planClaimSession,
  readClaimSession,
  type SettledWindow,
} from "./claim-session";

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

describe("readClaimSession", () => {
  it("counts a void as one Window and pays half on each side", () => {
    const session = readClaimSession([
      row({ isVoided: true, isResolved: false, winningOutcome: null, up: 2_000_000n, down: 4_000_000n }),
    ]);
    expect(session.windows).toBe(1);
    expect(session.intents).toHaveLength(2);
    expect(session.payout).toBe(3_000_000n);
  });

  it("pays only the winner and skips a zero-balance Window", () => {
    const session = readClaimSession([
      row({ marketId: "0xwin", up: 5_000_000n, down: 9_000_000n }),
      row({ marketId: "0xempty", expiry: 2_000, up: 0n, down: 0n }),
    ]);
    expect(session.windows).toBe(1);
    expect(session.intents).toHaveLength(1);
    expect(session.payout).toBe(5_000_000n);
  });

  it("skims the venue fee from winners, not voids", () => {
    const win = readClaimSession([row({ up: 10_000_000n, down: 0n })], 40, 100n);
    expect(win.payout).toBe(9_900_000n);
    const voided = readClaimSession(
      [row({ isVoided: true, isResolved: false, winningOutcome: null, up: 10_000_000n, down: 0n })],
      40,
      100n,
    );
    expect(voided.payout).toBe(5_000_000n);
  });
});

describe("executeClaims", () => {
  it("sends each intent and returns the last redeem hash", async () => {
    const sent: unknown[] = [];
    const session = readClaimSession([
      row({ isVoided: true, isResolved: false, winningOutcome: null, up: 2n, down: 3n }),
    ]);
    const receipt = await executeClaims(
      {
        redeem: async (intent) => {
          sent.push(intent.marketId);
          return sent.length === 1 ? "0xfirst" : "0xlast";
        },
      },
      session,
    );
    expect(receipt).toEqual({ count: 2, windows: 1, payout: 2n, failed: 0, txHash: "0xlast" });
    expect(sent).toEqual(["0xaaa", "0xaaa"]);
  });

  it("keeps redeeming later Windows when one redeem fails", async () => {
    const session = readClaimSession([
      row({ marketId: "0xbad", expiry: 200, up: 1n, down: 0n }),
      row({ marketId: "0xok", expiry: 100, up: 5n, down: 0n }),
    ]);
    const sent: string[] = [];
    const receipt = await executeClaims(
      {
        redeem: async (intent) => {
          sent.push(intent.marketId);
          if (intent.marketId === "0xbad") throw new Error("redeem reverted");
          return "0xokhash";
        },
      },
      session,
    );
    expect(sent).toEqual(["0xbad", "0xok"]);
    expect(receipt).toEqual({
      count: 1,
      windows: 1,
      payout: 5n,
      failed: 1,
      txHash: "0xokhash",
    });
  });

  it("rethrows when every Window fails so RevertCopy can speak", async () => {
    const session = readClaimSession([row({ up: 1n, down: 0n })]);
    await expect(
      executeClaims(
        {
          redeem: async () => {
            throw new Error("redeem reverted");
          },
        },
        session,
      ),
    ).rejects.toThrow("redeem reverted");
  });
});

describe("claimSessionCopy", () => {
  it("names Windows and tUSDC, not outcome balances", () => {
    expect(claimSessionCopy({ windows: 0, payout: 0n })).toBe("Nothing to claim on recent Finalized Windows.");
    expect(claimSessionCopy({ windows: 1, payout: 5_000_000n })).toBe("Claim 1 Window · 5 tUSDC");
    expect(claimSessionCopy({ windows: 2, payout: 12_400_000n })).toBe("Claim 2 Windows · 12.4 tUSDC");
    expect(claimReceiptCopy({ windows: 1, payout: 5_000_000n })).toBe("Claimed 1 Window · 5 tUSDC.");
    expect(claimReceiptCopy({ windows: 0, payout: 0n })).toBe("Nothing to claim on recent Finalized Windows.");
    expect(claimReceiptCopy({ windows: 1, payout: 5_000_000n, failed: 1 })).toBe(
      "Claimed 1 Window · 5 tUSDC. 1 Window could not be claimed.",
    );
  });
});
