import { describe, expect, it } from "vitest";
import { replayDuel, replayRefusalCopy, type ReplayRow } from "./replay";

const M = "0x" + "11".repeat(32);
const OTHER = "0x" + "22".repeat(32);
const A = "0x00000000000000000000000000000000000000aa";
const B = "0x00000000000000000000000000000000000000bb";

let seq = 0;
function row(over: Partial<ReplayRow> & Pick<ReplayRow, "txHash" | "taker" | "side">): ReplayRow {
  seq += 1;
  return {
    marketId: M,
    quantity: 10,
    price: 0.5,
    ts: 1_000 + seq,
    ...over,
  };
}

const upRows: ReplayRow[] = [
  row({ txHash: "0xta", taker: A, side: "up", quantity: 10, price: 0.55, ts: 1_200 }),
];
const downRows: ReplayRow[] = [
  row({ txHash: "0xtb", taker: B, side: "down", quantity: 22, price: 0.42, ts: 1_400 }),
];

describe("replayDuel", () => {
  it("reconstructs a settled duel from two pinned tx hashes and the finalized outcome", () => {
    const got = replayDuel(
      { marketId: M, txA: "0xta", txB: "0xtb", outcome: "up", meta: { asset: "BTC", intervalSec: 900, expiry: 2_000, line: "67214.50" } },
      [...upRows, ...downRows],
    );
    expect(got.ok).toBe(true);
    if (got.ok) {
      expect(got.verdict.kind).toBe("settled");
      if (got.verdict.kind === "settled") {
        expect(got.verdict.winner.account).toBe(A);
        expect(got.verdict.winner.txHash).toBe("0xta");
        expect(got.verdict.loser.account).toBe(B);
        expect(got.verdict.asset).toBe("BTC");
        expect(got.verdict.line).toBe("67214.50");
      }
    }
  });

  it("calls the earlier fill the challenger and the later one the acceptor", () => {
    const got = replayDuel({ marketId: M, txA: "0xta", txB: "0xtb", outcome: "down" }, [...upRows, ...downRows]);
    expect(got.ok).toBe(true);
    if (got.ok && got.verdict.kind === "settled") {
      expect(got.verdict.winner.account).toBe(B);
    }
  });

  it("a Void outcome is a draw", () => {
    const got = replayDuel({ marketId: M, txA: "0xta", txB: "0xtb", outcome: "void" }, [...upRows, ...downRows]);
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.verdict.kind).toBe("void");
  });

  it("fails closed when a pinned hash is not a fill on that market", () => {
    const elsewhere = [row({ txHash: "0xta", taker: A, side: "up", marketId: OTHER })];
    expect(replayDuel({ marketId: M, txA: "0xta", txB: "0xtb", outcome: "up" }, [...elsewhere, ...downRows])).toEqual({
      ok: false,
      reason: "no-fill-a",
    });
    expect(replayDuel({ marketId: M, txA: "0xta", txB: "0xmissing", outcome: "up" }, [...upRows, ...downRows])).toEqual({
      ok: false,
      reason: "no-fill-b",
    });
  });

  it("fails closed when a fill has no wallet or no side on the tape", () => {
    const noWallet = [row({ txHash: "0xta", taker: null, side: "up" }), ...downRows];
    expect(replayDuel({ marketId: M, txA: "0xta", txB: "0xtb", outcome: "up" }, noWallet)).toEqual({
      ok: false,
      reason: "unknown-wallet",
    });
    const noSide = [row({ txHash: "0xta", taker: A, side: null }), ...downRows];
    expect(replayDuel({ marketId: M, txA: "0xta", txB: "0xtb", outcome: "up" }, noSide)).toEqual({
      ok: false,
      reason: "unknown-side",
    });
  });

  it("fails closed when both hashes are the same wallet or the same side", () => {
    const sameWallet = [upRows[0], row({ txHash: "0xtb", taker: A, side: "down" })];
    expect(replayDuel({ marketId: M, txA: "0xta", txB: "0xtb", outcome: "up" }, sameWallet)).toEqual({
      ok: false,
      reason: "same-wallet",
    });
    const sameSide = [upRows[0], row({ txHash: "0xtb", taker: B, side: "up" })];
    expect(replayDuel({ marketId: M, txA: "0xta", txB: "0xtb", outcome: "up" }, sameSide)).toEqual({
      ok: false,
      reason: "same-side",
    });
  });

  it("fails closed without a pinned outcome — a judge must bring the finalized result", () => {
    expect(replayDuel({ marketId: M, txA: "0xta", txB: "0xtb", outcome: "" }, [...upRows, ...downRows])).toEqual({
      ok: false,
      reason: "missing-outcome",
    });
  });

  it("aggregates multi-fill txs into one stake each", () => {
    const rows = [
      row({ txHash: "0xta", taker: A, side: "up", quantity: 10, price: 0.5 }),
      row({ txHash: "0xta", taker: A, side: "up", quantity: 10, price: 0.6 }),
      ...downRows,
    ];
    const got = replayDuel({ marketId: M, txA: "0xta", txB: "0xtb", outcome: "up" }, rows);
    expect(got.ok).toBe(true);
    if (got.ok && got.verdict.kind === "settled") {
      expect(got.verdict.winner.contracts).toBeCloseTo(20, 6);
      expect(got.verdict.winner.escrow).toBeCloseTo(11, 6);
    }
  });
});

describe("replayRefusalCopy", () => {
  it("names every failure honestly", () => {
    expect(replayRefusalCopy("no-fill-a")).toContain("not a verified fill");
    expect(replayRefusalCopy("missing-outcome")).toContain("outcome");
    expect(replayRefusalCopy("same-wallet")).toContain("one wallet");
    expect(replayRefusalCopy("bogus" as never)).toContain("cannot");
  });
});
