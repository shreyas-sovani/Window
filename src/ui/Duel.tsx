import { explorerTx } from "../chain/shannon";
import { duelRefusalCopy, type Duel as DuelState, type DuelFill } from "../domain/duel";
import { cadenceLabel } from "../domain/series";
import { shorten } from "./format";
import { Button } from "./kit";

const n2 = (n: number) => n.toFixed(2);

function FillRow(props: { label: string; fill: DuelFill }) {
  const f = props.fill;
  return (
    <div className="duel-row">
      <span className="mono">{props.label} {shorten(f.account)}</span>
      <span className="mono">
        Called {f.side.toUpperCase()} · {n2(f.contracts)} @ ~{Math.round(f.avgOdds * 100)}% · {n2(f.escrow)} tUSDC
      </span>
      <a className="linklike mono" href={explorerTx(f.txHash)} target="_blank" rel="noreferrer">
        {shorten(f.txHash)}
      </a>
    </div>
  );
}

/**
 * The duel surface while its chain reads are still in flight. A pending read is
 * never a refusal: the refusal states below all claim missing evidence, and
 * until the reads land the app does not know that.
 */
export function DuelVerifying() {
  return (
    <section className="duel verifying" aria-label="Challenge verifying">
      <h1 className="duel-h">Challenge</h1>
      <p>Verifying on the chain — the Window and fill tape decide, not this link.</p>
    </section>
  );
}

/**
 * The duel surface: one Window, two social opponents, opposite Calls. The URL
 * brought you here; the chain decided everything on screen. Opponents are never
 * each other's exchange counterparty and the second fill was never promised.
 */
export function Duel(props: {
  duel: DuelState;
  onAccept: () => void;
  acceptBusy: boolean;
  acceptLabel?: string;
  acceptDisabled?: boolean;
  acceptHref?: string;
  /** Successor rematch for a participant: same two wallets, opposite sides. */
  rematch?: { opponent: string; side: "up" | "down"; cadence: string } | null;
  onRematch?: () => void;
  /** Claim for a due participant: winner on settled, either on void (half). */
  claimLabel?: string;
  claimBusy?: boolean;
  onClaim?: () => void;
}) {
  const d = props.duel;

  if (d.kind === "invalid") {
    return (
      <section className="duel refusal" aria-label="Challenge refused">
        <h1 className="duel-h">Challenge</h1>
        <p>{duelRefusalCopy(d.reason)}</p>
      </section>
    );
  }

  if (d.kind === "challenge") {
    const c = d.challenge;
    const acceptSide = c.side === "up" ? "DOWN" : "UP";
    return (
      <section className="duel challenge" aria-label="Incoming challenge">
        <h1 className="duel-h">Challenge</h1>
        <div className="kicker">{c.asset} {cadenceLabel(c.intervalSec)} · Line {c.line ? Number(c.line).toFixed(2) : "—"}</div>
        <FillRow label="Challenger" fill={{ ...c, escrow: c.stake, account: c.challenger, marketId: c.marketId, ts: 0 }} />
        <p className="duel-note">Opponents are not counterparties — each Call is its own take.</p>
        {c.minStake !== undefined && (
          <small className="mono duel-floor">Stake at least {n2(c.minStake)} tUSDC — a smaller fill is not an accept.</small>
        )}
        {c.until !== undefined && (
          <small className="mono duel-floor">Invite closes before lock — a later fill is not an accept.</small>
        )}
        <Button
          variant="primary"
          autoFocus
          href={props.acceptHref}
          disabled={props.acceptBusy || props.acceptDisabled}
          aria-disabled={props.acceptBusy || props.acceptDisabled || undefined}
          onClick={props.onAccept}
        >
          {props.acceptBusy ? "Working…" : (props.acceptLabel ?? `Call ${acceptSide} to accept challenge`)}
        </Button>
      </section>
    );
  }

  if (d.kind === "open") {
    return (
      <section className="duel open" aria-label="Duel open">
        <h1 className="duel-h">Duel</h1>
        <div className="kicker">{d.duel.asset} {cadenceLabel(d.duel.intervalSec)} · Line {d.duel.line ? Number(d.duel.line).toFixed(2) : "—"}</div>
        <p className="duel-line mono">Line {d.duel.line ? Number(d.duel.line).toFixed(2) : "—"}</p>
        <FillRow label="Challenger" fill={d.duel.challengerFill} />
        <FillRow label="Acceptor" fill={d.duel.acceptorFill} />
        <small className="duel-note">
          Two verified fills, opposite sides, unequal stakes allowed — settles when the Window locks.
        </small>
      </section>
    );
  }

  if (d.kind === "settled") {
    return (
      <section className="duel settled" aria-label="Duel settled">
        <h1 className="duel-h">Result</h1>
        <div className="kicker">{d.asset} {cadenceLabel(d.intervalSec)} · Line {d.line ? Number(d.line).toFixed(2) : "—"}</div>
        <p>
          <strong>Winner</strong> <span className="mono">{shorten(d.winner.account)}</span> — {d.winner.side.toUpperCase()} wins.
        </p>
        <FillRow label="Winner" fill={d.winner} />
        <FillRow label="Loser" fill={d.loser} />
        {props.claimLabel && props.onClaim && (
          <Button variant="primary" disabled={props.claimBusy} onClick={props.onClaim}>
            {props.claimBusy ? "Claiming…" : props.claimLabel}
          </Button>
        )}
        {props.rematch && props.onRematch && (
          <Button variant="ghost" onClick={props.onRematch}>
            Rematch {shorten(props.rematch.opponent)} — Call {props.rematch.side.toUpperCase()} on the next{" "}
            {props.rematch.cadence} Window
          </Button>
        )}
      </section>
    );
  }

  if (d.kind === "void") {
    return (
      <section className="duel void" aria-label="Duel void">
        <h1 className="duel-h">Result</h1>
        <div className="kicker">{d.duel.asset} {cadenceLabel(d.duel.intervalSec)} · Line {d.duel.line ? Number(d.duel.line).toFixed(2) : "—"}</div>
        <p>
          <strong>Void — a draw.</strong> No reliable close: both sides redeem at half.
        </p>
        <FillRow label="Challenger" fill={d.duel.challengerFill} />
        <FillRow label="Acceptor" fill={d.duel.acceptorFill} />
        {props.claimLabel && props.onClaim && (
          <Button variant="primary" disabled={props.claimBusy} onClick={props.onClaim}>
            {props.claimBusy ? "Claiming…" : props.claimLabel}
          </Button>
        )}
        {props.rematch && props.onRematch && (
          <Button variant="ghost" onClick={props.onRematch}>
            Rematch {shorten(props.rematch.opponent)} — Call {props.rematch.side.toUpperCase()} on the next{" "}
            {props.rematch.cadence} Window
          </Button>
        )}
      </section>
    );
  }

  return (
    <section className="duel expired" aria-label="Challenge expired">
      <h1 className="duel-h">Challenge</h1>
      <p>
        {d.cause === "invite"
          ? "The invite closed before anyone accepted — an expired challenge, not a win."
          : "Only one side filled before this Window locked — an expired challenge, not a win."}
      </p>
    </section>
  );
}
