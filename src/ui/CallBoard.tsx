import { formatUnits } from "viem";
import { oracleReceipt, STT_FAUCET } from "../chain/shannon";
import type { BookDepth } from "../domain/book-depth";
import { callSkipCopy } from "../domain/call-session";
import { windowPhaseCopy } from "../domain/lifecycle";
import { cadenceLabel, SERIES_CHIPS } from "../domain/series";
import { readSeriesRecord, seriesRecordCopy } from "../domain/series-record";
import { settlePreview, settlePreviewCopy } from "../domain/settle-preview";
import type { WindowBoard } from "../domain/window-board";
import type { OpenTicket, OutcomeHoldings, PastWindow } from "../exchange/port";
import { BookDrawer } from "./BookDrawer";
import { countdown, fmt, historyLabel } from "./format";

export type Busy = "up" | "down" | "faucet" | "claim" | "exit-up" | "exit-down" | "cancel" | "rest-up" | "rest-down" | null;

export function CallBoard(props: {
  board: WindowBoard;
  asset: string;
  intervalSec: number;
  now: number;
  stake: string;
  onAsset: (asset: string, intervalSec: number) => void;
  onStake: (value: string) => void;
  loading: boolean;
  history: PastWindow[] | undefined;
  seriesPnl?: string;
  holdings: OutcomeHoldings | undefined;
  tickets: OpenTicket[] | undefined;
  address?: string;
  busy: Busy;
  primaryBusy: boolean;
  primaryLabel: string;
  showPrimary: boolean;
  claimDue: boolean;
  faucetEnabled: boolean;
  onPrimary: () => void;
  onCall: (side: "up" | "down") => void;
  onExit: (side: "up" | "down") => void;
  onClaim: () => void;
  onFaucet: () => void;
  onCancel: (id: string, symbol: string) => void;
  onRest: (side: "up" | "down") => void;
  depth: BookDepth;
  feeBps?: bigint;
}) {
  const { board, live } = { board: props.board, live: props.board.live };
  const implied = board.implied;
  const preview = props.holdings
    ? settlePreview({ up: props.holdings.up, down: props.holdings.down, feeBps: props.feeBps })
    : null;
  const booting = props.loading && !live;
  const phase = board.phase;
  const locking = phase?.kind === "too-close" || phase?.kind === "locked" || phase?.kind === "settling";
  const urgent = locking || (live ? live.expiry - props.now < 60 : false);
  const clockKicker =
    phase?.kind === "locked"
      ? "Locked"
      : phase?.kind === "settling"
        ? "Settling"
        : phase?.kind === "too-close"
          ? "Locking"
          : "Locks in";
  return (
    <>
      <nav className="series">
        {SERIES_CHIPS.map((s) => (
          <button
            key={s.label}
            type="button"
            className={props.asset === s.asset && props.intervalSec === s.intervalSec ? "on" : ""}
            onClick={() => props.onAsset(s.asset, s.intervalSec)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <section className="board">
        <div className="line-row">
          <div>
            <div className="kicker">Line · open</div>
            <div className="big" key={live?.openingPrice ?? "none"}>
              {live?.openingPrice ? (
                fmt(Number(live.openingPrice), 2)
              ) : booting ? (
                <span className="skeleton" />
              ) : (
                "—"
              )}
            </div>
          </div>
          <div className={`clock${urgent ? " urgent" : ""}`}>
            <div className="kicker">{clockKicker}</div>
            <div className="big">{live ? countdown(live.expiry, props.now) : "--:--"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="kicker">Implied Up</div>
            <div className="big" key={implied !== undefined ? implied.toFixed(3) : "none"}>
              {implied !== undefined ? `${fmt(implied * 100, 1)}%` : booting ? <span className="skeleton" /> : "—"}
            </div>
          </div>
        </div>
        <div className="meta">
          <div>
            Volume
            <strong className="mono">{live?.volumeQuote !== undefined ? `${fmt(live.volumeQuote, 2)} tUSDC` : "—"}</strong>
          </div>
          <div>
            Trades
            <strong className="mono">{live?.tradeCount ?? "—"}</strong>
          </div>
          <div>
            Window
            <strong className="mono">
              {live
                ? `${live.asset} · ${cadenceLabel(live.intervalSec)} · ${phase ? windowPhaseCopy(phase) : "Trading"}`
                : props.loading
                  ? "Loading…"
                  : "None live"}
            </strong>
          </div>
        </div>
      </section>

      {(props.seriesPnl || (props.history && props.history.length > 0)) && (
        <div className="history" aria-label="Series history">
          {props.seriesPnl && <div className="record pnl">{props.seriesPnl}</div>}
          {props.history && props.history.length > 0 && (
            <>
              <div className="record">{seriesRecordCopy(readSeriesRecord(props.history))}</div>
              {props.history.map((row) => (
                <span key={row.marketId} className={`chip ${row.result}`}>
                  {historyLabel(row.result)}
                  <small>{new Date(row.expiry * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                </span>
              ))}
            </>
          )}
        </div>
      )}

      <div className="stake">
        <div>
          <label htmlFor="stake">Stake (tUSDC)</label>
          <input id="stake" value={props.stake} onChange={(e) => props.onStake(e.target.value)} inputMode="decimal" />
        </div>
        <div className="preview">
          {board.upPlan.ok ? (
            <>
              Up max loss {fmt(board.upPlan.plan.maxLoss, 2)} · win {fmt(board.upPlan.plan.payoutIfWin, 2)} tUSDC
              <br />
              Down max loss {board.downPlan.ok ? fmt(board.downPlan.plan.maxLoss, 2) : "—"} · win{" "}
              {board.downPlan.ok ? fmt(board.downPlan.plan.payoutIfWin, 2) : "—"} tUSDC
            </>
          ) : (
            callSkipCopy(board.upPlan.reason)
          )}
        </div>
      </div>

      <div className="ticket">
        <div className="side up">
          <div className="kicker">Up · close ≥ Line</div>
          <div className="odds tick" key={implied !== undefined ? `u${implied.toFixed(3)}` : "u"}>
            {implied !== undefined ? `${fmt(implied * 100, 1)}%` : "—"}
          </div>
          <button
            type="button"
            disabled={!board.gate.canCall || props.primaryBusy || !board.upPlan.ok}
            onClick={() => props.onCall("up")}
          >
            {props.busy === "up" ? "Calling…" : "Call Up"}
          </button>
        </div>
        <div className="side down">
          <div className="kicker">Down · close &lt; Line</div>
          <div className="odds tick" key={implied !== undefined ? `d${implied.toFixed(3)}` : "d"}>
            {implied !== undefined ? `${fmt((1 - implied) * 100, 1)}%` : "—"}
          </div>
          <button
            type="button"
            disabled={!board.gate.canCall || props.primaryBusy || !board.downPlan.ok}
            onClick={() => props.onCall("down")}
          >
            {props.busy === "down" ? "Calling…" : "Call Down"}
          </button>
        </div>
      </div>

      <BookDrawer
        depth={props.depth}
        canRest={board.gate.canCall}
        busy={props.busy}
        onRest={props.onRest}
      />

      {props.address && live && (
        <div className="banner">
          Your call this Window:{" "}
          {props.holdings
            ? `${formatUnits(props.holdings.up, props.holdings.decimals)} Up · ${formatUnits(props.holdings.down, props.holdings.decimals)} Down`
            : "…"}
          {preview && !preview.empty && props.holdings && (
            <div className="settle">{settlePreviewCopy(preview, props.holdings.decimals, props.feeBps)}</div>
          )}
          <div className="actions" style={{ marginTop: 8 }}>
            <button
              className="ghost"
              type="button"
              disabled={!props.holdings || props.holdings.up === 0n || props.busy !== null}
              onClick={() => props.onExit("up")}
            >
              {props.busy === "exit-up" ? "Exiting…" : "Exit Up"}
            </button>
            <button
              className="ghost"
              type="button"
              disabled={!props.holdings || props.holdings.down === 0n || props.busy !== null}
              onClick={() => props.onExit("down")}
            >
              {props.busy === "exit-down" ? "Exiting…" : "Exit Down"}
            </button>
          </div>
        </div>
      )}

      {props.tickets && props.tickets.length > 0 && (
        <div className="banner">
          Resting orders (IOC Calls should not leave these — cancel to free escrow)
          <ul className="tickets">
            {props.tickets.map((t) => (
              <li key={t.id}>
                <span className="mono">
                  {t.side} {fmt(t.remaining, 3)} @ {fmt(t.price, 3)} · {t.symbol}
                </span>
                <button
                  className="ghost"
                  type="button"
                  disabled={props.busy !== null}
                  onClick={() => props.onCancel(t.id, t.symbol)}
                >
                  {props.busy === "cancel" ? "Cancelling…" : "Cancel"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="actions">
        {props.showPrimary && (
          <button
            className={props.claimDue ? "primary" : "ghost"}
            type="button"
            disabled={props.primaryBusy}
            onClick={props.onPrimary}
          >
            {props.primaryLabel}
          </button>
        )}
        <button className="ghost" type="button" disabled={!props.faucetEnabled || props.busy !== null} onClick={props.onFaucet}>
          {props.busy === "faucet" ? "Minting…" : "Mint tUSDC"}
        </button>
        {!props.claimDue && (
          <button className="ghost" type="button" disabled={!props.address || props.busy !== null} onClick={props.onClaim}>
            {props.busy === "claim" ? "Claiming…" : "Claim finalized"}
          </button>
        )}
        <a className="ghost" href={STT_FAUCET} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          Get STT gas
        </a>
        {live?.oracleQuestionId && (
          <a className="ghost" href={oracleReceipt(live.oracleQuestionId)} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            Oracle receipt
          </a>
        )}
      </div>
    </>
  );
}
