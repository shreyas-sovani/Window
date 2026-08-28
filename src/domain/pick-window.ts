import type { LiveWindow } from "../exchange/port";
import { statusCode } from "./lifecycle";
import { canonicalInterval } from "./series";

function seriesMatch(
  w: LiveWindow,
  asset: string,
  intervalSec: number,
  venueId?: string,
): boolean {
  if (w.asset !== asset) return false;
  if (canonicalInterval(w.intervalSec) !== canonicalInterval(intervalSec)) return false;
  if (venueId && w.venueId && w.venueId !== venueId) return false;
  return true;
}

/** Board picker: soonest unexpired Trading/Locked/Settling row, else a just-expired wait row. Headroom is a Call gate, not a hide-the-board gate. */
export function pickWindow(
  windows: LiveWindow[],
  asset: string,
  intervalSec: number,
  nowSec: number,
  venueId?: string,
): LiveWindow | null {
  const matches = windows.filter((w) => {
    if (!seriesMatch(w, asset, intervalSec, venueId)) return false;
    const code = statusCode(w.status);
    return code === 1 || code === 2 || code === 3;
  });
  const open = matches.filter((w) => w.expiry > nowSec);
  open.sort((a, b) => a.expiry - b.expiry);
  if (open[0]) return open[0];

  const cadence = canonicalInterval(intervalSec);
  const waiting = matches.filter((w) => {
    const age = nowSec - w.expiry;
    return age >= 0 && age < cadence;
  });
  waiting.sort((a, b) => b.expiry - a.expiry);
  return waiting[0] ?? null;
}
