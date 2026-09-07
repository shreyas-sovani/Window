import type { MarketFill } from "../exchange/port";
import { inviteUntil } from "./challenge-link";
import type { FilledCall } from "./filled-call";

export type DuelSide = "up" | "down";

/**
 * Duel — two social opponents on one Window. A wallet Calls a side and shares a
 * challenge link; another wallet Calls the opposite side. Each Call is its own
 * independent IOC book take. The opponents are never each other's exchange
 * counterparty, no pot is matched, and the second fill is never promised. A duel
 * does not exist until two verified fills on the same marketId say so — the URL
 * is a hint; the chain is the truth.
 */

/** One wallet's verified fill on a Window. Chain-shaped: never built from URL fields. */
export type DuelFill = {
  account: string;
  marketId: string;
  side: DuelSide;
  contracts: number;
  avgOdds: number;
  escrow: number;
  txHash: string;
  ts: number;
};

/** Window snapshot the duel is judged against. */
export type DuelWindow = {
  marketId: string;
  asset: string;
  intervalSec: number;
  expiry: number;
  status: number;
  line?: string;
};

export type DuelSettlement = { result: "up" | "down" | "void" | "unknown" };

/** The URL hint — locates the challenger's fill; proves nothing. */
export type ChallengeHint = {
  marketId: string;
  challenger: string;
  side: DuelSide;
  stake: number;
  txHash: string;
  expiry: number;
  /** Intended opponent — when set, only that wallet's fill can accept. */
  to?: string;
  /** Accept escrow must meet this floor. */
  minStake?: number;
  /** Social invite close. Absent on legacy links — those last until Window expiry. */
  until?: number;
};

export type VerifiedChallenge = {
  marketId: string;
  asset: string;
  intervalSec: number;
  expiry: number;
  line?: string;
  challenger: string;
  side: DuelSide;
  stake: number;
  contracts: number;
  avgOdds: number;
  txHash: string;
  to?: string;
  minStake?: number;
  until?: number;
  fillTs?: number;
};

export type OpenDuel = {
  marketId: string;
  asset: string;
  intervalSec: number;
  expiry: number;
  line?: string;
  challengerFill: DuelFill;
  acceptorFill: DuelFill;
};

export type SettledDuel = {
  marketId: string;
  asset: string;
  intervalSec: number;
  expiry: number;
  line?: string;
  winner: DuelFill;
  loser: DuelFill;
};

export type SettledDuelState = { kind: "settled" } & SettledDuel;

export type DuelRefusalReason =
  | "no-challenge"
  | "unknown-market"
  | "missing-fill"
  | "missing-accept-fill"
  | "wrong-market"
  | "wrong-fill"
  | "self-accept"
  | "same-side"
  | "not-your-duel"
  | "below-floor"
  | "invite-expired"
  | "not-trading"
  | "verification-unavailable";

export type Duel =
  | { kind: "invalid"; reason: DuelRefusalReason }
  | { kind: "challenge"; challenge: VerifiedChallenge }
  | { kind: "open"; duel: OpenDuel }
  | SettledDuelState
  | { kind: "void"; duel: OpenDuel }
  | { kind: "expired"; challenge: VerifiedChallenge; cause: "window" | "invite" };

/**
 * When the hint names an invite close, the verified fill time caps a tampered
 * late `until`. Legacy links without `until` last until the Window expires.
 */
function inviteCloseSec(
  challenge: { expiry: number; intervalSec: number; until?: number },
  fillTs: number,
): number | null {
  if (challenge.until === undefined) return null;
  const from = fillTs > 0 ? fillTs : challenge.until;
  return Math.min(
    challenge.until,
    inviteUntil({ windowExpiry: challenge.expiry, fromSec: from, intervalSec: challenge.intervalSec }),
  );
}

/** Lift a tape-verified fill into the chain-shaped duel record. */
export function duelFill(account: string, marketId: string, filled: FilledCall, ts: number): DuelFill {
  return {
    account,
    marketId,
    side: filled.side,
    contracts: filled.contracts,
    avgOdds: filled.avgOdds,
    escrow: filled.escrow,
    txHash: filled.txHash,
    ts,
  };
}

/**
 * Aggregates the pool's public tape into one wallet's duel fill. Matches by
 * marketId first — a sibling Window of the same series is a different market —
 * then by tx hash and/or taker and side. Rows without a side are not a fill.
 */
