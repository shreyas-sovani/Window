/**
 * The challenge link payload — `#/app?d=…`. A hint, never a proof: it locates
 * the challenger's fill so the other wallet can verify it on-chain. Every
 * success state still comes from a verified fill or settlement, never from
 * these fields.
 */

import { headroomSec } from "./lifecycle";

export type ChallengeLinkPayload = {
  marketId: string;
  challenger: string;
  side: "up" | "down";
  stake: number;
  txHash: string;
  expiry: number;
  /** Intended opponent. Absent on legacy links — anyone may accept those. */
  to?: string;
  /** Accept escrow must meet this floor (challenger's stake by default). */
  minStake?: number;
  /** The series the duel is fought on — display/consistency hint, never proof. */
  series?: { asset: string; intervalSec: number };
  /**
   * Social invite close (unix seconds). Minted as fill + Window headroom,
   * capped at lock. A locator — enforcement also caps a tampered-late until
   * against the verified fill time.
   */
  until?: number;
};

/** Invite TTL: the same headroom that closes Calls, measured from the fill. */
export function inviteUntil(input: { windowExpiry: number; fromSec: number; intervalSec: number }): number {
  return Math.min(input.windowExpiry, input.fromSec + headroomSec(input.intervalSec));
}

function toBase64Url(ascii: string): string {
  return btoa(ascii).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return atob(padded);
}

const HEX66 = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

const SERIES = (v: unknown): boolean =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as Record<string, unknown>).asset === "string" &&
  typeof (v as Record<string, unknown>).intervalSec === "number" &&
  Number.isInteger((v as Record<string, unknown>).intervalSec);

function valid(p: unknown, version: 1 | 2): p is ChallengeLinkPayload {
  if (typeof p !== "object" || p === null) return false;
  const r = p as Record<string, unknown>;
  // v1 is the legacy envelope: new-shape fields inside it were smuggled, not minted.
  if (version === 1 && (r.to !== undefined || r.minStake !== undefined || r.series !== undefined || r.until !== undefined)) {
    return false;
  }
  return (
    typeof r.marketId === "string" &&
    HEX66.test(r.marketId) &&
    typeof r.challenger === "string" &&
    ADDRESS.test(r.challenger) &&
    (r.side === "up" || r.side === "down") &&
    typeof r.stake === "number" &&
    Number.isFinite(r.stake) &&
    r.stake >= 0 &&
    typeof r.txHash === "string" &&
    r.txHash.length > 0 &&
    typeof r.expiry === "number" &&
    Number.isInteger(r.expiry) &&
    (r.to === undefined || (typeof r.to === "string" && ADDRESS.test(r.to))) &&
    (r.minStake === undefined || (typeof r.minStake === "number" && Number.isFinite(r.minStake) && r.minStake >= 0)) &&
    (r.series === undefined || SERIES(r.series)) &&
    (r.until === undefined || (typeof r.until === "number" && Number.isInteger(r.until) && r.until >= 0))
  );
}

export function encodeChallenge(p: ChallengeLinkPayload): string {
  return "2." + toBase64Url(JSON.stringify(p));
}

export function decodeChallengeLink(raw: string | null | undefined): ChallengeLinkPayload | null {
  // Versioned envelope: "1." is the legacy shape, "2." carries to / minStake /
  // series / until. Anything else — or any shape mismatch — fails closed to null.
  if (!raw) return null;
  const version = raw.startsWith("1.") ? 1 : raw.startsWith("2.") ? 2 : 0;
  if (!version) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(raw.slice(2)));
    return valid(parsed, version) ? parsed : null;
  } catch {
    return null;
  }
}

export function challengeHref(p: ChallengeLinkPayload): string {
  return `#/app?d=${encodeChallenge(p)}`;
}

/**
 * A completed proof names the accepting transaction explicitly. Public markets
 * can contain unrelated opposite-side fills, so chronology alone is not duel
 * identity. The accepting wallet publishes this URL after its fill verifies.
 */
export function acceptedChallengeHref(p: ChallengeLinkPayload, acceptTxHash: string): string {
  return `${challengeHref(p)}&a=${encodeURIComponent(acceptTxHash)}`;
}

/** The newest witnessed Call that can still be challenged — the strip's only source. */
export function challengeableReceipt(
  receipts: {
    side: "up" | "down";
    stake: number;
    txHash: string;
    marketId: string;
    expiry: number;
    ts: number;
    asset?: string;
    intervalSec?: number;
  }[],
  challenger: string | undefined,
  nowSec?: number,
) {
  if (!challenger) return null;
  for (const r of [...receipts].sort((a, b) => b.ts - a.ts)) {
    if (challengePayloadFromReceipt(r, challenger, nowSec)) return r;
  }
  return null;
}

/**
 * The challenge CTA's payload — only from a receipt whose fill this terminal
 * verified, on a Window that has not expired, with a wallet to name. Anything
 * less is not a challenge.
 */
export function challengePayloadFromReceipt(
  r: {
    side: "up" | "down";
    stake: number;
    txHash: string;
    marketId: string;
    expiry: number;
    ts?: number;
    asset?: string;
    intervalSec?: number;
  },
  challenger: string | undefined,
  nowSec?: number,
): ChallengeLinkPayload | null {
  if (!challenger || !r.txHash) return null;
  if (nowSec !== undefined && r.expiry <= nowSec) return null;
  const fromSec = r.ts ?? nowSec;
  const until =
    fromSec !== undefined
      ? inviteUntil({ windowExpiry: r.expiry, fromSec, intervalSec: r.intervalSec ?? 0 })
      : undefined;
  // A closed invite is not a challenge, even while the Window is still Trading.
  if (nowSec !== undefined && until !== undefined && nowSec > until) return null;
  return {
    marketId: r.marketId,
    challenger,
    side: r.side,
    stake: r.stake,
    txHash: r.txHash,
    expiry: r.expiry,
    // Floor the accept at the challenger's own stake: a duel is comparable stakes,
    // and anything lower cannot masquerade as one.
    minStake: r.stake,
    ...(r.asset && r.intervalSec ? { series: { asset: r.asset, intervalSec: r.intervalSec } } : {}),
    ...(until !== undefined ? { until } : {}),
  };
}
