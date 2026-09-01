import type { LiveWindow, WalletFill } from "../exchange/port";
import { canonicalInterval } from "./series";
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

/**
 * Reads a Call's actual fill off the wallet tape. With a tx hash it aggregates
 * that transaction's fills for the called side; without one it takes everything
 * the tape recorded on that side and series since the write started. No matching
 * row — or nothing filled — is null: an intent, a signed tx, or a URL field is
 * never a receipt.
 */
export function filledCall(
  tape: WalletFill[],
  match: {
    side: "up" | "down";
    asset: string;
    intervalSec: number;
    marketId?: string;
    txHash?: string;
    sinceSec?: number;
  },
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
