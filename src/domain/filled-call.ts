import type { LiveWindow, MarketFill, WalletFill } from "../exchange/port";
import { canonicalInterval } from "./series";
import { tapeDuelFill } from "./duel";
import type { CallReceipt } from "./proof-card";

/** A Call the chain says filled — the only thing receipts, rolls, and challenges may be built from. */
export type FilledCall = {
  side: "up" | "down";
  contracts: number;
  avgOdds: number;
  escrow: number;
  txHash: string;
  /** Tape rows that made this receipt. */
  proofs: WalletFill[];
};

export type FilledCallMatch = {
  side: "up" | "down";
  asset: string;
  intervalSec: number;
  marketId?: string;
  txHash?: string;
  sinceSec?: number;
};

/**
 * Reads a Call's actual fill off the wallet tape. With a tx hash it aggregates
 * that transaction's fills for the called side; without one it takes everything
 * the tape recorded on that side and series since the write started. No matching
 * row — or nothing filled — is null: an intent, a signed tx, or a URL field is
 * never a receipt.
 */
export function filledCall(
  tape: WalletFill[],
  match: FilledCallMatch,
): FilledCall | null {
  const cadence = canonicalInterval(match.intervalSec);
  let rows = tape.filter(
    (r) =>
      r.side === match.side &&
      r.asset === match.asset &&
      canonicalInterval(r.intervalSec) === cadence &&
      r.quantity > 0 &&
      (!match.marketId || r.marketId === match.marketId),
  );
  const since = match.sinceSec;
  if (match.txHash) {
    rows = rows.filter((r) => r.txHash === match.txHash);
  } else if (since !== undefined) {
    rows = rows.filter((r) => r.timestamp >= since);
  } else if (!match.marketId) {
    // A bare series match is not a locator — refuse rather than sum a series.
    return null;
  }
  if (rows.length === 0) return null;
  const contracts = rows.reduce((sum, r) => sum + r.quantity, 0);
  const escrow = rows.reduce((sum, r) => sum + r.quote, 0);
  if (!(contracts > 0)) return null;
  return {
    side: match.side,
    contracts,
    avgOdds: escrow / contracts,
    escrow,
    txHash: match.txHash ?? rows[0].txHash,
    proofs: rows,
  };
}

/**
 * Verifies a fill from the pool's public tape — the second, independent source.
 * The portfolio read (`getPortfolio`) is an indexer aggregation that can trail
 * or skip a venue's fills entirely; the pool tape is keyed by pool and carries
 * taker, side, and marketId. Same rule as everywhere: no matching rows, no
 * receipt — never a proof from a transaction hash alone.
 */
export function filledCallFromTape(
  rows: MarketFill[],
  match: { marketId: string; txHash: string; taker: string; side: "up" | "down" },
): FilledCall | null {
  const fill = tapeDuelFill(rows, match);
  if (!fill) return null;
  return {
    side: fill.side,
    contracts: fill.contracts,
    avgOdds: fill.avgOdds,
    escrow: fill.escrow,
    txHash: fill.txHash,
    proofs: [],
  };
}

export type FillConfirmation =
  | { kind: "verified"; filled: FilledCall }
  | { kind: "unfilled" }
  | { kind: "unavailable" };

/** Bounded indexer confirmation after a write; transport failure is not an empty fill. */
export async function confirmFilledCall(
  readTape: () => Promise<WalletFill[]>,
  match: FilledCallMatch,
  opts: { attempts?: number; delayMs?: number } = {},
): Promise<FillConfirmation> {
  // Shannon's indexer can trail the explorer by well over the old ~4.5s window;
  // a real on-chain fill that reports "unverified" loses its receipt and
  // challenge forever, so the default window is ten reads with a growing delay.
  const attempts = Math.max(1, opts.attempts ?? 10);
  const delayMs = Math.max(0, opts.delayMs ?? 900);
  let successfulReads = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const filled = filledCall(await readTape(), match);
      successfulReads += 1;
      if (filled) return { kind: "verified", filled };
    } catch {
      // Keep trying: the indexer can briefly lag or reject a read after the tx lands.
    }
    if (attempt + 1 < attempts && delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return successfulReads > 0 ? { kind: "unfilled" } : { kind: "unavailable" };
}

/** The witnessed-fill receipt: every number comes from the tape, none from the intent. */
export function callReceiptFromFill(live: LiveWindow, filled: FilledCall, nowSec: number): CallReceipt {
  return {
    asset: live.asset,
    intervalSec: live.intervalSec,
    side: filled.side,
    line: live.openingPrice,
    expiry: live.expiry,
    stake: filled.escrow,
    contracts: filled.contracts,
    avgOdds: filled.avgOdds,
    payoutIfWin: filled.contracts,
    maxLoss: filled.escrow,
    txHash: filled.txHash,
    marketId: live.marketId,
    ts: nowSec,
  };
}
