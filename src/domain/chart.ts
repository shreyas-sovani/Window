import type { MarketFill, PastWindow, Sample, SeriesResult } from "../exchange/port";

/** Append a sample newest-last, dropping a duplicate timestamp and capping the window. */
export function pushSample(samples: Sample[], s: Sample, cap = 120): Sample[] {
  const next = samples.length > 0 && samples[samples.length - 1].t === s.t
    ? samples.slice(0, -1)
    : samples.slice();
  next.push(s);
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Min-max normalized SVG polyline path for a sparkline inside w×h. Empty when < 2 points. */
export function sparkPath(samples: Sample[], w: number, h: number, pad = 3): string {
  if (samples.length < 2) return "";
  const vs = samples.map((s) => s.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const t0 = samples[0].t;
  const t1 = samples[samples.length - 1].t || 1;
  const tSpan = t1 - t0 || 1;
  return samples
    .map((s, i) => {
      const x = pad + ((s.t - t0) / tSpan) * (w - pad * 2);
      const y = h - pad - ((s.v - min) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join("");
}

export type OutcomeBar = { expiry: number; result: SeriesResult; volume: number };

/** Newest-first history capped to `max` bars for the outcome strip. */
export function outcomeBars(history: PastWindow[], max = 12): OutcomeBar[] {
  return [...history]
    .sort((a, b) => b.expiry - a.expiry)
    .slice(0, max)
    .map((r) => ({ expiry: r.expiry, result: r.result, volume: r.volumeQuote ?? 0 }));
}

/** Newest-first market tape rows; aggressor is the taker direction, null when unresolved. */
export function tapeRows(fills: MarketFill[], limit = 8): MarketFill[] {
  return fills
    .slice()
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

/** Pulse has something to show: a spark (≥2 ticks), a tape row, or last-window bars. */
export function pulseReady(input: {
  priceSamples: Sample[];
  impliedSamples: Sample[];
  fills: MarketFill[];
  history?: PastWindow[];
}): boolean {
  if (input.priceSamples.length > 1 || input.impliedSamples.length > 1) return true;
  if (tapeRows(input.fills, 1).length > 0) return true;
  return outcomeBars(input.history ?? [], 1).length > 0;
}
