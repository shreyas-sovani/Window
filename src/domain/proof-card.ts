import { cadenceLabel } from "./series";

/** A Call this terminal witnessed — the only source of proof cards. No position archaeology. */
export type CallReceipt = {
  asset: string;
  intervalSec: number;
  side: "up" | "down";
  line?: string;
  expiry: number;
  stake: number;
  contracts: number;
  avgOdds: number;
  payoutIfWin: number;
  maxLoss: number;
  txHash: string;
  marketId: `0x${string}`;
  ts: number;
};

function expiryCopy(expiry: number): string {
  return new Date(expiry * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function oddsCopy(r: CallReceipt): string {
  const pct = Math.round(r.avgOdds * 100);
  return `${r.contracts.toFixed(2)} contracts @ ~${pct}%`;
}

/** Plain-text receipt for clipboard / Web Share. Every number links back to a witnessed fill. */
export function proofCard(r: CallReceipt): string {
  return [
    "WINDOW — call receipt",
    `${r.asset} ${cadenceLabel(r.intervalSec)} · Called ${r.side.toUpperCase()}`,
    `Line ${r.line ?? "—"} · locked ${expiryCopy(r.expiry)}`,
    `Stake ${r.stake.toFixed(2)} tUSDC → ${oddsCopy(r)}`,
    `If right: ${r.payoutIfWin.toFixed(2)} tUSDC · at risk: ${r.maxLoss.toFixed(2)} tUSDC`,
    `Proof: https://shannon-explorer.somnia.network/tx/${r.txHash}`,
    "Window · dreamDEX Event Contracts on Somnia",
  ].join("\n");
}

const RESULT_COPY: Record<string, string> = {
  up: "Result: UP — settled at or above the Line.",
  down: "Result: DOWN — settled below the Line.",
  void: "Result: VOID — no reliable close. Both sides redeem at half.",
  unknown: "Result: settling…",
};

export function settledProofCard(r: CallReceipt, result: "up" | "down" | "void" | "unknown", oracleUrl?: string): string {
  const lines = [proofCard(r), RESULT_COPY[result] ?? RESULT_COPY.unknown];
  if (oracleUrl) lines.push(`Oracle receipt: ${oracleUrl}`);
  return lines.join("\n");
}
