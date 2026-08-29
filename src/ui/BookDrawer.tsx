import type { BookDepth, DepthLevel } from "../domain/book-depth";
import { summarizeDepth } from "../domain/book-depth";
import { fmt } from "./format";

function peakSize(depth: BookDepth) {
  let peak = 0;
  for (const row of depth.bids) peak = Math.max(peak, row.contracts);
  for (const row of depth.asks) peak = Math.max(peak, row.contracts);
  return peak || 1;
}

function DepthRow({ level, side, peak }: { level: DepthLevel; side: "bid" | "ask"; peak: number }) {
  return (
    <div className={`depth-row ${side}`}>
      <span className="mono">{fmt(level.upPrice * 100, 1)}%</span>
      <span className="depth-track" aria-hidden>
        <span className="depth-fill" style={{ width: `${Math.min(100, (level.contracts / peak) * 100)}%` }} />
      </span>
      <span className="mono">{fmt(level.contracts, 2)}</span>
    </div>
  );
}

/** Collapsed Up-book ladder. Down is 1 − Up — not a four-sided blotter. Rest quote lives here, not on Call. */
export function BookDrawer(props: {
  depth: BookDepth;
  canRest: boolean;
  busy: string | null;
  onRest: (side: "up" | "down") => void;
}) {
  const { depth } = props;
  const peak = peakSize(depth);
  const asks = [...depth.asks].reverse();
  return (
    <details className="drawer">
      <summary>Book · {summarizeDepth(depth)}</summary>
      {depth.empty ? (
        <p className="drawer-empty">No resting size. A Call still takes when a quote appears.</p>
      ) : (
        <div className="depth" aria-label="Up book depth">
          <div className="depth-head">
            <span>Up</span>
            <span>Size</span>
          </div>
          {asks.map((level) => (
            <DepthRow key={`ask-${level.upPrice}-${level.contracts}`} level={level} side="ask" peak={peak} />
          ))}
          <div className="depth-spread">asks above · bids below</div>
          {depth.bids.map((level) => (
            <DepthRow key={`bid-${level.upPrice}-${level.contracts}`} level={level} side="bid" peak={peak} />
          ))}
        </div>
      )}
      {props.canRest && (
        <div className="rest">
          <p>
            Post-only · joins the bid. Escrow stays until fill or cancel. Expires when the Window locks — it cannot
            outlive the market. Not a Call.
          </p>
          <div className="actions">
            <button
              className="ghost"
              type="button"
              disabled={props.busy !== null}
              onClick={() => props.onRest("up")}
            >
              {props.busy === "rest-up" ? "Resting…" : "Rest Up"}
            </button>
            <button
              className="ghost"
              type="button"
              disabled={props.busy !== null}
              onClick={() => props.onRest("down")}
            >
              {props.busy === "rest-down" ? "Resting…" : "Rest Down"}
            </button>
          </div>
        </div>
      )}
    </details>
  );
}
