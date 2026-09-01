import { explorerTx } from "../chain/shannon";
import { duelRefusalCopy, type Duel as DuelState, type DuelFill } from "../domain/duel";
import { cadenceLabel } from "../domain/series";
import { shorten } from "./format";

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
 * The duel surface: one Window, two social opponents, opposite Calls. The URL
 * brought you here; the chain decided everything on screen. Opponents are never
 * each other's exchange counterparty and the second fill was never promised.
 */
export function Duel(props: { duel: DuelState; onAccept: () => void; acceptBusy: boolean }) {
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
        <FillRow label="" fill={{ ...c, escrow: c.stake, account: c.challenger, marketId: c.marketId, ts: 0 }} />
        <p className="duel-note">Opponents are not counterparties — each Call is its own take.</p>
        <button
          type="button"
          className="btn primary"
          autoFocus
          disabled={props.acceptBusy}
          onClick={props.onAccept}
        >
          {props.acceptBusy ? "Calling…" : `Call ${acceptSide} to accept challenge`}
        </button>
      </section>
    );
  }

  if (d.kind === "open") {
    return (
      <section className="duel open" aria-label="Duel open">
        <h1 className="duel-h">Duel</h1>
        <div className="kicker">{d.duel.asset} {cadenceLabel(d.duel.intervalSec)} · Line {d.duel.line ? Number(d.duel.line).toFixed(2) : "—"}</div>
        <p className="duel-line mono">Line {d.duel.line ? Number(d.duel.line).toFixed(2) : "—"}</p>
        <FillRow label="" fill={d.duel.challengerFill} />
        <FillRow label="" fill={d.duel.acceptorFill} />
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
        <FillRow label="" fill={d.winner} />
        <FillRow label="" fill={d.loser} />
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
        <FillRow label="" fill={d.duel.challengerFill} />
        <FillRow label="" fill={d.duel.acceptorFill} />
      </section>
    );
  }

  return (
    <section className="duel expired" aria-label="Challenge expired">
      <h1 className="duel-h">Challenge</h1>
      <p>Only one side filled before this Window locked — an expired challenge, not a win.</p>
    </section>
  );
}
