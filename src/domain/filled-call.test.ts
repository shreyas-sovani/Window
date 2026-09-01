import { describe, expect, it } from "vitest";
import type { LiveWindow, WalletFill } from "../exchange/port";
import { callReceiptFromFill, filledCall } from "./filled-call";

const live: LiveWindow = {
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
  openingPrice: "67214.50",
  tick: 1000n,
  lot: 1000n,
  decimals: 6,
};

let seq = 0;
function fill(over: Partial<WalletFill> & Pick<WalletFill, "side" | "price" | "quantity">): WalletFill {
  seq += 1;
  return {
    id: `f${seq}`,
    asset: "BTC",
    intervalSec: 900,
    direction: "buy",
    quote: over.quantity * over.price,
    timestamp: 1_000,
    txHash: "0xtx1",
    marketId: "0xaaa",
    ...over,
  };
}

describe("filledCall", () => {
  it("aggregates every tape row of one tx into filled contracts, weighted avg odds, and escrow", () => {
    const tape = [
      fill({ side: "up", price: 0.55, quantity: 10, txHash: "0xtx1" }),
      fill({ side: "up", price: 0.65, quantity: 10, txHash: "0xtx1" }),
    ];
    const got = filledCall(tape, { side: "up", asset: "BTC", intervalSec: 900, txHash: "0xtx1" });
    expect(got).not.toBeNull();
    expect(got!.contracts).toBeCloseTo(20, 6);
    // (10*0.55 + 10*0.65) / 20 = 0.60
    expect(got!.avgOdds).toBeCloseTo(0.6, 6);
    expect(got!.escrow).toBeCloseTo(12, 6);
    expect(got!.txHash).toBe("0xtx1");
    expect(got!.proofs).toHaveLength(2);
  });

  it("returns null when no tape row matches the tx — a missing fill is never a receipt", () => {
    const tape = [fill({ side: "up", price: 0.55, quantity: 10, txHash: "0xother" })];
    expect(filledCall(tape, { side: "up", asset: "BTC", intervalSec: 900, txHash: "0xtx1" })).toBeNull();
  });

  it("only aggregates the called side", () => {
    const tape = [
      fill({ side: "up", price: 0.55, quantity: 10, txHash: "0xtx1" }),
      fill({ side: "down", price: 0.45, quantity: 50, txHash: "0xtx1" }),
    ];
    const got = filledCall(tape, { side: "down", asset: "BTC", intervalSec: 900, txHash: "0xtx1" });
    expect(got!.contracts).toBeCloseTo(50, 6);
    expect(got!.avgOdds).toBeCloseTo(0.45, 6);
    expect(got!.escrow).toBeCloseTo(22.5, 6);
  });

  it("matches the series (asset + snapped cadence), not just any fill", () => {
    const tape = [
      fill({ side: "up", price: 0.55, quantity: 10, txHash: "0xtx1", asset: "ETH" }),
      fill({ side: "up", price: 0.55, quantity: 10, txHash: "0xtx1", intervalSec: 300 }),
    ];
    expect(filledCall(tape, { side: "up", asset: "BTC", intervalSec: 900, txHash: "0xtx1" })).toBeNull();
  });

  it("without a tx hash it aggregates the matching rows recorded since the write started, and nothing older", () => {
    const tape = [
      fill({ side: "up", price: 0.4, quantity: 10, txHash: "0xold", timestamp: 900 }),
      fill({ side: "up", price: 0.6, quantity: 5, txHash: "0xa", timestamp: 1_010 }),
      fill({ side: "up", price: 0.7, quantity: 5, txHash: "0xb", timestamp: 1_020 }),
    ];
    const got = filledCall(tape, { side: "up", asset: "BTC", intervalSec: 900, sinceSec: 1_000 });
    expect(got!.contracts).toBeCloseTo(10, 6);
    expect(got!.avgOdds).toBeCloseTo(0.65, 6);
  });

  it("a zero-quantity match is no fill, not a free receipt", () => {
    const tape = [fill({ side: "up", price: 0.55, quantity: 0, txHash: "0xtx1" })];
    expect(filledCall(tape, { side: "up", asset: "BTC", intervalSec: 900, txHash: "0xtx1" })).toBeNull();
  });

  it("scopes by marketId when given — a sibling Window of the same series is a different market", () => {
    const tape = [
      fill({ side: "up", price: 0.55, quantity: 10, txHash: "0xtx1", marketId: "0xaaa" }),
      fill({ side: "up", price: 0.6, quantity: 5, txHash: "0xtx2", marketId: "0xbbb" }),
    ];
    const got = filledCall(tape, {
      side: "up",
      asset: "BTC",
      intervalSec: 900,
      marketId: "0xbbb",
    });
    expect(got!.contracts).toBeCloseTo(5, 6);
    expect(got!.avgOdds).toBeCloseTo(0.6, 6);
  });

  it("aggregates every fill this wallet holds on one market and side when no tx hash is known", () => {
    const tape = [
      fill({ side: "down", price: 0.4, quantity: 10, txHash: "0xa", marketId: "0xaaa" }),
      fill({ side: "down", price: 0.5, quantity: 10, txHash: "0xb", marketId: "0xaaa" }),
      fill({ side: "down", price: 0.9, quantity: 99, txHash: "0xc", marketId: "0xbbb" }),
    ];
    const got = filledCall(tape, { side: "down", asset: "BTC", intervalSec: 900, marketId: "0xaaa" });
    expect(got!.contracts).toBeCloseTo(20, 6);
    expect(got!.escrow).toBeCloseTo(9, 6);
  });

  it("builds a CallReceipt from the verified fill — tape numbers, not the intent's plan", () => {
    const filled = filledCall(
      [fill({ side: "up", price: 0.55, quantity: 10, txHash: "0xtx1" })],
      { side: "up", asset: "BTC", intervalSec: 900, txHash: "0xtx1" },
    )!;
    const r = callReceiptFromFill(live, filled, 1_500);
    expect(r).toMatchObject({
      asset: "BTC",
      intervalSec: 900,
      side: "up",
      line: "67214.50",
      expiry: 2_000,
      stake: 5.5,
      contracts: 10,
      avgOdds: 0.55,
      payoutIfWin: 10,
      maxLoss: 5.5,
      txHash: "0xtx1",
      marketId: "0xabc",
      ts: 1_500,
    });
  });
});
