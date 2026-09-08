import type { LiveWindow, PastWindow } from "./port";
import { SELECTABLE_CADENCES, cadenceLabel } from "../domain/series";

/**
 * The demo universe: every demo browser derives the identical market from the
 * wall clock alone — same windows, books, Lines, and settlement verdicts — so a
 * shared challenge link needs to carry only the fills, never the market. All
 * derivation is pure and deterministic from (asset, interval, window index).
 */

/** Fixed anchor so every browser computes the same window index for a moment. */
export const DEMO_EPOCH_SEC = 1_788_000_000;
/** Demo windows roll fast enough to settle inside a demo recording. */
export const DEMO_WINDOW_SEC = 150;

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

export function demoWindowAt(asset: string, intervalSec: number, atSec: number): LiveWindow {
  const s = seriesFor(asset, intervalSec);
  const index = Math.floor((atSec - DEMO_EPOCH_SEC) / DEMO_WINDOW_SEC);
  if (index < 0) throw new Error("demo time is before the demo epoch");
  const expiry = DEMO_EPOCH_SEC + (index + 1) * DEMO_WINDOW_SEC;
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
    pool: hex64(index, `pool|${s.asset}`) as `0x${string}`,
    status: 1,
    result: "unknown",
    openingPrice: line,
    volumeQuote: 4_000 + (seed % 9_000),
    tradeCount: 40 + (seed % 120),
    oracleQuestionId: `demo-${seed}`,
    tick: 1000n,
    lot: 1000n,
    decimals: 6,
  };
}

export function demoBookFor(w: LiveWindow): { bid: number; ask: number } {
  const seed = fnv1a32(`book|${w.marketId.toLowerCase()}`);
  const mid = 0.42 + (seed % 1600) / 10_000; // 0.42 – 0.58
  const half = 0.01 + (seed % 300) / 30_000; // up to 2¢ half-spread
  const bid = Math.max(0.02, mid - half);
  const ask = Math.min(0.98, mid + half);
  return { bid: Number(bid.toFixed(4)), ask: Number(ask.toFixed(4)) };
}

export function demoResultFor(marketId: string): "up" | "down" {
  return fnv1a32(`settle|${marketId.toLowerCase()}`) % 2 === 0 ? "up" : "down";
}

export function demoHistoryFor(asset: string, intervalSec: number, atSec: number, count = 12): PastWindow[] {
  const s = seriesFor(asset, intervalSec);
  const index = Math.floor((atSec - DEMO_EPOCH_SEC) / DEMO_WINDOW_SEC);
  const rows: PastWindow[] = [];
  for (let i = 1; i <= count && index - i >= 0; i += 1) {
    const w = demoWindowAt(s.asset, s.intervalSec, DEMO_EPOCH_SEC + (index - i) * DEMO_WINDOW_SEC + 5);
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
