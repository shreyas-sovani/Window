import type { LiveWindow } from "../exchange/port";
import { cadenceLabel, canonicalInterval } from "./series";

export type LastCall = {
  asset: string;
  intervalSec: number;
  side: "up" | "down";
  /** Human stake as entered, not raw units. */
  stake: number;
  marketId: string;
};

export type RollPrompt = {
  title: string;
  action: string;
  side: "up" | "down";
};

/**
 * The roll companion: after a Window this terminal witnessed a Call on locks,
 * offer the same Call on its successor — same asset, same cadence, same stake,
 * one press. The wallet still signs; nothing repeats on its own.
 */
export function rollPrompt(input: {
  last: LastCall | null;
  live: LiveWindow | null;
  callable: boolean;
  dismissedMarketId?: string;
}): RollPrompt | null {
  const { last, live } = input;
  if (!last || !live) return null;
  if (live.marketId === last.marketId) return null;
  if (live.asset !== last.asset) return null;
  if (canonicalInterval(live.intervalSec) !== canonicalInterval(last.intervalSec)) return null;
  if (!input.callable) return null;
  if (input.dismissedMarketId === live.marketId) return null;
  const side = last.side === "up" ? "Up" : "Down";
  return {
    title: `Rolled — next ${last.asset} ${cadenceLabel(canonicalInterval(last.intervalSec))} Window is open`,
    action: `Call ${side} · ${last.stake.toFixed(2)} tUSDC again`,
    side: last.side,
  };
}
