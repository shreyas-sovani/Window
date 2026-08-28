import { planClaims, type OutcomeIdx } from "./claim-plan";

export type SettledWindow = {
  marketId: `0x${string}`;
  market: `0x${string}`;
  expiry: number;
  isResolved: boolean;
  isVoided: boolean;
  winningOutcome: number | null;
  up: bigint;
  down: bigint;
};

export type ClaimIntent = {
  marketId: `0x${string}`;
  market: `0x${string}`;
  outcomeIdx: OutcomeIdx;
  amount: bigint;
};

export type ClaimWriter = {
  redeem(intent: ClaimIntent): Promise<void>;
};

function asOutcome(n: number | null): OutcomeIdx | null {
  return n === 0 || n === 1 ? n : null;
}

/** Newest-expired first, then ClaimPlan per Window. Cap is on Windows scanned, not intents. */
export function planClaimSession(rows: SettledWindow[], limit = 40): ClaimIntent[] {
  const scanned = [...rows].sort((a, b) => b.expiry - a.expiry).slice(0, limit);
  const intents: ClaimIntent[] = [];
  for (const row of scanned) {
    const plan = planClaims({
      isResolved: row.isResolved,
      isVoided: row.isVoided,
      winningOutcome: row.isResolved ? asOutcome(row.winningOutcome) : null,
      up: row.up,
      down: row.down,
    });
    for (const r of plan) {
      intents.push({
        marketId: row.marketId,
        market: row.market,
        outcomeIdx: r.outcomeIdx,
        amount: r.amount,
      });
    }
  }
  return intents;
}

export async function executeClaims(writer: ClaimWriter, intents: ClaimIntent[]): Promise<number> {
  for (const intent of intents) {
    await writer.redeem(intent);
  }
  return intents.length;
}
