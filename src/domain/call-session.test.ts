import { describe, expect, it } from "vitest";
import type { LiveWindow } from "../exchange/port";
import { executeCall, executeExit, executeRest, prepareCall, prepareExit, prepareQuotedCall } from "./call-session";

const takePlan = {
  kind: "take" as const,
  side: "up" as const,
  price: 0.5,
  contracts: 10,
  maxLoss: 5,
  payoutIfWin: 10,
  sizeRaw: 1n,
  priceRaw: 1n,
};

const live = (over: Partial<LiveWindow> = {}): LiveWindow => ({
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

describe("prepareCall", () => {
  it("refuses a Call when there is no live Window", () => {
    expect(prepareCall({ live: null, book: { ask: 0.6 }, stake: 10, side: "up", nowSec: 1_000 })).toEqual({
      ok: false,
      reason: "no-window",
    });
  });

  it("refuses a Call when the book has no tradable price — never invents 50%", () => {
    expect(prepareCall({ live: live(), book: undefined, stake: 10, side: "up", nowSec: 1_000 })).toEqual({
      ok: false,
      reason: "bad-price",
    });
    expect(prepareCall({ live: live(), book: {}, stake: 10, side: "down", nowSec: 1_000 })).toEqual({
      ok: false,
      reason: "bad-price",
    });
  });

  it("sizes a 10 tUSDC Up Call at 0.50", () => {
    const got = prepareCall({ live: live(), book: { ask: 0.5 }, stake: 10, side: "up", nowSec: 1_000 });
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.symbol).toBe("BTC#YES");
    expect(got.plan.kind).toBe("take");
    if (got.plan.kind !== "take") return;
    expect(got.plan.contracts).toBe(20);
  });

  it("buys each outcome at its own ask and refuses a missing side", () => {
    const book = { bid: 0.55, ask: 0.6 };
    const up = prepareCall({ live: live(), book, stake: 10, side: "up", nowSec: 1_000 });
    const down = prepareCall({ live: live(), book, stake: 10, side: "down", nowSec: 1_000 });
    expect(up.ok && up.plan.price).toBeCloseTo(0.6);
    expect(down.ok && down.plan.price).toBeCloseTo(0.45);
    expect(prepareCall({ live: live(), book: { bid: 0.55 }, stake: 10, side: "up", nowSec: 1_000 })).toEqual({
      ok: false,
      reason: "bad-price",
    });
    expect(prepareCall({ live: live(), book: { ask: 0.6 }, stake: 10, side: "down", nowSec: 1_000 })).toEqual({
      ok: false,
      reason: "bad-price",
    });
  });
});

describe("prepareQuotedCall", () => {
  it("skips when the live book cannot fill the stake", () => {
    expect(prepareQuotedCall({ live: live(), side: "up", nowSec: 1_000, quote: null })).toEqual({
      ok: false,
      reason: "below-lot",
    });
  });

  it("uses the quoted quantity and limit, not a single-ask size", () => {
    const got = prepareQuotedCall({
      live: live(),
      side: "up",
      nowSec: 1_000,
      quote: { quantity: 15_000_000n, limitPrice: 400_000n, escrow: 6_000_000n },
    });
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.plan.contracts).toBe(15);
    expect(got.plan.price).toBe(0.4);
    expect(got.plan.maxLoss).toBe(6);
  });
});

