import { createFakeExchange, type FakeExchangeState } from "./fake";
import {
  demoBookFor,
  demoHistoryFor,
  demoResultFor,
  demoSeries,
  demoWindowAt,
} from "./demo-universe";
import type { DemoFillRow } from "../domain/demo-state";
import type { ExchangePort } from "./port";

/**
 * The demo adapter: the repo's deterministic fake exchange driven by the demo
 * universe. Every browser derives the same windows from the wall clock, so a
 * shared link carries only fills (hydrateFills/exportFillsFor). Settling is
 * deterministic from the marketId, successors roll automatically, and winners
 * get a claim row — the full product loop with zero indexer and zero chain.
 */
export function createDemoExchange(
  opts: { now?: () => number; account?: string; seedFrom?: ReturnType<typeof createFakeExchange> } = {},
): ExchangePort & {
  state: FakeExchangeState;
  actAs(account?: string): void;
  hydrateFills(rows: DemoFillRow[]): void;
  exportFillsFor(txHashes: string[]): DemoFillRow[];
} {
  const now = opts.now ?? (() => Math.floor(Date.now() / 1000));
  // Demo tx hashes must be globally unique: a shared link carries fills from
  // many browsers, and two instances both minting "0xfake1" would collide.
  const instanceTag = Math.floor(Math.random() * 0xffff_ffff).toString(16).padStart(8, "0");
  let demoTxSeq = 0;
  const fake = opts.seedFrom ?? createFakeExchange({
    txHashFactory: () => `0xdemo${instanceTag}${(demoTxSeq += 1).toString(16).padStart(8, "0")}`,
  });
  const state = fake.state;
  if (opts.account) state.actingAccount = opts.account;

  /** Universe marketId → window, so hydrated fills can find their pool. */
  function windowFor(marketId: string): ReturnType<typeof demoWindowAt> | null {
    const t = now();
    const idx = Math.floor((t - 1788000000) / 150);
    for (const s of demoSeries()) {
      for (let i = -2; i <= 2; i += 1) {
        const w = demoWindowAt(s.asset, s.intervalSec, 1788000000 + (idx + i) * 150 + 5);
        if (w.marketId.toLowerCase() === marketId.toLowerCase()) return w;
      }
    }
    return null;
  }

  function tick() {
    const t = now();
    for (const s of demoSeries()) {
      const cur = demoWindowAt(s.asset, s.intervalSec, t);
      const existing = state.windows.find((w) => w.marketId === cur.marketId);
      if (!existing) {
        state.windows.push(cur);
        state.books[cur.upSymbol] = demoBookFor(cur);
        state.statusByMarket[cur.marketId] = 1;
      }
      // Settle every demo window of this series that has expired.
      for (const w of state.windows) {
        if (w.asset !== s.asset) continue;
        if (w.status === 1 && t > w.expiry) {
          const result = demoResultFor(w.marketId);
          w.status = 4;
          w.result = result;
          state.statusByMarket[w.marketId] = 4;
          settleClaims(w.marketId, w.pool, result);
        }
      }
      // Keep the trading successor present and history fresh.
      const fresh = demoHistoryFor(s.asset, s.intervalSec, t);
      for (const h of fresh) {
        if (!state.history.some((row) => row.marketId === h.marketId)) state.history.push(h);
      }
      state.history = state.history.filter((h) => fresh.some((f) => f.marketId === h.marketId));
      // Prune: keep the current trading window plus the last two settled ones.
      const mine = state.windows.filter((w) => w.asset === s.asset);
      const settled = mine.filter((w) => w.status === 4).sort((a, b) => b.expiry - a.expiry).slice(0, 2);
      const keep = new Set([cur.marketId, ...settled.map((w) => w.marketId)]);
      state.windows = state.windows.filter((w) => w.asset !== s.asset || keep.has(w.marketId));
    }
  }

  /** A winner's claim row — the demo Claim beat reads it through the real session. */
  function settleClaims(marketId: string, pool: string, result: "up" | "down") {
    if (state.claims.some((c) => c.marketId === marketId)) return;
    const rows = state.marketFills[pool] ?? [];
    const wonByAccount = new Map<string, number>();
    for (const r of rows) {
      if ((r.marketId ?? "").toLowerCase() !== marketId.toLowerCase()) continue;
      if (!r.taker) continue;
      if (r.aggressor !== result) continue;
      const key = r.taker.toLowerCase();
      wonByAccount.set(key, (wonByAccount.get(key) ?? 0) + r.quantity);
    }
    for (const [account, contracts] of wonByAccount) {
      const balance = BigInt(Math.round(contracts * 1e6));
      state.claims.push({
        marketId: marketId as `0x${string}`,
        isResolved: true,
        isVoided: false,
        winningOutcome: result === "up" ? 0 : 1,
        up: result === "up" ? balance : 0n,
        down: result === "down" ? balance : 0n,
      });
      state.holdings[`${account}:${marketId}`] = {
        up: result === "up" ? balance : 0n,
        down: result === "down" ? balance : 0n,
        decimals: 6,
      };
    }
  }

  function wrap(): ExchangePort {
    const out = {} as ExchangePort;
    for (const key of Object.keys(fake) as (keyof ExchangePort)[]) {
      const value = fake[key];
      if (typeof value !== "function") continue;
      (out as Record<string, unknown>)[key] = async (...args: unknown[]) => {
        tick();
        return (value as (...a: unknown[]) => unknown)(...args);
      };
    }
    // marketById can name a window this fresh clock never listed (an old link):
    // derive it from the universe and settle it if its time has passed.
    out.marketById = async (marketId: `0x${string}`) => {
      tick();
      const known = state.windows.find((w) => w.marketId === marketId);
      if (known) return known;
      const w = windowFor(marketId);
      if (!w) return null;
      if (now() > w.expiry) {
        const settled = { ...w, status: 4, result: demoResultFor(w.marketId) };
        state.windows.push(settled);
        state.statusByMarket[w.marketId] = 4;
        settleClaims(w.marketId, w.pool, settled.result as "up" | "down");
        return settled;
      }
      state.windows.push(w);
      state.books[w.upSymbol] = demoBookFor(w);
      state.statusByMarket[w.marketId] = 1;
      return w;
    };
    return out;
  }

  return Object.assign(wrap(), {
    state,
    actAs(account?: string) {
      fake.actAs(account);
    },
    hydrateFills(rows: DemoFillRow[]) {
      for (const r of rows) {
        const w = windowFor(r.marketId);
        if (!w) continue; // a fill for a window this clock cannot derive is refused
        const pool = w.pool;
        const list = (state.marketFills[pool] ??= []);
        if (list.some((x) => x.txHash === r.txHash && x.id === r.id)) continue;
        list.push({
          id: r.id,
          price: r.price,
          quantity: r.quantity,
          quote: r.quote,
          aggressor: r.aggressor,
          ts: r.ts,
          txHash: r.txHash,
          marketId: r.marketId,
          taker: r.taker ?? null,
          kind: r.kind ?? null,
        });
      }
    },
    exportFillsFor(txHashes: string[]): DemoFillRow[] {
      const want = new Set(txHashes);
      const rows: DemoFillRow[] = [];
      for (const list of Object.values(state.marketFills)) {
        for (const r of list) {
          if (!want.has(r.txHash)) continue;
          if (rows.some((x) => x.txHash === r.txHash && x.id === r.id)) continue;
          rows.push({
            id: r.id,
            price: r.price,
            quantity: r.quantity,
            quote: r.quote,
            aggressor: r.aggressor ?? "up",
            ts: r.ts,
            txHash: r.txHash,
            marketId: r.marketId ?? "",
            taker: r.taker ?? null,
            kind: r.kind ?? null,
          });
        }
      }
      return rows;
    },
  });
}
