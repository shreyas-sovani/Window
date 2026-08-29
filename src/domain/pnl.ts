import type { PositionPnl, WalletFill } from "../exchange/port";
import { cadenceLabel, canonicalInterval } from "./series";

/** Signed collateral cashflow of one fill from this wallet's perspective. Buy = negative. */
export function fillCashflow(f: WalletFill): number | null {
  if (f.direction === null || f.side === null || !Number.isFinite(f.quote)) return null;
  return f.direction === "buy" ? -f.quote : f.quote;
}

export type TapeRow = WalletFill & { cashflow: number };

/** Newest-first trade tape; rows without an attributed side are dropped (they cannot be signed). */
export function sessionTape(fills: WalletFill[], limit = 8): TapeRow[] {
  return fills
    .filter((f) => fillCashflow(f) !== null)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .map((f) => ({ ...f, cashflow: fillCashflow(f) as number }));
}

export type PnlTotals = {
  realized: number;
  unrealized: number;
  net: number;
  /** Net signed cashflow across the recent tape. */
  flow: number;
};

/** Sum P&L across positions (each normalized by its own decimals — venues differ) plus tape flow. */
export function pnlTotals(positions: PositionPnl[], fills: WalletFill[] = []): PnlTotals {
  let realized = 0;
  let unrealized = 0;
  for (const p of positions) {
    const scale = 10 ** p.decimals;
    realized += Number(p.realizedPnl) / scale;
    unrealized += Number(p.unrealizedPnl) / scale;
  }
  let flow = 0;
  for (const f of fills) {
    const c = fillCashflow(f);
    if (c !== null) flow += c;
  }
  return { realized, unrealized, net: realized + unrealized, flow };
}

function signed(n: number, d = 2): string {
  const abs = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${abs}`;
}

export function pnlCopy(t: PnlTotals): string {
  if (t.realized === 0 && t.unrealized === 0 && t.net === 0) return "P&L 0.00 tUSDC";
  return `P&L ${signed(t.realized)} unrealized ${signed(t.unrealized)} · net ${signed(t.net)} tUSDC`;
}

function inSeries(row: { asset: string; intervalSec: number }, asset: string, intervalSec: number): boolean {
  return row.asset === asset && canonicalInterval(row.intervalSec) === canonicalInterval(intervalSec);
}

/** Wallet P&L for one series (asset + cadence). Not the Series record scoreboard. */
export function seriesPnl(
  positions: PositionPnl[],
  fills: WalletFill[],
  asset: string,
  intervalSec: number,
): PnlTotals {
  return pnlTotals(
    positions.filter((p) => inSeries(p, asset, intervalSec)),
    fills.filter((f) => inSeries(f, asset, intervalSec)),
  );
}

export function seriesPnlCopy(t: PnlTotals, asset: string, intervalSec: number): string {
  return `${asset} ${cadenceLabel(intervalSec)} tape · ${pnlCopy(t)} — fills only, Claim payouts not counted`;
}
