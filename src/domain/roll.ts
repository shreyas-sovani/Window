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
 * The rematch companion (was Roll): after a Window this terminal witnessed a
 * Call on locks, offer the same Call on its successor — same asset, same
 * cadence, same side, same stake, one press. Never the dead marketId. The
 * wallet still signs; nothing repeats on its own.
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
    title: `Rematch — next ${last.asset} ${cadenceLabel(canonicalInterval(last.intervalSec))} Window is open`,
    action: `Call ${side} · ${last.stake.toFixed(2)} tUSDC again`,
    side: last.side,
  };
}

export type RematchTarget = { to: string; side: "up" | "down"; marketId: string };

/**
 * The opponent-targeted rematch banner: after a settled duel, the participant
 * Calls their own side on the successor Window, then challenges the same
 * opponent from the strip — the two wallets keep opposite sides. Replaces the
 * same-side solo roll while active. Never the dead marketId.
 */
export function rematchPrompt(input: {
  target: RematchTarget | null;
  live: LiveWindow | null;
  canCall: boolean;
  sideOk: boolean;
}): RollPrompt | null {
  const { target, live } = input;
  if (!target || !live) return null;
  if (live.marketId.toLowerCase() !== target.marketId.toLowerCase()) return null;
  if (!input.canCall || !input.sideOk) return null;
  const side = target.side === "up" ? "Up" : "Down";
  return {
    title: `Rematch — open the next Window against ${shortenAddress(target.to)}`,
    action: `Call ${side} to open the rematch`,
    side: target.side,
  };
}

function shortenAddress(a: string): string {
  return a.length < 12 ? a : `${a.slice(0, 6)}…${a.slice(-4)}`;
}
