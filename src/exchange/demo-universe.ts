import type { AssetPrice, LiveWindow, MarketFill, PastWindow } from "./port";
import type { BookDepth, DepthLevel } from "../domain/book-depth";
import { headroomSec } from "../domain/lifecycle";
import { SELECTABLE_CADENCES, cadenceLabel } from "../domain/series";

/**
 * The demo universe: every demo browser derives the identical market from the
 * wall clock alone — same windows, books, ladders, tape, Lines, and settlement
 * verdicts — so a shared challenge link needs to carry only the fills, never
 * the market. All derivation is pure and deterministic from (asset, interval,
 * window index).
 */

/** Fixed anchor so every browser computes the same window index for a moment. */
export const DEMO_EPOCH_SEC = 1_788_000_000;
/** Shortest demo Window — the 5m chip. Longer cadences scale from headroom. */
export const DEMO_WINDOW_SEC = 150;

/**
 * A demo Window's real duration. The cadence label (and therefore the lock
 * headroom every gate reads) stays the venue's, so a compressed Window must
 * still be callable for most of its life: three headroom slices means two
 * callable and one locked, and the invite that a fill mints outlives the
 * sharing of it.
 */
export function demoWindowSec(intervalSec: number): number {
  return Math.max(DEMO_WINDOW_SEC, headroomSec(intervalSec) * 3);
}

const ASSET_BASE: Record<string, number> = { BTC: 67_214.5, ETH: 3_141.5 };

/** Every selectable cadence, both assets — the chips all have a live window. */
const SERIES: { asset: string; intervalSec: number; base: number }[] = ["BTC", "ETH"].flatMap((asset) =>
  (SELECTABLE_CADENCES as readonly number[]).map((intervalSec) => ({
    asset,
    intervalSec,
    base: ASSET_BASE[asset] ?? 67_214.5,
  })),
);

function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const hex64 = (n: number, salt: string) =>
  "0x" + fnv1a32(salt).toString(16).padStart(8, "0") + n.toString(16).padStart(8, "0").slice(-8).padEnd(8, "0") + (fnv1a32(salt + n) >>> 0).toString(16).padStart(8, "0") + "0".repeat(40);

function seriesFor(asset: string, intervalSec: number) {
  const found = SERIES.find((s) => s.asset === asset && s.intervalSec === intervalSec);
  return found ?? SERIES[0];
}

/** Window index for a moment in one series — the demo clock's only counter. */
export function demoWindowIndex(intervalSec: number, atSec: number): number {
  return Math.floor((atSec - DEMO_EPOCH_SEC) / demoWindowSec(intervalSec));
}

export function demoWindowAt(asset: string, intervalSec: number, atSec: number): LiveWindow {
  const s = seriesFor(asset, intervalSec);
  const span = demoWindowSec(s.intervalSec);
  const index = demoWindowIndex(s.intervalSec, atSec);
  if (index < 0) throw new Error("demo time is before the demo epoch");
  const expiry = DEMO_EPOCH_SEC + (index + 1) * span;
  const seed = fnv1a32(`${s.asset}|demo|${index}`);
  const line = (s.base * (0.94 + (seed % 1200) / 10_000)).toFixed(2);
  const marketId = hex64(index, `market|${s.asset}|${s.intervalSec}`) as `0x${string}`;
  const label = cadenceLabel(s.intervalSec);
  return {
    marketId,
    symbol: `${s.asset}-${label}`,
    upSymbol: `${s.asset}-${label}#YES`,
    downSymbol: `${s.asset}-${label}#NO`,
    asset: s.asset,
    intervalSec,
    expiry,
    venueId: "0xdemovenue",
    // Pools are per market: two cadences of one asset must never share a tape.
    pool: hex64(index, `pool|${s.asset}|${s.intervalSec}`) as `0x${string}`,
    status: 1,
    result: "unknown",
    openingPrice: line,
    // Seed-derived headline numbers; the adapter replaces them with the live
    // pool tape's own sums while the Window is on the board.
    volumeQuote: 4_000 + (seed % 9_000),
    tradeCount: 40 + (seed % 120),
    oracleQuestionId: `demo-${seed}`,
    tick: 1000n,
    lot: 1000n,
    decimals: 6,
  };
}

/** Ladder geometry: one deterministic mid per market, a 1-point spread around it. */
function ladderMid(marketId: string): number {
  const seed = fnv1a32(`book|${marketId.toLowerCase()}`);
  return 0.4 + (seed % 2001) / 10_000; // 0.40 – 0.60
}

const HALF_SPREAD = 0.005;
const LEVEL_STEP = 0.005;
/** Contracts per level, best first — a Call of several hundred tUSDC still fills. */
const LEVEL_SIZES = [250, 400, 600, 900, 1300, 1800];

