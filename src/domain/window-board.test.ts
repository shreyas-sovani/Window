import { describe, expect, it } from "vitest";
import type { LiveWindow } from "../exchange/port";
import { readBoard } from "./window-board";

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

describe("readBoard", () => {
  it("sizes an Up Call and asks a disconnected visitor to connect", () => {
    const board = readBoard({
      windows: [live()],
      asset: "BTC",
      intervalSec: 900,
      nowSec: 1_000,
      book: { ask: 0.5 },
      stake: 10,
      connected: false,
      chainId: undefined,
      expectedChainId: 50312,
      allowance: 0n,
    });
    expect(board.live?.upSymbol).toBe("BTC#YES");
    expect(board.upPlan.ok).toBe(true);
    if (board.upPlan.ok) expect(board.upPlan.plan.contracts).toBe(20);
    expect(board.gate).toEqual({ action: "connect", canCall: false });
    expect(board.thinBook).toBe(false);
  });

  it("is ready to Call when Shannon, allowance, and a live Window line up", () => {
    const board = readBoard({
      windows: [live()],
      asset: "BTC",
      intervalSec: 900,
      nowSec: 1_000,
      book: { ask: 0.5 },
      stake: 10,
      connected: true,
      chainId: 50312,
      expectedChainId: 50312,
      allowance: 10_000_000n,
    });
    expect(board.gate).toEqual({ action: "call", canCall: true });
  });

  it("flags a thin book when implied Up is missing", () => {
    const board = readBoard({
      windows: [live()],
      asset: "BTC",
      intervalSec: 900,
      nowSec: 1_000,
      book: {},
      stake: 10,
      connected: true,
      chainId: 50312,
      expectedChainId: 50312,
      allowance: 10_000_000n,
    });
    expect(board.implied).toBeUndefined();
    expect(board.thinBook).toBe(true);
    expect(board.upPlan.ok).toBe(true);
  });

  it("marks short collateral when the wallet cannot cover the stake", () => {
    const board = readBoard({
      windows: [live()],
      asset: "BTC",
      intervalSec: 900,
      nowSec: 1_000,
      book: { ask: 0.5 },
      stake: 10,
      connected: true,
      chainId: 50312,
      expectedChainId: 50312,
      allowance: 10_000_000n,
      collateral: 1_000_000n,
    });
    expect(board.shortCollateral).toBe(true);
  });

  it("prefers a live-book stake quote over a single-ask size", () => {
    const board = readBoard({
      windows: [live()],
      asset: "BTC",
      intervalSec: 900,
      nowSec: 1_000,
      book: { ask: 0.5 },
      stake: 10,
      connected: true,
      chainId: 50312,
      expectedChainId: 50312,
      allowance: 10_000_000n,
      upQuote: { quantity: 15_000_000n, limitPrice: 400_000n, escrow: 6_000_000n },
    });
    expect(board.upPlan.ok).toBe(true);
    if (board.upPlan.ok) expect(board.upPlan.plan.contracts).toBe(15);
  });

  it("keeps a locking Window on the board and refuses new Calls", () => {
    const board = readBoard({
      windows: [live({ expiry: 2_000 })],
      asset: "BTC",
      intervalSec: 900,
      nowSec: 1_950,
      book: { ask: 0.5 },
      stake: 10,
      connected: true,
      chainId: 50312,
      expectedChainId: 50312,
      allowance: 10_000_000n,
    });
    expect(board.live?.marketId).toBe("0xabc");
    expect(board.phase).toEqual({ kind: "too-close" });
    expect(board.upPlan.ok).toBe(false);
    if (!board.upPlan.ok) expect(board.upPlan.reason).toBe("too-close");
    expect(board.gate.canCall).toBe(false);
  });

  it("keeps a just-expired Locked Window as waiting", () => {
    const board = readBoard({
      windows: [live({ expiry: 2_000, status: 2 })],
      asset: "BTC",
      intervalSec: 900,
      nowSec: 2_030,
      book: { ask: 0.5 },
      stake: 10,
      connected: true,
      chainId: 50312,
      expectedChainId: 50312,
      allowance: 10_000_000n,
    });
    expect(board.live?.marketId).toBe("0xabc");
    expect(board.phase).toEqual({ kind: "locked" });
    expect(board.upPlan.ok).toBe(false);
    expect(board.gate.action).toBe("wait");
  });
});
