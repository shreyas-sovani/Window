import { formatUnits } from "viem";
import { oracleReceipt, STT_FAUCET } from "../chain/shannon";
import type { BookDepth } from "../domain/book-depth";
import { callSkipCopy } from "../domain/call-session";
import { fillEstimate, fillCopy } from "../domain/liquidity";
import { windowPhaseCopy } from "../domain/lifecycle";
import { cadenceLabel } from "../domain/series";
import { historyLine, readSeriesRecord, seriesRecordCopy } from "../domain/series-record";
import { settlePreview, settlePreviewCopy } from "../domain/settle-preview";
import type { ChipStatus, OnboardingStep } from "../domain/onboarding";
import type { WindowBoard } from "../domain/window-board";
import type { OpenTicket, OutcomeHoldings, PastWindow } from "../exchange/port";
import { BookDrawer } from "./BookDrawer";
import { countdown, fmt, historyLabel } from "./format";
import { Button, ToggleGroup } from "./kit";

export type Busy =
  | "up"
  | "down"
  | "faucet"
  | "claim"
  | "exit-up"
  | "exit-down"
  | "cancel"
  | "rest-up"
  | "rest-down"
  | "connect"
  | "switch"
  | "approve"
  | null;

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
  step: OnboardingStep;
  stepPending: string;
  claimCopy: string;
  claimDue: boolean;
  autoKey: string | null;
  cadenceStates: Record<string, ChipStatus>;
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
  const stakeNum = Number(props.stake);
  const upEst = live ? fillEstimate(props.depth, "up", Number.isFinite(stakeNum) ? stakeNum : 0) : null;
  const downEst = live ? fillEstimate(props.depth, "down", Number.isFinite(stakeNum) ? stakeNum : 0) : null;
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
  const CADENCES = [300, 900, 3600, 14400, 86400];
  const cadenceItems = CADENCES.map((c) => ({ value: String(c), label: cadenceLabel(c) }));
  const cadenceStates = Object.fromEntries(
    CADENCES.map((c): [string, "on" | "off" | "auto" | "waiting"] => {
      const status = props.cadenceStates[String(c)] ?? "none";
      const on = props.intervalSec === c;
      const auto = on && props.autoKey === `${props.asset}:${c}`;
      if (on) return [String(c), auto ? "auto" : "on"];
      if (status === "waiting") return [String(c), "waiting"];
      return [String(c), "off"];
    }),
  );
  const step = props.step;
  return (
    <>
      <nav className="series-nav" aria-label="Series">
        <ToggleGroup
          label="Asset"
          items={[
            { value: "BTC", label: "BTC" },
            { value: "ETH", label: "ETH" },
          ]}
          value={props.asset}
          onValueChange={(v) => props.onAsset(v, props.intervalSec)}
          itemStates={{ BTC: props.asset === "BTC" ? "on" : "off", ETH: props.asset === "ETH" ? "on" : "off" }}
        />
        <ToggleGroup
          label="Cadence"
          items={cadenceItems}
          value={String(props.intervalSec)}
          onValueChange={(v) => props.onAsset(props.asset, Number(v))}
          itemStates={cadenceStates}
        />
      </nav>

      <section className="board">
        <div className="kicker">
          {live
            ? `${live.asset} · ${cadenceLabel(live.intervalSec)} · ${phase ? windowPhaseCopy(phase) : "Trading"}`
            : props.loading
              ? "Reading the indexer…"
              : "No live Window"}
        </div>
        <h2 className="question" key={live?.marketId ?? "none"}>
          {live?.openingPrice ? (
            <>
              Will {live.asset} close above{" "}
              <span className="mono" key={live.openingPrice}>
                {fmt(Number(live.openingPrice), 2)}
              </span>
              ?
            </>
          ) : booting ? (
            <span className="skeleton" />
          ) : (
            "Waiting for the next Window."
          )}
        </h2>
        <div className={`clock${urgent ? " urgent" : ""}`}>
          <div className="kicker">{clockKicker}</div>
          <div className="big">{live ? countdown(live.expiry, props.now) : "--:--"}</div>
        </div>
        <div className="meta">
          <div>
            Implied Up
            <strong className="mono" key={implied !== undefined ? implied.toFixed(3) : "none"}>
              {implied !== undefined ? `${fmt(implied * 100, 1)}%` : booting ? <span className="skeleton" /> : "—"}
            </strong>
          </div>
          <div>
            Volume
            <strong className="mono">{live?.volumeQuote !== undefined ? `${fmt(live.volumeQuote, 2)} tUSDC` : "—"}</strong>
          </div>
          <div>
            Trades
            <strong className="mono">{live?.tradeCount ?? "—"}</strong>
          </div>
        </div>
      </section>

      {(props.seriesPnl || (props.history && props.history.length > 0)) && (
        <div className="history" aria-label="Series history">
          {props.seriesPnl && <div className="record pnl">{props.seriesPnl}</div>}
          {props.history && props.history.length > 0 && (
            <>
              <div className="record">{seriesRecordCopy(readSeriesRecord(props.history))}</div>
              {props.history.map((row) => {
                const line = historyLine(row.openingPrice);
                const body = (
                  <>
                    {historyLabel(row.result)}
                    <small>
                      {new Date(row.expiry * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {line !== undefined ? ` · ${fmt(line, 2)}` : ""}
                    </small>
                  </>
                );
                return row.oracleQuestionId ? (
                  <a
                    key={row.marketId}
                    className={`chip ${row.result}`}
                    href={oracleReceipt(row.oracleQuestionId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {body}
                  </a>
                ) : (
                  <span key={row.marketId} className={`chip ${row.result}`}>
                    {body}
                  </span>
                );
              })}
            </>
          )}
        </div>
      )}

      <div className="ticket">
        <div className="ticket-stake">
          <label htmlFor="stake">Stake (tUSDC)</label>
          <input id="stake" value={props.stake} onChange={(e) => props.onStake(e.target.value)} inputMode="decimal" />
          <div className="preview">
            {board.upPlan.ok ? (
              board.downPlan.ok ? (
                "Both sides are executable at these odds."
              ) : (
                "Down has no executable odds at this stake yet."
              )
            ) : (
              callSkipCopy(board.upPlan.reason)
            )}
          </div>
          {step.kind === "approve" && (
            <Button variant="primary" className="onboard-action" disabled={props.primaryBusy} onClick={props.onPrimary}>
              {props.stepPending || step.action}
            </Button>
          )}
        </div>
        <div className="side up">
          <div className="kicker">Up · close ≥ Line</div>
          <div className="odds tick" key={implied !== undefined ? `u${implied.toFixed(3)}` : "u"}>
            {implied !== undefined ? `${fmt(implied * 100, 1)}%` : "—"}
          </div>
          <div className="risk">
            {board.upPlan.ok ? (
              <>
                Risk {fmt(board.upPlan.plan.maxLoss, 2)} → Win {fmt(board.upPlan.plan.payoutIfWin, 2)} tUSDC ·{" "}
                {fmt(board.upPlan.plan.contracts, 2)} contracts
              </>
            ) : (
              callSkipCopy(board.upPlan.reason)
            )}
          </div>
          {upEst && (
            <div className="fill mono">
              {fillCopy(upEst)}
              {upEst.maxStake > 0.005 && (
                <button
                  className="linklike"
                  type="button"
                  onClick={() => props.onStake(String(Math.floor(upEst.maxStake * 100) / 100))}
                >
                  Use max {fmt(upEst.maxStake, 2)} tUSDC
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            disabled={!board.gate.canCall || props.primaryBusy || !board.upPlan.ok}
            title={
              !board.gate.canCall
                ? "Connect a Shannon wallet and approve tUSDC first."
                : !board.upPlan.ok
                  ? callSkipCopy(board.upPlan.reason)
                  : "IOC take at a protective limit — leftovers cancel, nothing rests."
            }
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
          <div className="risk">
            {board.downPlan.ok ? (
              <>
                Risk {fmt(board.downPlan.plan.maxLoss, 2)} → Win {fmt(board.downPlan.plan.payoutIfWin, 2)} tUSDC ·{" "}
                {fmt(board.downPlan.plan.contracts, 2)} contracts
              </>
            ) : (
              callSkipCopy(board.downPlan.reason)
            )}
          </div>
          {downEst && (
            <div className="fill mono">
              {fillCopy(downEst)}
              {downEst.maxStake > 0.005 && (
                <button
                  className="linklike"
                  type="button"
                  onClick={() => props.onStake(String(Math.floor(downEst.maxStake * 100) / 100))}
                >
                  Use max {fmt(downEst.maxStake, 2)} tUSDC
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            disabled={!board.gate.canCall || props.primaryBusy || !board.downPlan.ok}
            title={
              !board.gate.canCall
                ? "Connect a Shannon wallet and approve tUSDC first."
                : !board.downPlan.ok
                  ? callSkipCopy(board.downPlan.reason)
                  : "IOC take at a protective limit — leftovers cancel, nothing rests."
            }
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

      {props.claimDue && (
        <section className="rewards" aria-label="Claim rewards">
          <div>
            <h3 className="rewards-title">Winnings ready</h3>
            <p className="rewards-sub">{props.claimCopy}</p>
          </div>
          <Button variant="primary" disabled={props.primaryBusy} onClick={props.onClaim}>
            {props.busy === "claim" ? "Claiming…" : "Claim"}
          </Button>
        </section>
      )}

      {step.kind !== "call" && (
        <section className="onboard" aria-label="Next action">
          <div className="onboard-copy">
            <div className="kicker">Next step</div>
            <h3 className="onboard-title">{step.title}</h3>
            <p className="onboard-exp">{step.explanation}</p>
          </div>
          {step.action &&
            (step.kind === "gas" ? (
              <Button variant="primary" className="onboard-action" href={STT_FAUCET}>
                {step.action}
              </Button>
            ) : step.kind === "mint" ? (
              <Button
                variant="primary"
                className="onboard-action"
                disabled={!props.faucetEnabled || props.busy !== null}
                onClick={props.onFaucet}
              >
                {props.busy === "faucet" ? "Minting…" : step.action}
              </Button>
            ) : step.kind === "wait" ? null : (
              <Button variant="primary" className="onboard-action" disabled={props.primaryBusy} onClick={props.onPrimary}>
                {props.stepPending || step.action}
              </Button>
            ))}
        </section>
      )}

      <div className="utilities">
        {!props.claimDue && props.address && (
          <button className="linklike" type="button" disabled={props.busy !== null} onClick={props.onClaim}>
            {props.busy === "claim" ? "Claiming…" : "Claim finalized"}
          </button>
        )}
        {props.faucetEnabled && step.kind !== "mint" && (
          <button className="linklike" type="button" disabled={props.busy !== null} onClick={props.onFaucet}>
            {props.busy === "faucet" ? "Minting…" : "Mint tUSDC"}
          </button>
        )}
        <a className="linklike" href={STT_FAUCET} target="_blank" rel="noreferrer">
          Get STT gas
        </a>
        {live?.oracleQuestionId && (
          <a className="linklike" href={oracleReceipt(live.oracleQuestionId)} target="_blank" rel="noreferrer">
            Oracle receipt
          </a>
        )}
      </div>
    </>
  );
}
