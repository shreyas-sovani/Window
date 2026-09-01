import { describe, expect, it } from "vitest";
import { createFakeExchange } from "../exchange/fake";
import type { LiveWindow } from "../exchange/port";
import { executeCall, prepareCall } from "./call-session";
import { filledCall, type FilledCall } from "./filled-call";
import {
  duelRefusalCopy,
  duelFill,
  tapeDuelFill,
  readDuel,
  settleDuel,
  verifyAccept,
  verifyChallenge,
  type ChallengeHint,
  type DuelFill,
  type DuelWindow,
} from "./duel";

const CHALLENGER = "0x00000000000000000000000000000000000000aa";
const ACCEPTOR = "0x00000000000000000000000000000000000000bb";
const M = "0x" + "11".repeat(32);

const window: DuelWindow = {
  marketId: M,
  asset: "BTC",
  intervalSec: 900,
  expiry: 2_000,
  status: 1,
  line: "67214.50",
};

const filled = (over: Partial<FilledCall> = {}): FilledCall => ({
  side: "up",
  contracts: 18,
  avgOdds: 0.55,
  escrow: 9.9,
  txHash: "0xchallenger",
  proofs: [],
  ...over,
});

const hint: ChallengeHint = {
  marketId: M,
  challenger: CHALLENGER,
  side: "up",
  stake: 99, // wrong on purpose — the chain must win
  txHash: "0xchallenger",
  expiry: 2_000,
};

const challengerFill: DuelFill = {
  account: CHALLENGER,
  marketId: M,
  side: "up",
  contracts: 18,
  avgOdds: 0.55,
  escrow: 9.9,
  txHash: "0xchallenger",
  ts: 1_200,
};

const acceptorFill: DuelFill = {
  account: ACCEPTOR,
  marketId: M,
  side: "down",
  contracts: 22,
  avgOdds: 0.42,
  escrow: 9.24,
  txHash: "0xacceptor",
  ts: 1_400,
};

describe("verifyChallenge", () => {
  it("accepts a one-verified-fill challenge and takes every number from the fill, not the URL", () => {
    const got = verifyChallenge(hint, { window, challengerFill });
    expect(got.ok).toBe(true);
    if (got.ok) {
      expect(got.challenge.side).toBe("up");
      expect(got.challenge.stake).toBeCloseTo(9.9, 6);
      expect(got.challenge.contracts).toBeCloseTo(18, 6);
      expect(got.challenge.avgOdds).toBeCloseTo(0.55, 6);
      expect(got.challenge.expiry).toBe(2_000);
    }
  });

  it("refuses a challenge whose fill cannot be verified on-chain", () => {
    const got = verifyChallenge(hint, { window, challengerFill: null });
    expect(got).toEqual({ ok: false, reason: "missing-fill" });
  });

  it("refuses a challenge for a Window the chain does not have", () => {
    const got = verifyChallenge({ ...hint, marketId: "0x" + "22".repeat(32) }, { window, challengerFill });
    expect(got).toEqual({ ok: false, reason: "unknown-market" });
  });

  it("refuses a fill that belongs to a different market than the hint names", () => {
    const got = verifyChallenge(hint, { window, challengerFill: { ...challengerFill, marketId: "0x" + "33".repeat(32) } });
    expect(got).toEqual({ ok: false, reason: "wrong-market" });
  });
});

