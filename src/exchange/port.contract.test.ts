import { describe, expect, it } from "vitest";
import { createFakeExchange } from "./fake";
import { somniaExchange } from "./somnia";
import type { ExchangePort } from "./port";

const PORT_METHODS = [
  "listLiveWindows",
  "book",
  "quoteStake",
  "settlementFeeBps",
  "listSeriesHistory",
  "listMarketFills",
  "watchAssetPrice",
  "assetPrice",
  "onchainStatus",
  "iocBuy",
  "iocSell",
  "restBuy",
  "outcomeBalances",
  "mintTestCollateral",
  "claimFinalized",
  "previewClaimSession",
  "listOpenTickets",
  "cancelOpenTicket",
  "listFills",
  "listPositionPnl",
] as const satisfies (keyof ExchangePort)[];

describe("ExchangePort contract", () => {
  it("the live adapter implements every port method", () => {
    for (const m of PORT_METHODS) {
      expect(typeof (somniaExchange as ExchangePort)[m], `somnia.${m}`).toBe("function");
    }
  });

  it("the fake adapter implements every port method", () => {
    const fake = createFakeExchange();
    for (const m of PORT_METHODS) {
      expect(typeof fake[m], `fake.${m}`).toBe("function");
    }
  });

  it("the fake lists only Trading/Locked/Settling windows, never Finalized", async () => {
    const fake = createFakeExchange({
      windows: [
        { status: 1, marketId: "0x1" } as never,
        { status: 2, marketId: "0x2" } as never,
        { status: 4, marketId: "0x4" } as never,
      ],
    });
    const rows = await fake.listLiveWindows();
    expect(rows.map((w) => w.status).sort()).toEqual([1, 2]);
  });

  it("the fake's claim preview is read-only — balances survive a preview", async () => {
    const fake = createFakeExchange({
      claims: [
        {
          marketId: "0x" + "11".repeat(32),
          isResolved: true,
          isVoided: false,
          winningOutcome: 0,
          up: 5_000_000n,
          down: 0n,
        },
      ],
    });
    const before = await fake.previewClaimSession("0xabc");
    expect(before.windows).toBe(1);
    const after = await fake.claimFinalized("0xabc");
    expect(after.windows).toBe(1);
    const again = await fake.previewClaimSession("0xabc");
    expect(again.windows).toBe(0);
  });
});