const round4 = (n: number) => Number(n.toFixed(4));

function levels(prices: number[]): DepthLevel[] {
  let cum = 0;
  return prices.map((upPrice, i) => {
    const contracts = LEVEL_SIZES[i];
    cum += contracts;
    return { upPrice, downPrice: round4(1 - upPrice), contracts, cumContracts: cum };
  });
}

/**
 * The demo order book, in full. Real depth on both sides — the Book cell grades
 * it, the ticket walks it for an average fill, and the drawer lists it — so the
 * demo is not a single quote pretending to be a market.
 */
export function demoDepthFor(w: { marketId: string }): BookDepth {
  const mid = ladderMid(w.marketId);
  const asks = levels(LEVEL_SIZES.map((_, i) => round4(mid + HALF_SPREAD + i * LEVEL_STEP)));
  const bids = levels(LEVEL_SIZES.map((_, i) => round4(mid - HALF_SPREAD - i * LEVEL_STEP)));
  return { bids, asks, empty: false };
}

/** Top of the same ladder — the book and the depth can never disagree. */
export function demoBookFor(w: { marketId: string }): { bid: number; ask: number } {
  const depth = demoDepthFor(w);
  return { bid: depth.bids[0].upPrice, ask: depth.asks[0].upPrice };
}

export function demoResultFor(marketId: string): "up" | "down" {
  return fnv1a32(`settle|${marketId.toLowerCase()}`) % 2 === 0 ? "up" : "down";
}

/**
 * The pool's public tape: other traders, deterministic per market, arriving
 * every few seconds of the Window's life. Rows are anonymous (`taker: null`)
 * because they are market colour, never a duel leg — every proof read matches
 * on a named transaction and a named wallet, so these can never be mistaken
 * for one, and settlement mints no claim for them.
 */
export function demoTapeFor(
  marketId: string,
  expiry: number,
  intervalSec: number,
  atSec: number,
): MarketFill[] {
  const span = demoWindowSec(intervalSec);
  const start = expiry - span;
  const gap = 6;
  const depth = demoDepthFor({ marketId });
  const rows: MarketFill[] = [];
  for (let i = 0; i * gap < span; i += 1) {
    const ts = start + i * gap;
    if (ts > atSec || ts > expiry) break;
    const seed = fnv1a32(`tape|${marketId.toLowerCase()}|${i}`);
    const aggressor = seed % 2 === 0 ? ("up" as const) : ("down" as const);
    const level = depth[aggressor === "up" ? "asks" : "bids"][seed % 3];
    const price = aggressor === "up" ? level.upPrice : level.downPrice;
    const quantity = 5 + (seed % 60);
    rows.push({
      id: `demotape-${marketId.slice(2, 10)}-${i}`,
      price,
      quantity,
      quote: round4(quantity * price),
      aggressor,
      ts,
      txHash: `0xdemotape${fnv1a32(`${marketId}|${i}`).toString(16).padStart(8, "0")}`,
      marketId,
      taker: null,
      kind: null,
    });
  }
  return rows;
}

/** The underlying, deterministic from the clock — the Pulse spark has a signal. */
export function demoPriceFor(asset: string, atSec: number): AssetPrice {
  const base = ASSET_BASE[asset] ?? 67_214.5;
  const wave = Math.sin(atSec / 90) * 0.004 + Math.sin(atSec / 17) * 0.0012;
  const price = Number((base * (1 + wave)).toFixed(2));
  const ema = Number((base * (1 + Math.sin((atSec - 45) / 90) * 0.004)).toFixed(2));
  return { asset, price, ema };
}

export function demoHistoryFor(asset: string, intervalSec: number, atSec: number, count = 12): PastWindow[] {
  const s = seriesFor(asset, intervalSec);
  const span = demoWindowSec(s.intervalSec);
  const index = demoWindowIndex(s.intervalSec, atSec);
  const rows: PastWindow[] = [];
  for (let i = 1; i <= count && index - i >= 0; i += 1) {
    const w = demoWindowAt(s.asset, s.intervalSec, DEMO_EPOCH_SEC + (index - i) * span + 5);
    rows.push({
      marketId: w.marketId,
      expiry: w.expiry,
      result: demoResultFor(w.marketId),
      volumeQuote: w.volumeQuote,
      openingPrice: w.openingPrice,
      oracleQuestionId: w.oracleQuestionId,
    });
  }
  return rows;
}

export function demoSeries(): { asset: string; intervalSec: number }[] {
  return SERIES.map((s) => ({ asset: s.asset, intervalSec: s.intervalSec }));
}