export function tapeDuelFill(
  rows: MarketFill[],
  match: { marketId: string; txHash?: string; taker?: string; side?: DuelSide },
): DuelFill | null {
  const marketId = match.marketId.toLowerCase();
  let mine = rows.filter((r) => (r.marketId ?? "").toLowerCase() === marketId && r.quantity > 0);
  if (match.txHash) {
    const txHash = match.txHash.toLowerCase();
    mine = mine.filter((r) => r.txHash.toLowerCase() === txHash);
    if (mine.some((r) => !r.taker || !r.aggressor)) return null;
    if (new Set(mine.map((r) => r.aggressor)).size !== 1) return null;
    if (new Set(mine.map((r) => r.taker!.toLowerCase())).size !== 1) return null;
  }
  const wantTaker = match.taker?.toLowerCase();
  if (wantTaker) mine = mine.filter((r) => (r.taker ?? "").toLowerCase() === wantTaker);
  if (match.side) mine = mine.filter((r) => r.aggressor === match.side);
  if (mine.length === 0) return null;
  if (mine.some((r) => !r.taker || !r.aggressor)) return null;
  const proofSides = new Set(mine.map((r) => r.aggressor));
  const proofTakers = new Set(mine.map((r) => r.taker!.toLowerCase()));
  if (proofSides.size !== 1 || proofTakers.size !== 1) return null;
  // One proof is one transaction owned by one wallet on one side. Refuse mixed
  // rows instead of silently merging public activity into a fictional duel leg.
  const side = [...proofSides][0];
  const taker = [...proofTakers][0];
  if (!side || !taker) return null;
  const contracts = mine.reduce((s, r) => s + r.quantity, 0);
  const escrow = mine.reduce((s, r) => s + r.quote, 0);
  if (!(contracts > 0)) return null;
  return {
    account: taker,
    marketId: match.marketId,
    side,
    contracts,
    avgOdds: escrow / contracts,
    escrow,
    txHash: match.txHash ?? mine[0].txHash,
    ts: Math.max(...mine.map((r) => r.ts)),
  };
}

export function verifyChallenge(
  hint: ChallengeHint,
  chain: { window: DuelWindow | null; challengerFill: DuelFill | null },
):
  | { ok: true; challenge: VerifiedChallenge }
  | { ok: false; reason: Extract<DuelRefusalReason, "unknown-market" | "missing-fill" | "wrong-market" | "wrong-fill"> } {
  if (!chain.window || chain.window.marketId !== hint.marketId) return { ok: false, reason: "unknown-market" };
  const fill = chain.challengerFill;
  if (!fill) return { ok: false, reason: "missing-fill" };
  if (fill.marketId !== hint.marketId) return { ok: false, reason: "wrong-market" };
  // The named transaction is the challenge: a different fill by the same wallet
  // on the same market is not the Call this link mints.
  if (fill.txHash.toLowerCase() !== hint.txHash.toLowerCase()) {
    return { ok: false, reason: "wrong-fill" };
  }
  // The fill wins over every URL field: side and stake come from the chain.
  return {
    ok: true,
    challenge: {
      marketId: chain.window.marketId,
      asset: chain.window.asset,
      intervalSec: chain.window.intervalSec,
      expiry: chain.window.expiry,
      line: chain.window.line,
      challenger: fill.account,
      side: fill.side,
      stake: fill.escrow,
      contracts: fill.contracts,
      avgOdds: fill.avgOdds,
      txHash: fill.txHash,
      to: hint.to,
      minStake: hint.minStake,
      until: hint.until,
      fillTs: fill.ts,
    },
  };
}

export function verifyAccept(
  challenge: VerifiedChallenge,
  input: { acceptorFill: DuelFill | null; windowStatus: number },
):
  | { ok: true; duel: OpenDuel }
  | { ok: false; reason: Exclude<DuelRefusalReason, "no-challenge" | "unknown-market"> } {
  const challenger = challenge.challenger.toLowerCase();
  const fill = input.acceptorFill;
  if (!fill) return { ok: false, reason: "missing-fill" };
  // The fill owner is authoritative. `acceptor` may merely be the connected
  // viewer when anyone opens a settled duel link.
  if (fill.account.toLowerCase() === challenger) return { ok: false, reason: "self-accept" };
  if (fill.marketId !== challenge.marketId) return { ok: false, reason: "wrong-market" };
  if (fill.side === challenge.side) return { ok: false, reason: "same-side" };
  // A named challenge is addressed: only the intended wallet's fill accepts —
  // on the live accept path and on any completed proof URL alike.
  if (challenge.to && fill.account.toLowerCase() !== challenge.to.toLowerCase()) {
    return { ok: false, reason: "not-your-duel" };
  }
  // An undershoot is not an accept. A minted link's floor means "the challenger's
  // stake," and the challenger's real stake is on the tape (`challenge.stake`) —
  // so a URL floor can only tighten the floor, never lower it. Legacy v1 links
  // carry no floor and stay floorless.
  if (challenge.minStake !== undefined) {
    const floor = Math.max(challenge.minStake, challenge.stake);
    if (fill.escrow < floor - 1e-6) return { ok: false, reason: "below-floor" };
  }
  const inviteClose = inviteCloseSec(challenge, challenge.fillTs ?? 0);
  if (inviteClose !== null && fill.ts > 0 && fill.ts > inviteClose) {
    return { ok: false, reason: "invite-expired" };
  }
  if (input.windowStatus !== 1) return { ok: false, reason: "not-trading" };
  return {
    ok: true,
    duel: {
      marketId: challenge.marketId,
      asset: challenge.asset,
      intervalSec: challenge.intervalSec,
      expiry: challenge.expiry,
      line: challenge.line,
      // Unequal stakes are allowed and stay visible: two takes, not one matched pot.
      challengerFill: {
        account: challenge.challenger,
        marketId: challenge.marketId,
        side: challenge.side,
        contracts: challenge.contracts,
        avgOdds: challenge.avgOdds,
        escrow: challenge.stake,
        txHash: challenge.txHash,
        ts: 0,
      },
      acceptorFill: fill,
    },
  };
}

