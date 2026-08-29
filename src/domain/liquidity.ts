import type { BookDepth, DepthLevel } from "./book-depth";

export type FillEstimate = {
  side: "up" | "down";
  /** Stake the walked depth can absorb for this request. */
  stake: number;
  contracts: number;
  avgOdds: number;
  /** Requested stake the walked depth could not cover. */
  unfilledStake: number;
  /** Whole walked-depth ceiling for "use max". */
  maxStake: number;
  maxContracts: number;
};

/** Executable levels for a buy: Up walks YES asks cheapest-first; Down walks NO asks = 1 − YES bids, best first. */
function sideLevels(depth: BookDepth, side: "up" | "down"): { price: number; contracts: number }[] {
  const raw: DepthLevel[] = side === "up" ? depth.asks : depth.bids;
  return raw
    .filter((l) => l.contracts > 0 && l.upPrice > 0 && l.upPrice < 1)
    .map((l) => ({ price: side === "up" ? l.upPrice : l.downPrice, contracts: l.contracts }))
    .sort((a, b) => a.price - b.price);
}

/** Walk the top-of-book levels for a requested stake. An estimate, never a promise — the Call still sends a protective limit. */
export function fillEstimate(depth: BookDepth, side: "up" | "down", stake: number): FillEstimate | null {
  const levels = sideLevels(depth, side);
  if (levels.length === 0) return null;

  const walk = (budget: number): { cost: number; contracts: number } => {
    let remaining = budget;
    let cost = 0;
    let contracts = 0;
    for (const l of levels) {
      if (remaining <= 1e-9) break;
      const levelCost = l.contracts * l.price;
      if (levelCost <= remaining) {
        cost += levelCost;
        contracts += l.contracts;
        remaining -= levelCost;
      } else {
        const take = remaining / l.price;
        cost += remaining;
        contracts += take;
        remaining = 0;
      }
    }
    return { cost, contracts };
  };

  const max = walk(Number.POSITIVE_INFINITY);
  const req = walk(Math.max(0, stake));
  const requested = Math.max(0, stake);
  return {
    side,
    stake: req.cost,
    contracts: req.contracts,
    avgOdds: req.contracts > 0 ? req.cost / req.contracts : 0,
    unfilledStake: Math.max(0, requested - req.cost),
    maxStake: max.cost,
    maxContracts: max.contracts,
  };
}

export function fillCopy(est: FillEstimate): string {
  const pct = `${Math.round(est.avgOdds * 100)}%`;
  const head = `est. fill ${est.stake.toFixed(1)} tUSDC @ ~${pct} (avg of book levels)`;
  const tail =
    est.unfilledStake > 0.005
      ? ` · ≈${est.unfilledStake.toFixed(1)} tUSDC may not fill at these levels`
      : "";
  return `${head}${tail}`;
}
