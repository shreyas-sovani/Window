import { settleDuel, type DuelFill, type OpenDuel, type SettledDuelState } from "./duel";

/**
 * Judge replay — reconstruct one real duel from a pinned marketId, two tx
 * hashes, and the finalized outcome. Everything is fail-closed: a hash that is
 * not a fill on that market, a fill with no wallet or side, one wallet on both
 * ends, or a missing outcome refuses rather than guessing. No fills are
 * invented.
 */

export type ReplayRow = {
  txHash: string;
  marketId?: string;
  taker?: string | null;
  side: "up" | "down" | null;
  quantity: number;
  price: number;
  ts: number;
};

export type ReplayOutcome = "up" | "down" | "void";

export type ReplayRefusal =
  | "no-fill-a"
  | "no-fill-b"
  | "unknown-wallet"
  | "unknown-side"
  | "same-wallet"
  | "same-side"
  | "missing-outcome";

type Leg = { fill: DuelFill };

function leg(
  rows: ReplayRow[],
  txHash: string,
  meta: { marketId: string; asset?: string; intervalSec?: number; expiry?: number },
  err: ReplayRefusal,
): { ok: true; leg: Leg } | { ok: false; reason: ReplayRefusal } {
  const mine = rows.filter((r) => r.txHash === txHash && r.quantity > 0);
  if (mine.length === 0) return { ok: false, reason: err };
  const taker = mine.find((r) => r.taker)?.taker ?? null;
  if (!taker) return { ok: false, reason: "unknown-wallet" };
  const side = mine.find((r) => r.side)?.side ?? null;
  if (!side) return { ok: false, reason: "unknown-side" };
  const contracts = mine.reduce((s, r) => s + r.quantity, 0);
  const escrow = mine.reduce((s, r) => s + r.quantity * r.price, 0);
  return {
    ok: true,
    leg: {
      fill: {
        account: taker,
        marketId: meta.marketId,
        side,
        contracts,
        avgOdds: escrow / contracts,
        escrow,
        txHash,
        ts: Math.max(...mine.map((r) => r.ts)),
      },
    },
  };
}

export function replayDuel(
  input: {
    marketId: string;
    txA: string;
    txB: string;
    outcome: ReplayOutcome | "";
    meta?: { asset?: string; intervalSec?: number; expiry?: number; line?: string };
  },
  rows: ReplayRow[],
):
  | { ok: true; verdict: SettledDuelState | { kind: "void"; duel: OpenDuel } }
  | { ok: false; reason: ReplayRefusal } {
  if (!input.outcome) return { ok: false, reason: "missing-outcome" };
  // Only fills this indexer says happened on the pinned market count.
  const onMarket = rows.filter((r) => !r.marketId || r.marketId === input.marketId);
  const a = leg(onMarket, input.txA, input, "no-fill-a");
  if (!a.ok) return a;
  const b = leg(onMarket, input.txB, input, "no-fill-b");
  if (!b.ok) return b;
  if (a.leg.fill.account === b.leg.fill.account) return { ok: false, reason: "same-wallet" };
  if (a.leg.fill.side === b.leg.fill.side) return { ok: false, reason: "same-side" };
  const [challengerFill, acceptorFill] =
    a.leg.fill.ts <= b.leg.fill.ts ? [a.leg.fill, b.leg.fill] : [b.leg.fill, a.leg.fill];
  const duel: OpenDuel = {
    marketId: input.marketId,
    asset: input.meta?.asset ?? "",
    intervalSec: input.meta?.intervalSec ?? 0,
    expiry: input.meta?.expiry ?? 0,
    line: input.meta?.line,
    challengerFill,
    acceptorFill,
  };
  if (input.outcome === "void") return { ok: true, verdict: { kind: "void", duel } };
  const settled = settleDuel(duel, { result: input.outcome });
  if (settled.kind === "settled") return { ok: true, verdict: settled };
  return { ok: false, reason: "missing-outcome" };
}

export function replayRefusalCopy(reason: ReplayRefusal): string {
  switch (reason) {
    case "no-fill-a":
      return "The first transaction hash is not a verified fill on that market — nothing is reconstructed.";
    case "no-fill-b":
      return "The second transaction hash is not a verified fill on that market — nothing is reconstructed.";
    case "unknown-wallet":
      return "The tape does not name the wallet behind one of those fills.";
    case "unknown-side":
      return "The tape does not say which side one of those fills took.";
    case "same-wallet":
      return "Both hashes are one wallet — a duel needs two.";
    case "same-side":
      return "Both fills took the same side — a duel needs opposite sides.";
    case "missing-outcome":
      return "Pin the finalized outcome (Up, Down, or Void) before replaying.";
    default:
      return "This replay cannot be verified — nothing is reconstructed.";
  }
}