describe("verifyAccept", () => {
  const challenge = verifyChallenge(hint, { window, challengerFill });
  if (!challenge.ok) throw new Error("fixture");

  it("opens the duel on an opposite verified fill from another wallet", () => {
    const got = verifyAccept(challenge.challenge, { acceptor: ACCEPTOR, acceptorFill, windowStatus: 1 });
    expect(got.ok).toBe(true);
    if (got.ok) {
      expect(got.duel.challengerFill.account).toBe(CHALLENGER);
      expect(got.duel.acceptorFill.account).toBe(ACCEPTOR);
    }
  });

  it("refuses a wallet accepting its own challenge", () => {
    const got = verifyAccept(challenge.challenge, {
      acceptor: CHALLENGER,
      acceptorFill: { ...acceptorFill, account: CHALLENGER },
      windowStatus: 1,
    });
    expect(got).toEqual({ ok: false, reason: "self-accept" });
  });

  it("refuses an accept without a verified fill", () => {
    const got = verifyAccept(challenge.challenge, { acceptor: ACCEPTOR, acceptorFill: null, windowStatus: 1 });
    expect(got).toEqual({ ok: false, reason: "missing-fill" });
  });

  it("refuses an accept on the same side as the challenge", () => {
    const got = verifyAccept(challenge.challenge, {
      acceptor: ACCEPTOR,
      acceptorFill: { ...acceptorFill, side: "up" },
      windowStatus: 1,
    });
    expect(got).toEqual({ ok: false, reason: "same-side" });
  });

  it("refuses an accept on a different market", () => {
    const got = verifyAccept(challenge.challenge, {
      acceptor: ACCEPTOR,
      acceptorFill: { ...acceptorFill, marketId: "0x" + "44".repeat(32) },
      windowStatus: 1,
    });
    expect(got).toEqual({ ok: false, reason: "wrong-market" });
  });

  it("refuses an accept when the Window is not Trading", () => {
    const got = verifyAccept(challenge.challenge, { acceptor: ACCEPTOR, acceptorFill, windowStatus: 2 });
    expect(got).toEqual({ ok: false, reason: "not-trading" });
  });

  it("keeps unequal stakes visible — a duel is two independent book takes", () => {
    const got = verifyAccept(challenge.challenge, {
      acceptor: ACCEPTOR,
      acceptorFill: { ...acceptorFill, escrow: 31.2, contracts: 74.3, avgOdds: 0.42 },
      windowStatus: 1,
    });
    expect(got.ok).toBe(true);
    if (got.ok) {
      expect(got.duel.challengerFill.escrow).toBeCloseTo(9.9, 6);
      expect(got.duel.acceptorFill.escrow).toBeCloseTo(31.2, 6);
    }
  });
});

describe("settleDuel", () => {
  const challenge = verifyChallenge(hint, { window, challengerFill });
  if (!challenge.ok) throw new Error("fixture");
  const accepted = verifyAccept(challenge.challenge, { acceptor: ACCEPTOR, acceptorFill, windowStatus: 1 });
  if (!accepted.ok) throw new Error("fixture");

  it("settles on the side whose fill matches the outcome", () => {
    const got = settleDuel(accepted.duel, { result: "up" });
    expect(got.kind).toBe("settled");
    if (got.kind === "settled") {
      expect(got.winner.account).toBe(CHALLENGER);
      expect(got.winner.side).toBe("up");
      expect(got.loser.account).toBe(ACCEPTOR);
    }
  });

  it("settles Down for the Down wallet", () => {
    const got = settleDuel(accepted.duel, { result: "down" });
    expect(got.kind).toBe("settled");
    if (got.kind === "settled") expect(got.winner.account).toBe(ACCEPTOR);
  });

  it("a Void is a draw — no winner is invented", () => {
    expect(settleDuel(accepted.duel, { result: "void" }).kind).toBe("void");
  });

  it("an unsettled market keeps the duel open", () => {
    expect(settleDuel(accepted.duel, { result: "unknown" }).kind).toBe("open");
  });
});

describe("readDuel", () => {
  it("one verified fill on a live Window is a challenge awaiting the opponent", () => {
    const got = readDuel({
      hint,
      window,
      windowStatus: 1,
      challengerFill,
      acceptor: ACCEPTOR,
      acceptorFill: null,
      settlement: null,
      nowSec: 1_500,
    });
    expect(got.kind).toBe("challenge");
  });

  it("one fill after the Window expired is an expired challenge, not a win", () => {
    const got = readDuel({
      hint,
      window: { ...window, status: 4 },
      windowStatus: 4,
      challengerFill,
      acceptor: ACCEPTOR,
      acceptorFill: null,
      settlement: null,
      nowSec: 2_600,
    });
    expect(got.kind).toBe("expired");
  });

  it("a fill after expiry does not count as an accept", () => {
    const got = readDuel({
      hint,
      window,
      windowStatus: 1,
      challengerFill,
      acceptor: ACCEPTOR,
      acceptorFill: { ...acceptorFill, ts: 2_100 },
      settlement: null,
      nowSec: 2_200,
    });
    expect(got.kind).toBe("expired");
  });

  it("no hint is not a duel — solo Calls are not duels", () => {
    const got = readDuel({
      hint: null,
      window,
      windowStatus: 1,
      challengerFill: null,
      acceptor: ACCEPTOR,
      acceptorFill: null,
      settlement: null,
      nowSec: 1_500,
    });
    expect(got).toEqual({ kind: "invalid", reason: "no-challenge" });
  });

  it("renders the settled duel from market state plus two proofs", () => {
    const got = readDuel({
      hint,
      window: { ...window, status: 4 },
      windowStatus: 4,
      challengerFill,
      acceptor: ACCEPTOR,
      acceptorFill,
      settlement: { result: "up" },
      nowSec: 3_000,
    });
    expect(got.kind).toBe("settled");
    if (got.kind === "settled") expect(got.winner.account).toBe(CHALLENGER);
  });
});

