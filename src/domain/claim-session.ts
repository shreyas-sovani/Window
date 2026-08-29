import { planClaims, type OutcomeIdx } from "./claim-plan";
import { settlePreview } from "./settle-preview";

export type SettledWindow = {
  marketId: `0x${string}`;
  market: `0x${string}`;
  expiry: number;
  isResolved: boolean;
  isVoided: boolean;
  winningOutcome: number | null;
  up: bigint;
  down: bigint;
  /** Per-Window venue fee; overrides the session-wide fallback when present. */
  feeBps?: bigint;
};

export type ClaimIntent = {
  marketId: `0x${string}`;
  market: `0x${string}`;
  outcomeIdx: OutcomeIdx;
  amount: bigint;
};

export type ClaimWriter = {
  redeem(intent: ClaimIntent): Promise<string | undefined>;
};

export type ClaimPreview = {
  count: number;
  windows: number;
  payout: bigint;
};

export type ClaimReceipt = ClaimPreview & { txHash?: string; failed: number };

export type ClaimHeld = {
  marketId: `0x${string}`;
  intents: ClaimIntent[];
  payout: bigint;
};

export type ClaimSession = {
  intents: ClaimIntent[];
  windows: number;
  payout: bigint;
  held: ClaimHeld[];
};

function asOutcome(n: number | null): OutcomeIdx | null {
  return n === 0 || n === 1 ? n : null;
}

function rowPayout(row: SettledWindow, feeBps: bigint): bigint {
  const preview = settlePreview({ up: row.up, down: row.down, feeBps: row.feeBps ?? feeBps });
  if (row.isVoided) return preview.ifVoid;
  if (row.winningOutcome === 0) return preview.ifUp;
  if (row.winningOutcome === 1) return preview.ifDown;
  return 0n;
}

/** Newest-expired first, then ClaimPlan per Window. Cap is on Windows scanned, not intents. */
export function planClaimSession(rows: SettledWindow[], limit = 40): ClaimIntent[] {
  return readClaimSession(rows, limit).intents;
}

/** Unique Windows with a redeem, plus expected collateral (winner fee-adjusted, void at half). */
export function readClaimSession(rows: SettledWindow[], limit = 40, feeBps = 0n): ClaimSession {
  const scanned = [...rows].sort((a, b) => b.expiry - a.expiry).slice(0, limit);
  const intents: ClaimIntent[] = [];
  const held: ClaimHeld[] = [];
  let payout = 0n;
  for (const row of scanned) {
    const plan = planClaims({
      isResolved: row.isResolved,
      isVoided: row.isVoided,
      winningOutcome: row.isResolved ? asOutcome(row.winningOutcome) : null,
      up: row.up,
      down: row.down,
    });
    if (plan.length === 0) continue;
    const windowIntents: ClaimIntent[] = plan.map((r) => ({
      marketId: row.marketId,
      market: row.market,
      outcomeIdx: r.outcomeIdx,
      amount: r.amount,
    }));
    const windowPayout = rowPayout(row, feeBps);
    held.push({ marketId: row.marketId, intents: windowIntents, payout: windowPayout });
    payout += windowPayout;
    intents.push(...windowIntents);
  }
  return { intents, windows: held.length, payout, held };
}

export async function executeClaims(writer: ClaimWriter, session: ClaimSession): Promise<ClaimReceipt> {
  let txHash: string | undefined;
  let lastError: unknown;
  let count = 0;
  let payout = 0n;
  let windows = 0;
  let failed = 0;
  for (const win of session.held) {
    try {
      for (const intent of win.intents) {
        const hash = await writer.redeem(intent);
        if (hash) txHash = hash;
        count += 1;
      }
      windows += 1;
      payout += win.payout;
    } catch (e) {
      lastError = e;
      failed += 1;
    }
  }
  if (windows === 0 && lastError !== undefined) throw lastError;
  return { count, windows, payout, failed, txHash };
}

function humanAmount(payout: bigint, decimals: number): string {
  return String(Number((Number(payout) / 10 ** decimals).toFixed(2)));
}

function windowNoun(windows: number): string {
  return windows === 1 ? "1 Window" : `${windows} Windows`;
}

const EMPTY_CLAIM = "Nothing to claim in the 40 most recently finalized Windows.";

/** Tote primary: Windows + expected tUSDC. Empty scan is a sentence, not a button label. */
export function claimSessionCopy(session: { windows: number; payout: bigint }, decimals = 6): string {
  if (session.windows <= 0) return EMPTY_CLAIM;
  const noun = windowNoun(session.windows);
  return session.payout > 0n ? `Claim ${noun} · ${humanAmount(session.payout, decimals)} tUSDC` : `Claim ${noun}`;
}

/** Toast after executeClaims. */
export function claimReceiptCopy(
  session: { windows: number; payout: bigint; failed?: number },
  decimals = 6,
): string {
  if (session.windows <= 0) return EMPTY_CLAIM;
  const noun = windowNoun(session.windows);
  const main =
    session.payout > 0n
      ? `Claimed ${noun} · ${humanAmount(session.payout, decimals)} tUSDC.`
      : `Claimed ${noun}.`;
  if (!session.failed) return main;
  return `${main} ${windowNoun(session.failed)} could not be claimed.`;
}