export function settleDuel(duel: OpenDuel, settlement: DuelSettlement):
  | SettledDuelState
  | { kind: "void"; duel: OpenDuel }
  | { kind: "open"; duel: OpenDuel } {
  if (settlement.result === "void") return { kind: "void", duel };
  if (settlement.result !== "up" && settlement.result !== "down") return { kind: "open", duel };
  const challengerWins = duel.challengerFill.side === settlement.result;
  const winner = challengerWins ? duel.challengerFill : duel.acceptorFill;
  const loser = challengerWins ? duel.acceptorFill : duel.challengerFill;
  const { challengerFill: _c, acceptorFill: _a, ...rest } = duel;
  return { kind: "settled", ...rest, winner, loser };
}

/**
 * The whole duel state from chain-shaped snapshots. States: challenge (one
 * verified fill, Window still live) → open (two opposite verified fills) →
 * settled | void | expired | invalid. A fill timestamped after expiry is not an
 * accept, and one lonely fill past expiry is an expired challenge — never a win.
 */
export function readDuel(input: {
  hint: ChallengeHint | null;
  window: DuelWindow | null;
  windowStatus: number;
  challengerFill: DuelFill | null;
  acceptorFill: DuelFill | null;
  settlement: DuelSettlement | null;
  nowSec: number;
}): Duel {
  if (!input.hint) return { kind: "invalid", reason: "no-challenge" };
  const verified = verifyChallenge(input.hint, { window: input.window, challengerFill: input.challengerFill });
  if (!verified.ok) return { kind: "invalid", reason: verified.reason };
  const acceptorFill =
    input.acceptorFill && input.acceptorFill.ts <= input.window!.expiry ? input.acceptorFill : null;
  if (acceptorFill) {
    // A fill that landed before expiry is itself proof the pool was Trading
    // then — re-checking today's status would call every settled duel invalid.
    const accepted = verifyAccept(verified.challenge, {
      acceptorFill,
      windowStatus: acceptorFill.ts <= input.window!.expiry ? 1 : input.windowStatus,
    });
    if (!accepted.ok) return { kind: "invalid", reason: accepted.reason };
    return settleDuel(accepted.duel, input.settlement ?? { result: "unknown" });
  }
  const inviteClose = inviteCloseSec(verified.challenge, input.challengerFill?.ts ?? 0);
  if (inviteClose !== null && input.nowSec > inviteClose) {
    return { kind: "expired", challenge: verified.challenge, cause: "invite" };
  }
  if (input.nowSec > input.window!.expiry) {
    return { kind: "expired", challenge: verified.challenge, cause: "window" };
  }
  return { kind: "challenge", challenge: verified.challenge };
}

/**
 * True while the reads that decide a challenge link are still in flight — the
 * UI must say "verifying," never flash a refusal it does not yet have evidence
 * for. A finished read that found nothing is a refusal; a pending read is not.
 */
export function duelReadPending(x: {
  hint: boolean;
  marketLoading: boolean;
  window: DuelWindow | null;
  tapeLoading: boolean;
}): boolean {
  if (!x.hint) return false;
  if (x.marketLoading && !x.window) return true;
  return Boolean(x.window) && x.tapeLoading;
}

export function duelRefusalCopy(reason: DuelRefusalReason): string {
  switch (reason) {
    case "no-challenge":
      return "There is no challenge in this link.";
    case "unknown-market":
      return "That Window is not on this chain.";
    case "missing-fill":
      return "The challenger's fill could not be verified on-chain.";
    case "missing-accept-fill":
      return "The accepting transaction could not be verified on this Window.";
    case "wrong-market":
      return "That fill belongs to a different Window.";
    case "wrong-fill":
      return "That fill is not the transaction this challenge names.";
    case "self-accept":
      return "The same wallet cannot accept its own challenge.";
    case "same-side":
      return "Duels take opposite sides — this wallet already holds that side.";
    case "not-your-duel":
      return "This challenge is addressed to another wallet.";
    case "below-floor":
      return "That fill staked less than the challenge floor, so it is not an accept.";
    case "invite-expired":
      return "That fill landed after the invite closed, so it is not an accept.";
    case "not-trading":
      return "The Window is not Trading, so a new Call cannot cross.";
    case "verification-unavailable":
      return "Chain verification is temporarily unavailable. No challenge result was inferred.";
    default:
      return "This challenge is not open.";
  }
}