describe("prepareExit", () => {
  it("skips a side with no contracts", () => {
    expect(
      prepareExit({ live: live(), book: { bid: 0.4 }, side: "up", up: 0n, down: 5n, decimals: 6 }),
    ).toEqual({ ok: false, reason: "empty" });
  });

  it("refuses an Exit with no book at all — never invents 50%", () => {
    expect(
      prepareExit({ live: live(), book: undefined, side: "up", up: 2n, down: 0n, decimals: 6 }),
    ).toEqual({ ok: false, reason: "bad-price" });
    expect(
      prepareExit({ live: live(), book: {}, side: "down", up: 0n, down: 2n, decimals: 6 }),
    ).toEqual({ ok: false, reason: "bad-price" });
  });

  it("sells Down at its bid, one minus the Up ask", () => {
    const got = prepareExit({
      live: live(),
      book: { bid: 0.55, ask: 0.6 },
      side: "down",
      up: 0n,
      down: 2_000_000n,
      decimals: 6,
    });
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.symbol).toBe("BTC#NO");
    expect(got.contracts).toBe(2);
    expect(got.price).toBeCloseTo(0.4);
  });

  it("refuses to sell when the selected outcome has no bid", () => {
    expect(
      prepareExit({ live: live(), book: { bid: 0.55 }, side: "down", up: 0n, down: 2n, decimals: 6 }),
    ).toEqual({ ok: false, reason: "bad-price" });
    expect(
      prepareExit({ live: live(), book: { ask: 0.6 }, side: "up", up: 2n, down: 0n, decimals: 6 }),
    ).toEqual({ ok: false, reason: "bad-price" });
  });
});

describe("executeCall", () => {
  it("does not send if on-chain status is not Trading", async () => {
    const buys: unknown[] = [];
    await expect(
      executeCall(
        {
          onchainStatus: async () => 2,
          iocBuy: async (...args) => {
            buys.push(args);
            return undefined;
          },
          iocSell: async () => undefined,
          restBuy: async () => undefined,
        },
        live(),
        { ok: true, symbol: "BTC#YES", plan: takePlan },
      ),
    ).rejects.toThrow(/Trading/);
    expect(buys).toEqual([]);
  });

  it("sends an IOC buy once on-chain status is Trading", async () => {
    const buys: unknown[] = [];
    const hash = await executeCall(
      {
        onchainStatus: async () => 1,
        iocBuy: async (...args) => {
          buys.push(args);
          return "0xcall";
        },
        iocSell: async () => undefined,
        restBuy: async () => undefined,
      },
      live(),
      { ok: true, symbol: "BTC#YES", plan: takePlan },
    );
    expect(buys).toEqual([["BTC#YES", 10, 0.5]]);
    expect(hash).toBe("0xcall");
  });
});

describe("executeExit", () => {
  it("does not sell if on-chain status is not Trading", async () => {
    const sells: unknown[] = [];
    await expect(
      executeExit(
        {
          onchainStatus: async () => 2,
          iocBuy: async () => undefined,
          iocSell: async (...args) => {
            sells.push(args);
            return undefined;
          },
          restBuy: async () => undefined,
        },
        live(),
        { ok: true, symbol: "BTC#NO", contracts: 2, price: 0.4 },
      ),
    ).rejects.toThrow(/Trading/);
    expect(sells).toEqual([]);
  });

  it("returns the IOC sell hash when Trading", async () => {
    const hash = await executeExit(
      {
        onchainStatus: async () => 1,
        iocBuy: async () => undefined,
        iocSell: async () => "0xexit",
        restBuy: async () => undefined,
      },
      live(),
      { ok: true, symbol: "BTC#NO", contracts: 2, price: 0.4 },
    );
    expect(hash).toBe("0xexit");
  });
});

describe("executeRest", () => {
  it("posts a bid without sending an IOC take", async () => {
    const iocs: unknown[] = [];
    const rests: unknown[] = [];
    const hash = await executeRest(
      {
        onchainStatus: async () => 1,
        iocBuy: async (...args) => {
          iocs.push(args);
          return undefined;
        },
        iocSell: async () => undefined,
        restBuy: async (...args) => {
          rests.push(args);
          return "0xrest";
        },
      },
      live(),
      {
        ok: true,
        symbol: "BTC#YES",
        plan: {
          ok: true,
          side: "up",
          price: 0.5,
          contracts: 20,
          maxLoss: 10,
          sizeRaw: 20_000_000n,
          priceRaw: 500_000n,
        },
      },
    );
    expect(iocs).toEqual([]);
    expect(rests).toEqual([["BTC#YES", 20, 0.5]]);
    expect(hash).toBe("0xrest");
  });
});
