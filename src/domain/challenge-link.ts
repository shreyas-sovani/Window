/**
 * The challenge link payload — `#/app?d=…`. A hint, never a proof: it locates
 * the challenger's fill so the other wallet can verify it on-chain. Every
 * success state still comes from a verified fill or settlement, never from
 * these fields.
 */

export type ChallengeLinkPayload = {
  marketId: string;
  challenger: string;
  side: "up" | "down";
  stake: number;
  txHash: string;
  expiry: number;
};

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

function valid(p: unknown): p is ChallengeLinkPayload {
  if (typeof p !== "object" || p === null) return false;
  const r = p as Record<string, unknown>;
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
    Number.isInteger(r.expiry)
  );
}

export function encodeChallenge(p: ChallengeLinkPayload): string {
  return "1." + toBase64Url(JSON.stringify(p));
}

export function decodeChallengeLink(raw: string | null | undefined): ChallengeLinkPayload | null {
  if (!raw || !raw.startsWith("1.")) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(raw.slice(2)));
    return valid(parsed) ? parsed : null;
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
  receipts: { side: "up" | "down"; stake: number; txHash: string; marketId: string; expiry: number; ts: number }[],
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
  r: { side: "up" | "down"; stake: number; txHash: string; marketId: string; expiry: number },
  challenger: string | undefined,
  nowSec?: number,
): ChallengeLinkPayload | null {
  if (!challenger || !r.txHash) return null;
  if (nowSec !== undefined && r.expiry <= nowSec) return null;
  return {
    marketId: r.marketId,
    challenger,
    side: r.side,
    stake: r.stake,
    txHash: r.txHash,
    expiry: r.expiry,
  };
}
