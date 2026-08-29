import type { LiveWindow } from "../exchange/port";
import { callability } from "./lifecycle";
import { canonicalInterval } from "./series";

export type SeriesKey = { asset: string; intervalSec: number };

/**
 * Opportunity score for one live Window: Trading, has a Line, and outside lock
 * headroom. Higher is better (longer safe headroom); -1 means not an opportunity.
 * Venue is deliberately ignored — the pin exists to stop cross-venue Window
 * mixing per series, not to hide a tradable Window on the other venue.
 */
export function seriesScore(w: LiveWindow, nowSec: number): number {
  const gate = callability({
    status: w.status,
    nowSec,
    expirySec: w.expiry,
    intervalSec: w.intervalSec,
  });
  if (!gate.callable) return -1;
  if (!w.openingPrice) return -1;
  return w.expiry - nowSec;
}

/** Best series to show right now: the most-headroom Trading Window with a real Line. */
export function autoSeries(windows: LiveWindow[], nowSec: number): SeriesKey | null {
  let best: { key: SeriesKey; score: number } | null = null;
  for (const w of windows) {
    const score = seriesScore(w, nowSec);
    if (score < 0) continue;
    if (!best || score > best.score) {
      best = { key: { asset: w.asset, intervalSec: canonicalInterval(w.intervalSec) }, score };
    }
  }
  return best?.key ?? null;
}
