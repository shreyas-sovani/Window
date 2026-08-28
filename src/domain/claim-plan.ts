export type OutcomeIdx = 0 | 1;

export type Redeem = { outcomeIdx: OutcomeIdx; amount: bigint };

export function planClaims(input: {
  isResolved: boolean;
  isVoided: boolean;
  winningOutcome: OutcomeIdx | null;
  up: bigint;
  down: bigint;
}): Redeem[] {
  const held: Record<OutcomeIdx, bigint> = { 0: input.up, 1: input.down };
  const idxs: OutcomeIdx[] = input.isVoided
    ? [0, 1]
    : input.isResolved && input.winningOutcome !== null
      ? [input.winningOutcome]
      : [];
  return idxs.filter((i) => held[i] > 0n).map((outcomeIdx) => ({ outcomeIdx, amount: held[outcomeIdx] }));
}