describe("duelFill", () => {
  it("lifts a verified tape fill into the chain-shaped duel record", () => {
    const got = duelFill(CHALLENGER, M, filled(), 1_200);
    expect(got).toMatchObject({
      account: CHALLENGER,
      marketId: M,
      side: "up",
      contracts: 18,
      avgOdds: 0.55,
      escrow: 9.9,
      txHash: "0xchallenger",
      ts: 1_200,
    });
  });
});

describe("tapeDuelFill", () => {
  const rows = [
    { id: "1", price: 0.55, quantity: 10, quote: 5.5, aggressor: "up" as const, ts: 1_200, txHash: "0xta", marketId: M, taker: CHALLENGER },
    { id: "2", price: 0.6, quantity: 10, quote: 6, aggressor: "up" as const, ts: 1_210, txHash: "0xta", marketId: M, taker: CHALLENGER },
    { id: "3", price: 0.42, quantity: 22, quote: 9.24, aggressor: "down" as const, ts: 1_400, txHash: "0xtb", marketId: M, taker: ACCEPTOR },
    { id: "4", price: 0.9, quantity: 5, quote: 4.5, aggressor: "up" as const, ts: 900, txHash: "0xold", marketId: "0xsib", taker: ACCEPTOR },
    { id: "5", price: 0.5, quantity: 3, quote: 1.5, aggressor: null, ts: 1_500, txHash: "0xnull", marketId: M, taker: ACCEPTOR },
    { id: "6", price: 0.45, quantity: 5, quote: 2.25, aggressor: "down" as const, ts: 1_100, txHash: "0xtc", marketId: M, taker: CHALLENGER },
  ];

  it("aggregates a wallet's tape rows on one market into a duel fill", () => {
    const got = tapeDuelFill(rows, { marketId: M, txHash: "0xta", taker: CHALLENGER, side: "up" });
    expect(got).toMatchObject({
      account: CHALLENGER,
      marketId: M,
      side: "up",
      contracts: 20,
      escrow: 11.5,
      ts: 1_210,
      txHash: "0xta",
    });
    expect(got!.avgOdds).toBeCloseTo(0.575, 6);
  });

  it("finds the acceptor's opposite-side fill by wallet, not by tx hash", () => {
    const got = tapeDuelFill(rows, { marketId: M, taker: ACCEPTOR, side: "down" });
    expect(got).toMatchObject({ account: ACCEPTOR, side: "down", contracts: 22, txHash: "0xtb" });
  });

  it("never crosses a sibling Window of the same series", () => {
    expect(tapeDuelFill(rows, { marketId: M, taker: ACCEPTOR, side: "up" })).toBeNull();
  });

  it("rows without a side are not a fill", () => {
    expect(tapeDuelFill(rows, { marketId: M, txHash: "0xnull", taker: ACCEPTOR })).toBeNull();
  });

  it("finds the opponent by exclusion — any other wallet on the opposite side", () => {
    const got = tapeDuelFill(rows, { marketId: M, side: "down", notTaker: CHALLENGER });
    expect(got).toMatchObject({ account: ACCEPTOR, side: "down", contracts: 22, txHash: "0xtb" });
    // Without the exclusion the challenger's own Down row would pollute the aggregate.
    const without = tapeDuelFill(rows, { marketId: M, side: "down" });
    expect(without!.contracts).toBeCloseTo(27, 6);
  });
});

