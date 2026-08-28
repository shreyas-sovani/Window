import { outcomeBars, pulseReady, sparkPath, tapeRows } from "../domain/chart";
import type { AssetPrice, MarketFill, PastWindow, Sample } from "../exchange/port";
import { explorerTx } from "../chain/shannon";
import { fmt } from "./format";

function Spark({ samples, w = 260, h = 48, tone = "clay" }: { samples: Sample[]; w?: number; h?: number; tone?: "clay" | "ink" }) {
  const d = sparkPath(samples, w, h);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {d && <path d={d} fill="none" stroke={tone === "clay" ? "var(--clay)" : "var(--ink)"} strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}

/** Live pulse of the selected series: price, implied odds, recent outcomes, and the public tape. */
export function Pulse(props: {
  asset: string;
  price?: AssetPrice;
  priceSamples: Sample[];
  impliedSamples: Sample[];
  history?: PastWindow[];
  fills: MarketFill[];
}) {
  const bars = outcomeBars(props.history ?? [], 12);
  const tape = tapeRows(props.fills, 6);
  const hasPulse = pulseReady({
    priceSamples: props.priceSamples,
    impliedSamples: props.impliedSamples,
    fills: props.fills,
    history: props.history,
  });

  return (
    <details className="drawer pulse" open>
      <summary>Pulse · {props.asset} this Window</summary>
      {!hasPulse ? (
        <p className="drawer-empty">Collecting ticks…</p>
      ) : (
        <div className="pulse-grid">
          <div className="pulse-cell">
            <div className="kicker">{props.asset} price</div>
            <div className="pulse-value mono">{props.price ? fmt(props.price.price, 2) : "—"}</div>
            <Spark samples={props.priceSamples} tone="clay" />
          </div>
          <div className="pulse-cell">
            <div className="kicker">Implied Up</div>
            <div className="pulse-value mono">
              {props.impliedSamples.length > 0 ? `${fmt(props.impliedSamples[props.impliedSamples.length - 1].v * 100, 1)}%` : "—"}
            </div>
            <Spark samples={props.impliedSamples} tone="ink" />
          </div>
          <div className="pulse-cell">
            <div className="kicker">Last windows</div>
            <div className="bars" aria-label="Recent outcomes">
              {bars.map((b) => (
                <span key={b.expiry} className={`bar ${b.result}`} title={`${b.result} · vol ${fmt(b.volume, 0)}`} />
              ))}
              {bars.length === 0 && <span className="drawer-empty">No settled windows yet</span>}
            </div>
          </div>
          <div className="pulse-cell wide">
            <div className="kicker">Public tape</div>
            <ul className="mtape mono">
              {tape.map((f) => (
                <li key={f.id} className={f.aggressor ?? ""}>
                  <a href={explorerTx(f.txHash)} target="_blank" rel="noreferrer">
                    {f.aggressor === "up" ? "▲" : f.aggressor === "down" ? "▼" : "·"} {fmt(f.price * 100, 1)}% ×{" "}
                    {fmt(f.quantity, 2)}
                  </a>
                  <span className="mono">{fmt(f.quote, 2)}</span>
                </li>
              ))}
              {tape.length === 0 && <li className="drawer-empty">No fills on this pool yet</li>}
            </ul>
          </div>
        </div>
      )}
    </details>
  );
}
