import type { BookTop } from "../exchange/port";
import type { BookDepth } from "./book-depth";
import { headroomSec } from "./lifecycle";
import { fillEstimate } from "./liquidity";

export type HealthGrade = "strong" | "fair" | "thin" | "none";

export type MarketHealth = {
  grade: HealthGrade;
  /** ask − bid in probability points; null without a two-sided top of book. */
  spread: number | null;
  /** Smaller side's walked-depth ceiling, in collateral — what a Call can actually take. */
  executableStake: number;
  secondsToLock: number | null;
  copy: string;
};

/** Spread and executable depth a Call can actually reach, with the lock clock counting down. */
export function marketHealth(input: {
  book: BookTop | undefined;
  depth: BookDepth;
  expirySec: number | undefined;
  intervalSec: number | undefined;
  nowSec: number;
}): MarketHealth {
  const up = fillEstimate(input.depth, "up", Number.POSITIVE_INFINITY);
  const down = fillEstimate(input.depth, "down", Number.POSITIVE_INFINITY);
  const walked = up !== null && down !== null;
  const executableStake = walked ? Math.min(up!.maxStake, down!.maxStake) : 0;
  const spread =
    input.book?.bid !== undefined && input.book?.ask !== undefined
      ? input.book.ask - input.book.bid
      : null;
  const twoSided = spread !== null;
  const secondsToLock = input.expirySec !== undefined ? Math.max(0, input.expirySec - input.nowSec) : null;
  // "Thin + locks in" starts exactly where Calls actually close (headroom), never before.
  const lockHeadroom = headroomSec(input.intervalSec ?? 900);
  const nearLock = secondsToLock !== null && secondsToLock < lockHeadroom;

  // The depth watch runs ahead of the polled top of book. A two-sided top with a cold
  // depth watch is still callable at the top — grade on spread alone, never claim depth.
  let grade: HealthGrade;
  if (!twoSided && !walked) {
    grade = "none";
  } else if (spread === null || spread >= 0.05 || (walked && executableStake < 5) || nearLock) {
    grade = "thin";
  } else if (!walked || spread >= 0.02 || executableStake < 25) {
    grade = "fair";
  } else {
    grade = "strong";
  }

  const label =
    grade === "none"
      ? "No executable odds — Call stays off"
      : `${grade === "strong" ? "Strong" : grade === "fair" ? "Fair" : "Thin"} book · ${
          spread !== null ? `${(spread * 100).toFixed(1)} pt spread` : "no two-sided spread"
        }${walked ? ` · ≈${executableStake.toFixed(0)} tUSDC deep` : " · top of book"}`;
  const lock = nearLock ? ` · locks in ${fmtClock(secondsToLock!)}` : "";
  return { grade, spread, executableStake, secondsToLock, copy: `${label}${lock}` };
}

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Compact second line for the board's Book cell: spread · depth · lock when near. */
export function healthDetail(h: MarketHealth): string {
  if (h.grade === "none") return "no executable odds";
  const parts = [h.spread !== null ? `${(h.spread * 100).toFixed(1)} pt` : "one-sided"];
  if (h.executableStake > 0) parts.push(`≈${h.executableStake.toFixed(0)} deep`);
  else parts.push("top of book");
  if (h.secondsToLock !== null && h.secondsToLock < 120) parts.push(`locks ${fmtClock(h.secondsToLock)}`);
  return parts.join(" · ");
}
