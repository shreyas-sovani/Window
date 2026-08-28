export type SettlePreview = {
  ifUp: bigint;
  ifDown: bigint;
  ifVoid: bigint;
  empty: boolean;
};

function winnerPayout(amount: bigint, feeBps: bigint): bigint {
  const fee = feeBps < 0n ? 0n : feeBps;
  return (amount * (10_000n - fee)) / 10_000n;
}

/** Collateral this Call pays if the Window resolves Up, Down, or Void. */
export function settlePreview(input: { up: bigint; down: bigint; feeBps?: bigint }): SettlePreview {
  const fee = input.feeBps ?? 0n;
  return {
    ifUp: winnerPayout(input.up, fee),
    ifDown: winnerPayout(input.down, fee),
    ifVoid: input.up / 2n + input.down / 2n,
    empty: input.up === 0n && input.down === 0n,
  };
}

export function settlePreviewCopy(preview: SettlePreview, decimals: number, feeBps = 0n): string {
  if (preview.empty) return "";
  const scale = 10 ** decimals;
  const n = (raw: bigint) => Number(raw) / scale;
  const fee = feeBps > 0n ? ` · venue fee ${Number(feeBps) / 100}% on wins` : "";
  return `If Up wins ${n(preview.ifUp)} · If Down wins ${n(preview.ifDown)} · If Void ${n(preview.ifVoid)} tUSDC${fee}`;
}

/** Indexer `settlementFeeBps` is a decimal string; 1 = 0.01%. Missing plumbing is 0. */
export function parseSettlementFeeBps(raw: string | null | undefined): bigint {
  if (raw == null || raw === "") return 0n;
  try {
    const n = BigInt(raw);
    return n < 0n ? 0n : n;
  } catch {
    return 0n;
  }
}
