import { quantizePrice, quantizeSize } from "./grid";

export type CallSide = "up" | "down";

export type CallPlan =
  | { kind: "skip"; reason: "below-lot" | "bad-price" }
  | {
      kind: "take";
      side: CallSide;
      price: number;
      contracts: number;
      maxLoss: number;
      payoutIfWin: number;
      sizeRaw: bigint;
      priceRaw: bigint;
    };

function human(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

/** Convert user-entered collateral without scientific notation or unsafe integers. */
export function stakeUnits(stake: number, decimals: number): bigint {
  if (!Number.isFinite(stake) || !(stake > 0)) return 0n;
  const scaled = Math.floor(stake * 10 ** decimals);
  return Number.isSafeInteger(scaled) && scaled > 0 ? BigInt(scaled) : 0n;
}

export function planCall(input: {
  stake: number;
  upPrice: number;
  side: CallSide;
  decimals: number;
  tick: bigint;
  lot: bigint;
}): CallPlan {
  const px = input.side === "up" ? input.upPrice : 1 - input.upPrice;
  if (!(px > 0) || !(px < 1) || !(input.stake > 0)) {
    return { kind: "skip", reason: "bad-price" };
  }

  const scale = 10 ** input.decimals;
  const priceRaw = quantizePrice(BigInt(Math.round(px * scale)), input.tick);
  if (priceRaw <= 0n) return { kind: "skip", reason: "bad-price" };

  const stakeRaw = stakeUnits(input.stake, input.decimals);
  if (stakeRaw === 0n) return { kind: "skip", reason: "below-lot" };
  const sizeRaw = quantizeSize((stakeRaw * 10n ** BigInt(input.decimals)) / priceRaw, input.lot);
  if (sizeRaw === 0n) return { kind: "skip", reason: "below-lot" };

  const contracts = human(sizeRaw, input.decimals);
  const maxLoss = human((sizeRaw * priceRaw) / 10n ** BigInt(input.decimals), input.decimals);
  return {
    kind: "take",
    side: input.side,
    price: human(priceRaw, input.decimals),
    contracts,
    maxLoss,
    payoutIfWin: contracts,
    sizeRaw,
    priceRaw,
  };
}
