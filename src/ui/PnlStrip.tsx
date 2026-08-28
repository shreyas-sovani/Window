import { explorerTx } from "../chain/shannon";
import { cadenceLabel } from "../domain/series";
import { pnlCopy, pnlTotals, sessionTape } from "../domain/pnl";
import type { PositionPnl, WalletFill } from "../exchange/port";
import { fmt } from "./format";

function signedClass(n: number) {
  return n > 0 ? "pos" : n < 0 ? "neg" : "";
}

function signedCash(n: number) {
  const abs = fmt(Math.abs(n), 2);
  return `${n < 0 ? "−" : "+"}${abs}`;
}

export function PnlStrip(props: { fills: WalletFill[] | undefined; positions: PositionPnl[] | undefined }) {
  const fills = props.fills ?? [];
  const positions = props.positions ?? [];
  const totals = pnlTotals(positions, fills);
  const tape = sessionTape(fills, 6);
  const empty = fills.length === 0 && positions.length === 0;

  return (
    <details className="drawer pnl">
      <summary>P&L · trade tape</summary>
      {empty ? (
        <p className="drawer-empty">No fills yet. Your Calls land here.</p>
      ) : (
        <>
          <div className={`pnl-total mono ${signedClass(totals.net)}`}>{pnlCopy(totals)}</div>
          {positions.length > 0 && (
            <ul className="pnl-rows">
              {positions.map((p) => (
                <li key={p.marketId}>
                  <span className="mono">
                    {p.asset} · {cadenceLabel(p.intervalSec)} ·{" "}
                    {fmt(Number(p.up) / 10 ** p.decimals, 2)} Up / {fmt(Number(p.down) / 10 ** p.decimals, 2)} Down
                  </span>
                  <span className={`mono ${signedClass(Number(p.unrealizedPnl) / 10 ** p.decimals)}`}>
                    {signedCash(Number(p.unrealizedPnl) / 10 ** p.decimals)} open
                  </span>
                </li>
              ))}
            </ul>
          )}
          {tape.length > 0 && (
            <ul className="pnl-rows tape">
              {tape.map((r) => (
                <li key={r.id}>
                  <a href={explorerTx(r.txHash)} target="_blank" rel="noreferrer" className="mono">
                    {r.asset} · {cadenceLabel(r.intervalSec)} ·{" "}
                    {r.direction === "buy" ? "Call" : "Exit"} {r.side === "up" ? "Up" : "Down"}{" "}
                    {fmt(r.quantity, 2)} @ {fmt(r.price * 100, 1)}%
                  </a>
                  <span className={`mono ${signedClass(r.cashflow)}`}>{signedCash(r.cashflow)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </details>
  );
}
