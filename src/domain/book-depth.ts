export type BookLevelRaw = { price: bigint; quantity: bigint };

export type DepthLevel = {
  upPrice: number;
  downPrice: number;
  contracts: number;
  cumContracts: number;
};

export type BookDepth = {
  bids: DepthLevel[];
  asks: DepthLevel[];
  empty: boolean;
};

const DEFAULT_LEVELS = 5;

function take(levels: BookLevelRaw[], decimals: number, max: number): DepthLevel[] {
  const scale = 10 ** decimals;
  const one = 10n ** BigInt(decimals);
  const out: DepthLevel[] = [];
  let cum = 0;
  for (const row of levels) {
    if (row.quantity <= 0n || row.price <= 0n || row.price >= one) continue;
    const upPrice = Number(row.price) / scale;
    const contracts = Number(row.quantity) / scale;
    cum += contracts;
    out.push({
      upPrice,
      downPrice: Number(one - row.price) / scale,
      contracts,
      cumContracts: cum,
    });
    if (out.length >= max) break;
  }
  return out;
}

/** Up-book depth for the drawer. Down price is always 1 − Up. */
export function readBookDepth(input: {
  bids: BookLevelRaw[];
  asks: BookLevelRaw[];
  decimals: number;
  maxLevels?: number;
}): BookDepth {
  const max = input.maxLevels ?? DEFAULT_LEVELS;
  const bids = take(input.bids, input.decimals, max);
  const asks = take(input.asks, input.decimals, max);
  return { bids, asks, empty: bids.length === 0 && asks.length === 0 };
}

export function summarizeDepth(depth: BookDepth): string {
  if (depth.empty) return "empty";
  const bids = `${depth.bids.length} ${depth.bids.length === 1 ? "bid" : "bids"}`;
  const asks = `${depth.asks.length} ${depth.asks.length === 1 ? "ask" : "asks"}`;
  return `${bids} · ${asks}`;
}
