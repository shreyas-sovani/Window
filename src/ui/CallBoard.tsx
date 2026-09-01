import { callSkipCopy } from "../domain/call-session";
import type { RollPrompt } from "../domain/roll";
import { windowPhaseCopy } from "../domain/lifecycle";
import { cadenceLabel } from "../domain/series";
import type { ChipStatus, OnboardingStep } from "../domain/onboarding";
import type { WindowBoard } from "../domain/window-board";
import { Button, ToggleGroup } from "./kit";
import { countdown, fmt } from "./format";
import { STT_FAUCET } from "../chain/shannon";

/** The lock clock as a depleting ring: the arc is the Window's remaining fraction. */
function LockRing(props: { frac: number; urgent: boolean; text: string }) {
  const R = 56;
  const C = 2 * Math.PI * R;
  const frac = Math.min(1, Math.max(0, props.frac));
  return (
    <div className="ring">
      <svg viewBox="0 0 132 132" aria-hidden="true">
        <circle className="ring-track" cx="66" cy="66" r={R} />
        <circle
          className="ring-arc"
          cx="66"
          cy="66"
          r={R}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          transform="rotate(-90 66 66)"
        />
      </svg>
      <div className="ring-time">{props.text}</div>
    </div>
  );
}

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

/**
 * The Window and its ticket — question, ring, implied odds, stake, Call Up /
 * Call Down. Everything else (book, history, P&L, Rest, Exit) lives in the
 * More drawer in App. Disabled reasons ride on title attributes, not paragraphs.
 */
export function CallBoard(props: {
  board: WindowBoard;
  asset: string;
  intervalSec: number;
  now: number;
  stake: string;
  onAsset: (asset: string, intervalSec: number) => void;
  onStake: (value: string) => void;
  /** When a duel stage owns the h1, the Window question demotes to h2. */
  subordinate?: boolean;
  /** Incoming challenge: only the opposite side's Call is offered. */
  onlySide?: "up" | "down";
  loading: boolean;
  busy: Busy;
  primaryBusy: boolean;
  step: OnboardingStep;
  stepPending: string;
  autoKey: string | null;
  cadenceStates: Record<string, ChipStatus>;
  hotCadence: number | null;
  roll: RollPrompt | null;
  onRoll: (side: "up" | "down") => void;
  onDismissRoll: () => void;
  faucetEnabled: boolean;
  onPrimary: () => void;
  onCall: (side: "up" | "down") => void;
  onFaucet: () => void;
}) {
  const { board, live } = { board: props.board, live: props.board.live };
  const implied = board.implied;
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
  const CADENCES = [300, 900, 3600, 14400, 86400];
  const cadenceItems = CADENCES.map((c) => ({ value: String(c), label: cadenceLabel(c) }));
  const cadenceStates = Object.fromEntries(
    CADENCES.map((c): [string, "on" | "off" | "auto" | "waiting" | "hot"] => {
      const status = props.cadenceStates[String(c)] ?? "none";
      const on = props.intervalSec === c;
      const auto = on && props.autoKey === `${props.asset}:${c}`;
      if (on) return [String(c), auto ? "auto" : "on"];
      if (status === "waiting") return [String(c), "waiting"];
      if (props.hotCadence === c) return [String(c), "hot"];
      return [String(c), "off"];
    }),
  );
  const step = props.step;
  const Question = props.subordinate ? "h2" : "h1";
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
        <Question className="question" key={live?.marketId ?? "none"}>
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
        </Question>
        <div className={`clock${urgent ? " urgent" : ""}`}>
          <div className="kicker">{clockKicker}</div>
          {live ? (
            <LockRing
              frac={(live.expiry - props.now) / live.intervalSec}
              urgent={urgent}
              text={countdown(live.expiry, props.now)}
            />
          ) : (
            <LockRing frac={0} urgent={false} text="--:--" />
          )}
        </div>
        <div className="meta">
          <div>
            Implied Up
            <strong className="mono" key={implied !== undefined ? implied.toFixed(3) : "none"}>
              {implied !== undefined ? `${fmt(implied * 100, 1)}%` : booting ? <span className="skeleton" /> : "—"}
            </strong>
          </div>
        </div>
      </section>

      {props.roll && (
        <div className="rollbar" role="status">
          <span>
            <span className="kicker">Rematch</span>
            {props.roll.title}
          </span>
          <span className="rollbar-actions">
            <Button variant="primary" disabled={props.primaryBusy} onClick={() => props.onRoll(props.roll!.side)}>
              {props.busy === props.roll.side ? "Calling…" : props.roll.action}
            </Button>
            <button className="linklike" type="button" onClick={props.onDismissRoll}>
              Not now
            </button>
          </span>
        </div>
      )}

      <div className="ticket">
        <div className="ticket-stake">
          <label htmlFor="stake">Stake (tUSDC)</label>
          <input id="stake" value={props.stake} onChange={(e) => props.onStake(e.target.value)} inputMode="decimal" />
          <div className="presets" role="group" aria-label="Quick stake">
            {[5, 10, 25].map((v) => (
              <button
                key={v}
                type="button"
                className={`preset${props.stake === String(v) ? " on" : ""}`}
                title={`Set the stake to ${v} tUSDC`}
                onClick={() => props.onStake(String(v))}
              >
                {v}
              </button>
            ))}
          </div>
          {step.kind === "approve" && (
            <Button variant="primary" className="onboard-action" disabled={props.primaryBusy} onClick={props.onPrimary}>
              {props.stepPending || step.action}
            </Button>
          )}
        </div>
        {props.onlySide !== "down" && (
          <div className="side up">
            <div className="kicker">Up · close ≥ Line</div>
            <div className="odds tick" key={implied !== undefined ? `u${implied.toFixed(3)}` : "u"}>
              {implied !== undefined ? `${fmt(implied * 100, 1)}%` : "—"}
            </div>
            <div className="risk">
              {board.upPlan.ok && (
                <>
                  Risk {fmt(board.upPlan.plan.maxLoss, 2)} → Win {fmt(board.upPlan.plan.payoutIfWin, 2)} tUSDC ·{" "}
                  {fmt(board.upPlan.plan.contracts, 2)} contracts
                </>
              )}
            </div>
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
        )}
        {props.onlySide !== "up" && (
          <div className="side down">
            <div className="kicker">Down · close &lt; Line</div>
            <div className="odds tick" key={implied !== undefined ? `d${implied.toFixed(3)}` : "d"}>
              {implied !== undefined ? `${fmt((1 - implied) * 100, 1)}%` : "—"}
            </div>
            <div className="risk">
              {board.downPlan.ok && (
                <>
                  Risk {fmt(board.downPlan.plan.maxLoss, 2)} → Win {fmt(board.downPlan.plan.payoutIfWin, 2)} tUSDC ·{" "}
                  {fmt(board.downPlan.plan.contracts, 2)} contracts
                </>
              )}
            </div>
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
        )}
      </div>

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
    </>
  );
}
