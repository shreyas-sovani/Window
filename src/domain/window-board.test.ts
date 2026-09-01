import { describe, expect, it } from "vitest";
import type { LiveWindow, OpenTicket } from "../exchange/port";
import { readBoard, windowTickets } from "./window-board";

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
    expect(board.upPlan).toEqual({ ok: false, reason: "bad-price" });
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

  it("a Down-only book still allows Call Down — each side gates itself", () => {
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
      downQuote: { quantity: 15_000_000n, limitPrice: 500_000n, escrow: 7_500_000n },
    });
    expect(board.upPlan.ok).toBe(false);
    expect(board.downPlan.ok).toBe(true);
    expect(board.gate).toEqual({ action: "call", canCall: true });
  });

  it("an Up-only book still allows Call Up", () => {
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
      upQuote: { quantity: 15_000_000n, limitPrice: 500_000n, escrow: 7_500_000n },
    });
    expect(board.upPlan.ok).toBe(true);
    expect(board.downPlan.ok).toBe(false);
    expect(board.gate).toEqual({ action: "call", canCall: true });
  });

  it("neither side executable keeps the gate at wait", () => {
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
    expect(board.upPlan.ok).toBe(false);
    expect(board.downPlan.ok).toBe(false);
    expect(board.gate.action).toBe("wait");
  });

  it("treats sub-decimal and enormous stake input as invalid instead of throwing", () => {
    const input = {
      windows: [live()],
      asset: "BTC",
      intervalSec: 900,
      nowSec: 1_000,
      book: { bid: 0.4, ask: 0.5 },
      connected: true,
      chainId: 50312,
      expectedChainId: 50312,
      allowance: 10_000_000n,
    };
    expect(() => readBoard({ ...input, stake: 0.0000001 })).not.toThrow();
    expect(readBoard({ ...input, stake: 0.0000001 }).stakeRaw).toBe(0n);
    expect(() => readBoard({ ...input, stake: 1e30 })).not.toThrow();
    expect(readBoard({ ...input, stake: 1e30 }).stakeRaw).toBe(0n);
  });
});

describe("windowTickets", () => {
  const ticket = (over: Partial<OpenTicket>): OpenTicket => ({
    id: over.id ?? "1",
    symbol: over.symbol ?? "BTC#YES",
    side: "buy",
    price: 0.5,
    remaining: 10,
    ...over,
  });

  it("lists resting orders on both sides of this Window, never other markets", () => {
    const tickets = [
      ticket({ id: "1", symbol: "BTC#YES" }),
      ticket({ id: "2", symbol: "BTC#NO", price: 0.45, remaining: 8 }),
      ticket({ id: "3", symbol: "ETH#YES", price: 0.6, remaining: 5 }),
    ];
    expect(windowTickets(tickets, "BTC#YES", "BTC#NO").map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("covers the Down symbol when only the Up was queried before", () => {
    const tickets = [ticket({ id: "d", symbol: "BTC#NO", price: 0.45, remaining: 8 })];
    expect(windowTickets(tickets, "BTC#YES", "BTC#NO")).toHaveLength(1);
  });

  it("a Window without a Down symbol falls back to the Up symbol alone", () => {
    const tickets = [
      ticket({ id: "1", symbol: "BTC#YES" }),
      ticket({ id: "2", symbol: "BTC#NO" }),
    ];
    expect(windowTickets(tickets, "BTC#YES", undefined).map((t) => t.id)).toEqual(["1"]);
  });
});
