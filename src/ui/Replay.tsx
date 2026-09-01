import { useState } from "react";
import type { Duel as DuelState } from "../domain/duel";
import { replayDuel, replayRefusalCopy, type ReplayOutcome, type ReplayRow } from "../domain/replay";
import { somniaExchange } from "../exchange/somnia";
import type { ExchangePort } from "../exchange/port";
import { Duel } from "./Duel";

/**
 * Judge replay: one browser, no second wallet. Pin the marketId, the two
 * transaction hashes, and the finalized outcome — the indexer's fill tape must
 * agree or nothing is reconstructed. A judge with one browser finishes the
 * story; a hash that is not a fill on that market fails closed.
 */
export function Replay(props: { exchange?: ExchangePort }) {
  const exchange = props.exchange ?? somniaExchange;
  const [marketId, setMarketId] = useState("");
  const [txA, setTxA] = useState("");
  const [txB, setTxB] = useState("");
  const [outcome, setOutcome] = useState<ReplayOutcome | "">("");
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<DuelState | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  async function reconstruct() {
    setRefusal(null);
    setVerdict(null);
    setBusy(true);
    try {
      const win = await exchange.marketById(marketId.trim() as `0x${string}`);
      if (!win) {
        setRefusal("That marketId is not on this chain — nothing is reconstructed.");
        return;
      }
      const rows: ReplayRow[] = (await exchange.fillsByPool(win.pool, win.decimals)).map((f) => ({
        txHash: f.txHash,
        marketId: f.marketId,
        taker: f.taker ?? null,
        side: f.aggressor,
        quantity: f.quantity,
        price: f.price,
        ts: f.ts,
      }));
      const got = replayDuel(
        {
          marketId: win.marketId,
          txA: txA.trim(),
          txB: txB.trim(),
          outcome,
          meta: { asset: win.asset, intervalSec: win.intervalSec, expiry: win.expiry, line: win.openingPrice },
        },
        rows,
      );
      if (!got.ok) {
        setRefusal(replayRefusalCopy(got.reason));
        return;
      }
      setVerdict(got.verdict);
    } catch {
      setRefusal("This replay cannot be verified — nothing is reconstructed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="replay">
      <p className="replay-intro">
        Pin one real duel: the marketId, the two transaction hashes, and the finalized outcome. The indexer's
        fill tape must agree, or nothing is reconstructed.
      </p>
      <form
        className="replay-form"
        onSubmit={(e) => {
          e.preventDefault();
          void reconstruct();
        }}
      >
        <label>
          marketId
          <input className="mono" value={marketId} onChange={(e) => setMarketId(e.target.value)} placeholder="0x…" />
        </label>
        <label>
          First tx hash
          <input className="mono" value={txA} onChange={(e) => setTxA(e.target.value)} placeholder="0x…" />
        </label>
        <label>
          Second tx hash
          <input className="mono" value={txB} onChange={(e) => setTxB(e.target.value)} placeholder="0x…" />
        </label>
        <label>
          Outcome
          <select value={outcome} onChange={(e) => setOutcome(e.target.value as ReplayOutcome | "")}>
            <option value="">Pin the finalized outcome…</option>
            <option value="up">Up</option>
            <option value="down">Down</option>
            <option value="void">Void</option>
          </select>
        </label>
        <button type="submit" className="btn primary" disabled={busy || !marketId || !txA || !txB || !outcome}>
          {busy ? "Reading the tape…" : "Reconstruct the duel"}
        </button>
      </form>
      {refusal && <p className="replay-refusal mono">{refusal}</p>}
      {verdict && <Duel duel={verdict} onAccept={() => undefined} acceptBusy={false} />}
    </div>
  );
}
