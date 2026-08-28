import { describe, expect, it } from "vitest";
import { executeCall, prepareCall } from "../domain/call-session";
import { createFakeExchange } from "./fake";
import type { LiveWindow, PositionPnl } from "./port";

const windowRow = (over: Partial<LiveWindow> = {}): LiveWindow => ({
  marketId: "0xabc",
  symbol: "BTC-15m",
  upSymbol: "BTC#YES",
  downSymbol: "BTC#NO",
  asset: "BTC",
  intervalSec: 900,
  expiry: 2_000,
  venueId: "0xvenue",
  pool: "0x0000000000000000000000000000000000000001",
  status: 1,
  tick: 1000n,
  lot: 1000n,
  decimals: 6,
  ...over,
});

describe("fake ExchangeAdapter", () => {
  it("lists Trading and Locked Windows, not Finalized", async () => {
    const ex = createFakeExchange({
      windows: [
        windowRow(),
        windowRow({ marketId: "0xdef", status: 2, upSymbol: "ETH#YES" }),
        windowRow({ marketId: "0xfin", status: 4, upSymbol: "BTC#OLD" }),
      ],
    });
    const live = await ex.listLiveWindows();
    expect(live.map((w) => w.marketId).sort()).toEqual(["0xabc", "0xdef"]);
  });

  it("records an IOC Call when the Call session is Trading", async () => {
    const ex = createFakeExchange({
      windows: [windowRow()],
      books: { "BTC#YES": { ask: 0.5 } },
      statusByMarket: { "0xabc": 1 },
    });
    const [live] = await ex.listLiveWindows();
    const intent = prepareCall({ live, book: { ask: 0.5 }, stake: 10, side: "up", nowSec: 1_000 });
    const hash = await executeCall(ex, live!, intent);
    expect(ex.state.buys).toEqual([{ symbol: "BTC#YES", contracts: 20, price: 0.5 }]);
    expect(hash).toBe("0xfake");
  });

  it("rests a post-only bid without recording a fill", async () => {
    const ex = createFakeExchange({
      windows: [windowRow()],
      books: { "BTC#YES": { bid: 0.5, ask: 0.6 } },
      statusByMarket: { "0xabc": 1 },
    });
    const [live] = await ex.listLiveWindows();
    const hash = await ex.restBuy("BTC#YES", 20, 0.5);
    expect(hash).toBe("0xfake");
    expect(ex.state.rests).toEqual([{ symbol: "BTC#YES", contracts: 20, price: 0.5 }]);
    expect(ex.state.fills).toEqual([]);
  });

  it("claims only the winning side on a resolved Window", async () => {
    const ex = createFakeExchange({
      claims: [
        {
          marketId: "0xabc",
          isResolved: true,
          isVoided: false,
          winningOutcome: 0,
          up: 5n,
          down: 9n,
        },
      ],
    });
    const n = await ex.claimFinalized("0x0000000000000000000000000000000000000001");
    expect(n).toBe(1);
  });

  it("claims both sides on a void", async () => {
    const ex = createFakeExchange({
      claims: [
        {
          marketId: "0xabc",
          isResolved: false,
          isVoided: true,
          winningOutcome: null,
          up: 3n,
          down: 4n,
        },
      ],
    });
    expect(await ex.claimFinalized("0x0000000000000000000000000000000000000001")).toBe(2);
  });

  it("previews Claim session count without redeeming", async () => {
    const account = "0x0000000000000000000000000000000000000001" as const;
    const ex = createFakeExchange({
      claims: [
        {
          marketId: "0xabc",
          isResolved: true,
          isVoided: false,
          winningOutcome: 0,
          up: 5n,
          down: 9n,
        },
      ],
    });
    expect(await ex.previewClaimSession(account)).toBe(1);
    expect(ex.state.claims[0]?.up).toBe(5n);
    expect(await ex.claimFinalized(account)).toBe(1);
    expect(await ex.previewClaimSession(account)).toBe(0);
  });

  it("sizes a stake quote from the resting book", async () => {
    const ex = createFakeExchange({
      windows: [windowRow()],
      books: { "BTC#YES": { ask: 0.5 } },
    });
    const q = await ex.quoteStake("0xabc", "up", 10_000_000n);
    expect(q?.quantity).toBe(20_000_000n);
  });

  it("returns null when the Window is missing", async () => {
    const ex = createFakeExchange({ windows: [windowRow()] });
    expect(await ex.quoteStake("0xdef", "up", 10_000_000n)).toBeNull();
  });

  it("returns a venue settlement fee, or zero when unknown", async () => {
    const ex = createFakeExchange({ feesByMarket: { "0xabc": 100n } });
    expect(await ex.settlementFeeBps("0xabc")).toBe(100n);
    expect(await ex.settlementFeeBps("0xdef")).toBe(0n);
  });

  it("records a fill tape row when the Call session sends an IOC", async () => {
    const ex = createFakeExchange({
      windows: [windowRow()],
      books: { "BTC#YES": { ask: 0.5 } },
      statusByMarket: { "0xabc": 1 },
    });
    const [live] = await ex.listLiveWindows();
    const intent = prepareCall({ live, book: { ask: 0.5 }, stake: 10, side: "up", nowSec: 1_000 });
    expect(intent.ok).toBe(true);
    await executeCall(ex, live!, intent);
    const fills = await ex.listFills("0x0000000000000000000000000000000000000001");
    expect(fills[0]?.direction).toBe("buy");
    expect(fills[0]?.side).toBe("up");
    expect(fills[0]?.quote).toBe(10);
  });

  it("returns seeded position P&L", async () => {
    const row: PositionPnl = {
      marketId: "0xabc",
      asset: "BTC",
      intervalSec: 900,
      up: 10n * 10n ** 6n,
      down: 0n,
      costBasis: 6n * 10n ** 6n,
      avgCost: 600_000n,
      markValue: 7n * 10n ** 6n,
      unrealizedPnl: 1n * 10n ** 6n,
      realizedPnl: 0n,
      decimals: 6,
    };
    const ex = createFakeExchange({ positionPnl: [row] });
    expect(await ex.listPositionPnl("0x0000000000000000000000000000000000000001")).toEqual([row]);
  });
});
