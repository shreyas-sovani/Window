import { describe, expect, it } from "vitest";
import type { LiveWindow } from "../exchange/port";
import { createFakeExchange } from "../exchange/fake";
import { executeCall, executeExit, executeFokCall, executeRest, prepareCall, prepareExit, prepareQuotedCall } from "./call-session";

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
    expect(up.ok && up.plan.price).toBeCloseTo(0.6 * 1.03, 4);
    expect(down.ok && down.plan.price).toBeCloseTo(0.45 * 1.03, 4);
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
    // The SDK already cushioned the limit inside quoteBinaryStake; the app
    // hands it through unchanged so the escrow it computed (≤ stake) still holds.
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
    // Exit sell cushions the seen bid down by 3% so a maker tick-down between
    // read and sign still crosses.
    expect(got.price).toBeCloseTo(0.4 * 0.97, 4);
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

describe("executeFokCall", () => {
  it("sends the accept as FOK after re-checking Trading", async () => {
    const ex = createFakeExchange({
      windows: [live()],
      books: { "BTC#YES": { bid: 0.5, ask: 0.6 } },
      statusByMarket: { "0xabc": 1 },
    });
    const intent = prepareCall({ live: live(), book: { bid: 0.5, ask: 0.6 }, stake: 10, side: "down", nowSec: 1_000 });
    expect(intent.ok).toBe(true);
    const hash = await executeFokCall(ex, live(), intent);
    expect(hash).toMatch(/^0xfake/);
    // Buying NO cushions the crossing price up by 3% (buy cushion), not down.
    expect(ex.state.foks).toEqual([{ symbol: "BTC#NO", contracts: 20, price: 0.5 * 1.03 }]);
  });

  it("refuses FOK on a Window that is not Trading", async () => {
    const ex = createFakeExchange({
      windows: [live()],
      books: { "BTC#YES": { bid: 0.5, ask: 0.6 } },
      statusByMarket: { "0xabc": 2 },
    });
    const intent = prepareCall({ live: live(), book: { bid: 0.5, ask: 0.6 }, stake: 10, side: "down", nowSec: 1_000 });
    await expect(executeFokCall(ex, live(), intent)).rejects.toThrow("not Trading");
  });
});

describe("protective limit cushion", () => {
  it("a raw-book buy's limit sits above the seen ask — sign-time drift still crosses", () => {
    // The SDK-quoted path trusts the SDK's own cushion (see somnia.ts
    // quoteStake, slippageBps: 1000). The raw-book fallback below is where the
    // app pads the limit itself, since the book has no cushion of its own.
    const plan = prepareCall({
      live: live({ expiry: 100_000 }),
      book: { ask: 0.587 },
      stake: 10,
      side: "up",
      nowSec: 99_000,
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      // 0.587 × 1.03 = 0.60461 — the ask can drift up 3% and still fill.
      expect(plan.plan.price).toBeGreaterThan(0.604);
      expect(plan.plan.price).toBeLessThan(0.605);
      expect(plan.plan.price).toBeLessThan(1);
    }
  });

  it("the SDK-quoted path passes the SDK's cushioned limit through unchanged", () => {
    // Doubling cushions would keep the SDK's quantity but raise the escrow
    // (quantity × new_limit) above the stake the wallet approved for.
    const quoted = prepareQuotedCall({
      live: live({ expiry: 100_000 }),
      side: "up",
      nowSec: 99_000,
      quote: { quantity: 17_035_000n, limitPrice: 587_000n, escrow: 10_000_000n },
    });
    expect(quoted.ok).toBe(true);
    if (quoted.ok) {
      expect(quoted.plan.price).toBe(0.587);
      expect(quoted.plan.priceRaw).toBe(587_000n);
    }
  });

  it("a book-sized buy carries the same cushion", () => {
    const plan = prepareCall({
      live: live({ expiry: 100_000 }),
      book: { bid: 0.55, ask: 0.587 },
      stake: 10,
      side: "up",
      nowSec: 99_000,
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.plan.price).toBeCloseTo(0.587 * 1.03, 4);
  });

  it("a down Call cushions the NO price it crosses, not the YES bid", () => {
    const plan = prepareCall({
      live: live({ expiry: 100_000 }),
      book: { bid: 0.42, ask: 0.60 },
      stake: 10,
      side: "down",
      nowSec: 99_000,
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      // NO price = 1 − YES bid = 0.58, cushioned to 0.5974.
      expect(plan.plan.price).toBeCloseTo(0.58 * 1.03, 4);
    }
  });

  it("an exit's sell limit sits below the seen bid", () => {
    const exit = prepareExit({
      live: live({ expiry: 100_000 }),
      book: { bid: 0.42, ask: 0.60 },
      side: "up",
      up: 5_000_000n,
      down: 0n,
      decimals: 6,
    });
    expect(exit.ok).toBe(true);
    if (exit.ok) expect(exit.price).toBeCloseTo(0.42 * 0.97, 4);
  });

  it("the cushion never pushes a buy to ≥ 1 or a sell to ≤ 0", () => {
    const nearOne = prepareCall({
      live: live({ expiry: 100_000 }),
      book: { bid: 0.97, ask: 0.995 },
      stake: 10,
      side: "up",
      nowSec: 99_000,
    });
    expect(nearOne.ok).toBe(true);
    if (nearOne.ok) expect(nearOne.plan.price).toBeLessThan(1);
    const exit = prepareExit({
      live: live({ expiry: 100_000 }),
      book: { bid: 0.005, ask: 0.2 },
      side: "up",
      up: 5_000_000n,
      down: 0n,
      decimals: 6,
    });
    expect(exit.ok).toBe(true);
    if (exit.ok) expect(exit.price).toBeGreaterThan(0);
  });
});
