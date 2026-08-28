import type { BookTop } from "../exchange/port";
import { planCall, type CallSide } from "./call-ticket";

/** Post-only bid in the outcome's own terms. Undefined if it would take or the bid is missing. */
export function restLimit(side: CallSide, book: BookTop): number | undefined {
  const { bid, ask } = book;
  if (bid !== undefined && ask !== undefined && !(bid < ask)) return undefined;
  if (side === "up") return bid;
  return ask !== undefined ? 1 - ask : undefined;
}

export type RestPlan =
  | { ok: false; reason: "no-rest" | "would-take" | "below-lot" | "bad-price" }
  | {
      ok: true;
      side: CallSide;
      price: number;
      contracts: number;
      maxLoss: number;
      sizeRaw: bigint;
      priceRaw: bigint;
    };

export function planRest(input: {
  stake: number;
  book: BookTop;
  side: CallSide;
  decimals: number;
  tick: bigint;
  lot: bigint;
}): RestPlan {
  const { bid, ask } = input.book;
  if (bid !== undefined && ask !== undefined && !(bid < ask)) {
    return { ok: false, reason: "would-take" };
  }
  const limit = restLimit(input.side, input.book);
  if (limit === undefined) return { ok: false, reason: "no-rest" };
  const sized = planCall({
    stake: input.stake,
    upPrice: input.side === "up" ? limit : 1 - limit,
    side: input.side,
    decimals: input.decimals,
    tick: input.tick,
    lot: input.lot,
  });
  if (sized.kind !== "take") return { ok: false, reason: sized.reason };
  return {
    ok: true,
    side: sized.side,
    price: sized.price,
    contracts: sized.contracts,
    maxLoss: sized.maxLoss,
    sizeRaw: sized.sizeRaw,
    priceRaw: sized.priceRaw,
  };
}
