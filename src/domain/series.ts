/** Cadences the Shannon venues actually roll. Indexer `intervalSec` is derived from expiry − start and can be off by a few seconds. */
export const SERIES_CADENCES = [60, 300, 900, 3600, 14400, 86400] as const;

export const SERIES_CHIPS = [
  { asset: "BTC", intervalSec: 300, label: "BTC 5m" },
  { asset: "BTC", intervalSec: 900, label: "BTC 15m" },
  { asset: "BTC", intervalSec: 3600, label: "BTC 1h" },
  { asset: "BTC", intervalSec: 14400, label: "BTC 4h" },
  { asset: "BTC", intervalSec: 86400, label: "BTC 24h" },
  { asset: "ETH", intervalSec: 300, label: "ETH 5m" },
  { asset: "ETH", intervalSec: 900, label: "ETH 15m" },
  { asset: "ETH", intervalSec: 3600, label: "ETH 1h" },
  { asset: "ETH", intervalSec: 14400, label: "ETH 4h" },
  { asset: "ETH", intervalSec: 86400, label: "ETH 24h" },
] as const;

export function canonicalInterval(sec: number): number {
  if (!Number.isFinite(sec) || sec <= 0) return 900;
  let best: number = SERIES_CADENCES[0];
  let dist = Math.abs(sec - best);
  for (const c of SERIES_CADENCES) {
    const d = Math.abs(sec - c);
    if (d < dist) {
      best = c;
      dist = d;
    }
  }
  const slack = Math.max(5, Math.floor(best * 0.02));
  return dist <= slack ? best : Math.round(sec);
}

/** Compact series length for the tote (1m / 5m / 15m / 1h / 4h / 24h). Snaps indexer noise first. */
export function cadenceLabel(sec: number): string {
  const c = canonicalInterval(sec);
  if (c < 60) return `${c}s`;
  if (c < 3600) return `${c / 60}m`;
  return `${c / 3600}h`;
}