describe("duel through the fake adapter (two wallets, one Window)", () => {
  const liveWindow: LiveWindow = {
    marketId: M as `0x${string}`,
    symbol: "BTC-15m",
    upSymbol: "BTC#YES",
    downSymbol: "BTC#NO",
    asset: "BTC",
    intervalSec: 900,
    expiry: Math.floor(Date.now() / 1000) + 800,
    venueId: "0xvenue",
    pool: "0x0000000000000000000000000000000000000001",
    status: 1,
    openingPrice: "67214.50",
    tick: 1000n,
    lot: 1000n,
    decimals: 6,
  };

  it("two independent IOC takes verify into an open duel, then settle with the chain's winner", async () => {
    const ex = createFakeExchange({
      windows: [liveWindow],
      books: { "BTC#YES": { ask: 0.55 } },
      statusByMarket: { [M]: 1 },
    });
    const up = prepareCall({ live: liveWindow, book: { ask: 0.55 }, stake: 9.9, side: "up", nowSec: 1_000 });
    const down = prepareCall({ live: liveWindow, book: { ask: 0.55 }, stake: 9.24, side: "down", nowSec: 1_100 });
    expect(up.ok && down.ok).toBe(true);
    const challengerHash = await executeCall(ex, liveWindow, up);
    const acceptorHash = await executeCall(ex, liveWindow, down);
    // Each wallet reads its own fill off the tape by the tx it signed.
    const tape = await ex.listFills(CHALLENGER);
    const challengerFilled = filledCall(tape, { side: "up", asset: "BTC", intervalSec: 900, txHash: challengerHash });
    const acceptorFilled = filledCall(tape, { side: "down", asset: "BTC", intervalSec: 900, txHash: acceptorHash });
    expect(challengerFilled).not.toBeNull();
    expect(acceptorFilled).not.toBeNull();

    const hintFromLink: ChallengeHint = {
      marketId: M,
      challenger: CHALLENGER,
      side: "up",
      stake: challengerFilled!.escrow,
      txHash: challengerHash!,
      expiry: liveWindow.expiry,
    };
    const got = readDuel({
      hint: hintFromLink,
      window: { ...liveWindow, status: 1 },
      windowStatus: 1,
      challengerFill: duelFill(CHALLENGER, M, challengerFilled!, 1_000),
      acceptor: ACCEPTOR,
      acceptorFill: duelFill(ACCEPTOR, M, acceptorFilled!, 1_100),
      settlement: { result: "down" },
      nowSec: liveWindow.expiry + 900,
    });
    expect(got.kind).toBe("settled");
    if (got.kind === "settled") {
      expect(got.winner.account).toBe(ACCEPTOR);
      expect(got.winner.txHash).toBe(acceptorHash);
      expect(got.loser.account).toBe(CHALLENGER);
    }
  });

  it("an accept that never filled leaves the duel a challenge, not an open duel", async () => {
    const ex = createFakeExchange({
      windows: [liveWindow],
      books: { "BTC#YES": { ask: 0.55 } },
      statusByMarket: { [M]: 1 },
      iocFills: false,
    });
    const up = prepareCall({ live: liveWindow, book: { ask: 0.55 }, stake: 9.9, side: "up", nowSec: 1_000 });
    expect(up.ok).toBe(true);
    await executeCall(ex, liveWindow, up);
    const tape = await ex.listFills(CHALLENGER);
    const got = readDuel({
      hint: { marketId: M, challenger: CHALLENGER, side: "up", stake: 9.9, txHash: "0xwhatever", expiry: liveWindow.expiry },
      window: { ...liveWindow },
      windowStatus: 1,
      challengerFill: null,
      acceptor: ACCEPTOR,
      acceptorFill: null,
      settlement: null,
      nowSec: 1_200,
    });
    expect(got).toEqual({ kind: "invalid", reason: "missing-fill" });
    expect(tape).toEqual([]);
  });
});

describe("duelRefusalCopy", () => {
  it("speaks every refusal as one honest sentence", () => {
    expect(duelRefusalCopy("bogus" as never)).toBe("This challenge is not open.");
    expect(duelRefusalCopy("self-accept")).toContain("same wallet");
    expect(duelRefusalCopy("missing-fill")).toContain("verified");
    expect(duelRefusalCopy("unknown-market")).toContain("Window");
    expect(duelRefusalCopy("not-trading")).toContain("Trading");
    expect(duelRefusalCopy("no-challenge")).toContain("link");
  });
});
