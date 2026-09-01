import { useState } from "react";
import type { Duel as DuelState } from "../domain/duel";
import { replayDuel, replayRefusalCopy, type ReplayRow } from "../domain/replay";
import { somniaExchange } from "../exchange/somnia";
import type { ExchangePort } from "../exchange/port";
import { Duel } from "./Duel";

/**
 * Judge replay: one browser, no second wallet. Pin the marketId, the two
 * transaction hashes. The market's finalized result and the indexer's fill tape
 * must agree or nothing is reconstructed. A judge with one browser finishes the
 * story; a hash that is not a fill on that market fails closed.
 */
export function Replay(props: {
  exchange?: ExchangePort;
  initial?: { marketId?: string; txA?: string; txB?: string };
}) {
  const exchange = props.exchange ?? somniaExchange;
  const [marketId, setMarketId] = useState(props.initial?.marketId ?? "");
  const [txA, setTxA] = useState(props.initial?.txA ?? "");
  const [txB, setTxB] = useState(props.initial?.txB ?? "");
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
      if ((win.status !== 4 && win.status !== 5) || !win.result || win.result === "unknown") {
        setRefusal("That Window is not finalized with a verifiable result — nothing is reconstructed.");
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
          settlement: win.result,
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
        Pin one real duel: the marketId and two transaction hashes. The finalized Window and its fill tape must
        agree, or nothing is reconstructed.
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
        <button type="submit" className="btn primary" disabled={busy || !marketId || !txA || !txB}>
          {busy ? "Reading the tape…" : "Reconstruct the duel"}
        </button>
      </form>
      {refusal && <p className="replay-refusal mono">{refusal}</p>}
      {verdict && <Duel duel={verdict} onAccept={() => undefined} acceptBusy={false} />}
    </div>
  );
}
