import type { BookTop, LiveWindow, StakeQuote } from "../exchange/port";
import { planCall, type CallPlan, type CallSide } from "./call-ticket";
import { impliedUp } from "./implied";
import { callability } from "./lifecycle";
import { planRest, type RestPlan } from "./rest-quote";

export type PreparedCall =
  | { ok: false; reason: "no-window" | "not-trading" | "too-close" | "below-lot" | "bad-price" }
  | { ok: true; symbol: string; plan: Extract<CallPlan, { kind: "take" }> };

export type PreparedRest =
  | { ok: false; reason: "no-window" | "not-trading" | "too-close" | Extract<RestPlan, { ok: false }>["reason"] }
  | { ok: true; symbol: string; plan: Extract<RestPlan, { ok: true }> };

export type PreparedExit =
  | { ok: false; reason: "no-window" | "empty" | "bad-price" }
  | { ok: true; symbol: string; contracts: number; price: number };

/** Writes the Call session needs immediately before an IOC. */
export type CallWriter = {
  onchainStatus(marketId: `0x${string}`): Promise<number>;
  iocBuy(symbol: string, contracts: number, price: number): Promise<string | undefined>;
  iocSell(symbol: string, contracts: number, price: number): Promise<string | undefined>;
  restBuy(symbol: string, contracts: number, price: number): Promise<string | undefined>;
};

function outcomeSymbol(live: LiveWindow, side: CallSide): string {
  return side === "up" ? live.upSymbol : (live.downSymbol ?? live.upSymbol);
}

export function prepareCall(input: {
  live: LiveWindow | null;
  book: BookTop | undefined;
  stake: number;
  side: CallSide;
  nowSec: number;
}): PreparedCall {
  if (!input.live) return { ok: false, reason: "no-window" };
  const gate = callability({
    status: input.live.status,
    nowSec: input.nowSec,
    expirySec: input.live.expiry,
    intervalSec: input.live.intervalSec,
  });
  if (!gate.callable) return { ok: false, reason: gate.reason };
  const upPrice = impliedUp(input.book);
  if (upPrice === undefined) return { ok: false, reason: "bad-price" };
  const plan = planCall({
    stake: input.stake,
    upPrice,
    side: input.side,
    decimals: input.live.decimals,
    tick: input.live.tick,
    lot: input.live.lot,
  });
  if (plan.kind !== "take") return { ok: false, reason: plan.reason };
  return { ok: true, symbol: outcomeSymbol(input.live, input.side), plan };
}

export function prepareQuotedCall(input: {
  live: LiveWindow | null;
  side: CallSide;
  nowSec: number;
  quote: StakeQuote | null;
}): PreparedCall {
  if (!input.live) return { ok: false, reason: "no-window" };
  const gate = callability({
    status: input.live.status,
    nowSec: input.nowSec,
    expirySec: input.live.expiry,
    intervalSec: input.live.intervalSec,
  });
  if (!gate.callable) return { ok: false, reason: gate.reason };
  if (!input.quote || input.quote.quantity === 0n) return { ok: false, reason: "below-lot" };
  if (input.quote.limitPrice <= 0n) return { ok: false, reason: "bad-price" };
  const scale = 10 ** input.live.decimals;
  const contracts = Number(input.quote.quantity) / scale;
  return {
    ok: true,
    symbol: outcomeSymbol(input.live, input.side),
    plan: {
      kind: "take",
      side: input.side,
      price: Number(input.quote.limitPrice) / scale,
      contracts,
      maxLoss: Number(input.quote.escrow) / scale,
      payoutIfWin: contracts,
      sizeRaw: input.quote.quantity,
      priceRaw: input.quote.limitPrice,
    },
  };
}

export function prepareRest(input: {
  live: LiveWindow | null;
  book: BookTop | undefined;
  stake: number;
  side: CallSide;
  nowSec: number;
}): PreparedRest {
  if (!input.live) return { ok: false, reason: "no-window" };
  const gate = callability({
    status: input.live.status,
    nowSec: input.nowSec,
    expirySec: input.live.expiry,
    intervalSec: input.live.intervalSec,
  });
  if (!gate.callable) return { ok: false, reason: gate.reason };
  const plan = planRest({
    stake: input.stake,
    book: input.book ?? {},
    side: input.side,
    decimals: input.live.decimals,
    tick: input.live.tick,
    lot: input.live.lot,
  });
  if (!plan.ok) return plan;
  return { ok: true, symbol: outcomeSymbol(input.live, input.side), plan };
}

export function prepareExit(input: {
  live: LiveWindow | null;
  book: BookTop | undefined;
  side: CallSide;
  up: bigint;
  down: bigint;
  decimals: number;
}): PreparedExit {
  if (!input.live) return { ok: false, reason: "no-window" };
  const raw = input.side === "up" ? input.up : input.down;
  if (raw === 0n) return { ok: false, reason: "empty" };
  const upPx = input.book?.bid ?? input.book?.ask;
  if (upPx === undefined) return { ok: false, reason: "bad-price" };
  return {
    ok: true,
    symbol: outcomeSymbol(input.live, input.side),
    contracts: Number(raw) / 10 ** input.decimals,
    price: input.side === "up" ? upPx : 1 - upPx,
  };
}

export async function executeCall(writer: CallWriter, live: LiveWindow, intent: PreparedCall) {
  if (!intent.ok) throw new Error("Call is not sized");
  const status = await writer.onchainStatus(live.marketId);
  if (status !== 1) throw new Error("Window is not Trading");
  return writer.iocBuy(intent.symbol, intent.plan.contracts, intent.plan.price);
}

export async function executeExit(writer: CallWriter, live: LiveWindow, intent: PreparedExit) {
  if (!intent.ok) throw new Error("nothing to exit");
  const status = await writer.onchainStatus(live.marketId);
  if (status !== 1) throw new Error("Window is not Trading");
  return writer.iocSell(intent.symbol, intent.contracts, intent.price);
}

export async function executeRest(writer: CallWriter, live: LiveWindow, intent: PreparedRest) {
  if (!intent.ok) throw new Error("Rest is not sized");
  const status = await writer.onchainStatus(live.marketId);
  if (status !== 1) throw new Error("Window is not Trading");
  return writer.restBuy(intent.symbol, intent.plan.contracts, intent.plan.price);
}

export function callSkipCopy(reason: Extract<PreparedCall, { ok: false }>["reason"]): string {
  switch (reason) {
    case "no-window":
      return "No live Window for this series.";
    case "not-trading":
      return "Window is not Trading.";
    case "too-close":
      return "Too close to lock to send a new Call.";
    case "below-lot":
      return "Stake is below one lot. Increase the amount.";
    case "bad-price":
      return "Odds are not tradable yet. Wait for a book.";
  }
}

export function restSkipCopy(reason: Extract<PreparedRest, { ok: false }>["reason"]): string {
  switch (reason) {
    case "no-window":
      return "No live Window for this series.";
    case "not-trading":
      return "Window is not Trading.";
    case "too-close":
      return "Too close to lock to rest a bid.";
    case "no-rest":
      return "No bid to join. Wait for a book, or Call instead.";
    case "would-take":
      return "That price would take. Call Up/Down if you want a fill now.";
    case "below-lot":
      return "Stake is below one lot. Increase the amount.";
    case "bad-price":
      return "Odds are not tradable yet. Wait for a book.";
  }
}
