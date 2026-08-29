import { useState } from "react";
import { oracleReceipt } from "../chain/shannon";
import { proofCard, settledProofCard, type CallReceipt } from "../domain/proof-card";
import type { PastWindow } from "../exchange/port";
import { cadenceLabel } from "../domain/series";
import { fmt } from "./format";

function resultFor(history: PastWindow[] | undefined, marketId: string): PastWindow | undefined {
  return history?.find((h) => h.marketId === marketId && h.result !== "unknown");
}

async function shareText(text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (navigator.share) {
      await navigator.share({ title: "Window call receipt", text });
      return "shared";
    }
  } catch {
    /* user dismissed the share sheet — fall through to copy */
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Session receipts for Calls this terminal witnessed. Result + oracle link arrive when the Window settles. */
export function ReceiptStrip(props: { receipts: CallReceipt[]; history?: PastWindow[] }) {
  const [flash, setFlash] = useState<string | null>(null);
  if (props.receipts.length === 0) return null;

  return (
    <details className="drawer receipts">
      <summary>Receipts · share your proof</summary>
      <ul className="rcpt">
        {props.receipts.map((r) => {
          const settled = resultFor(props.history, r.marketId);
          const text = settled
            ? settledProofCard(
                r,
                settled.result,
                settled.oracleQuestionId ? oracleReceipt(settled.oracleQuestionId) : undefined,
              )
            : proofCard(r);
          return (
            <li key={`${r.marketId}-${r.ts}`}>
              <span className="mono">
                {r.asset} {cadenceLabel(r.intervalSec)} · {r.side === "up" ? "UP" : "DOWN"} ·{" "}
                {fmt(r.stake, 2)} tUSDC
              </span>
              <span className={`chip inline ${settled ? settled.result : "open"}`}>
                {settled ? settled.result.toUpperCase() : "OPEN"}
              </span>
              <button
                className="linklike"
                type="button"
                onClick={async () => {
                  const outcome = await shareText(text);
                  setFlash(`${r.marketId}-${r.ts}:${outcome}`);
                  setTimeout(() => setFlash(null), 1600);
                }}
              >
                {flash === `${r.marketId}-${r.ts}:copied`
                  ? "Copied"
                  : flash === `${r.marketId}-${r.ts}:shared`
                    ? "Shared"
                    : flash === `${r.marketId}-${r.ts}:failed`
                      ? "Copy failed"
                      : settled
                        ? "Share settled receipt"
                        : "Share"}
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
