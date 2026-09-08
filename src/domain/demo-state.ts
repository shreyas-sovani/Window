/**
 * The demo fills blob: the self-contained part of a shared demo link. Markets
 * are derived from the wall clock on every browser (demo-universe); only fills
 * are actions, so only fills travel. Fail-closed on any malformed row — a
 * half-trusted fill must never enter a demo tape.
 */

export type DemoFillRow = {
  id: string;
  price: number;
  quantity: number;
  quote: number;
  aggressor: "up" | "down";
  ts: number;
  txHash: string;
  marketId: string;
  taker?: string | null;
  kind?: string | null;
};

const MAX_FILLS = 32;

function toBase64Url(ascii: string): string {
  return btoa(ascii).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASHISH = /^0x[0-9a-zA-Z]{4,64}$/;

function validRow(r: unknown): r is DemoFillRow {
  if (typeof r !== "object" || r === null) return false;
  const v = r as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.price === "number" &&
    Number.isFinite(v.price) &&
    v.price > 0 &&
    v.price < 1 &&
    typeof v.quantity === "number" &&
    Number.isFinite(v.quantity) &&
    v.quantity > 0 &&
    typeof v.quote === "number" &&
    Number.isFinite(v.quote) &&
    v.quote > 0 &&
    (v.aggressor === "up" || v.aggressor === "down") &&
    typeof v.ts === "number" &&
    Number.isInteger(v.ts) &&
    v.ts > 0 &&
    typeof v.txHash === "string" &&
    HASHISH.test(v.txHash) &&
    typeof v.marketId === "string" &&
    HASHISH.test(v.marketId) &&
    (v.taker === undefined || v.taker === null || (typeof v.taker === "string" && ADDRESS.test(v.taker))) &&
    (v.kind === undefined || v.kind === null || typeof v.kind === "string")
  );
}

export function encodeDemoFills(fills: DemoFillRow[]): string {
  if (fills.length > MAX_FILLS) {
    throw new RangeError(`a demo link carries at most ${MAX_FILLS} fills`);
  }
  return "1." + toBase64Url(JSON.stringify({ v: 1, fills }));
}

export function decodeDemoFills(raw: string | null | undefined): DemoFillRow[] | null {
  if (!raw || !raw.startsWith("1.")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(raw.slice(2)));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const env = parsed as Record<string, unknown>;
  if (env.v !== 1 || !Array.isArray(env.fills) || env.fills.length === 0 || env.fills.length > MAX_FILLS) return null;
  const rows: unknown[] = env.fills;
  if (!rows.every(validRow)) return null;
  return rows as DemoFillRow[];
}
