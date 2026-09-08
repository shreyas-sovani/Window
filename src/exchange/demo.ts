import { createFakeExchange, type FakeExchangeState } from "./fake";
import {
  DEMO_EPOCH_SEC,
  demoBookFor,
  demoDepthFor,
  demoHistoryFor,
  demoPriceFor,
  demoResultFor,
  demoSeries,
  demoTapeFor,
  demoWindowAt,
  demoWindowIndex,
  demoWindowSec,
} from "./demo-universe";
import { planCall } from "../domain/call-ticket";
import { readClaimSession } from "../domain/claim-session";
import { fillEstimate } from "../domain/liquidity";
import type { DemoFillRow } from "../domain/demo-state";
import type { ExchangePort, LiveWindow, StakeQuote } from "./port";

/**
 * The demo adapter: the repo's deterministic fake exchange driven by the demo
 * universe. Every browser derives the same windows and the same deep book from
 * the wall clock, so a shared link carries only fills (hydrateFills /
 * exportFillsFor). Settling is deterministic from the marketId, successors roll
 * automatically, and winners get a claim row — the full product loop with zero
 * indexer and zero chain.
 */
export type DemoExchange = ReturnType<typeof createDemoExchange>;

const sessions = new Map<string, DemoExchange>();

/**
 * One demo adapter per simulated wallet, for the life of the page. The demo
 * market is in-memory state — receipts, holdings, claims, the tape a shared
 * link hydrated — so rebuilding it on a re-render (the terminal rewrites its
 * own hash when an accept verifies) would silently reset the demo mid-take.
 */
export function demoExchangeFor(account: string): DemoExchange {
  const key = account.toLowerCase();
  let session = sessions.get(key);
  if (!session) {
    session = createDemoExchange({ account });
    sessions.set(key, session);
  }
  return session;
}

export function createDemoExchange(
  opts: { now?: () => number; account?: string; seedFrom?: ReturnType<typeof createFakeExchange> } = {},
): ExchangePort & {
  state: FakeExchangeState;
  actAs(account?: string): void;
  hydrateFills(rows: DemoFillRow[]): void;
  exportFillsFor(txHashes: string[]): DemoFillRow[];
  /** A FOK take stamped to another demo wallet — the simulated opponent. */
  takeAs(account: string, symbol: string, contracts: number, price: number): Promise<string | undefined>;
} {
  const now = opts.now ?? (() => Math.floor(Date.now() / 1000));
  // Demo tx hashes must be globally unique: a shared link carries fills from
  // many browsers, and two instances both minting "0xfake1" would collide.
  const instanceTag = Math.floor(Math.random() * 0xffff_ffff).toString(16).padStart(8, "0");
  let demoTxSeq = 0;
  const fake = opts.seedFrom ?? createFakeExchange({
    txHashFactory: () => `0xdemo${instanceTag}${(demoTxSeq += 1).toString(16).padStart(8, "0")}`,
    // Fills are stamped with the demo clock, so a demo tape, its invite close,
    // and its settlement all read from the one universe clock.
    nowSec: () => now(),
  });
  const state = fake.state;
  if (opts.account) state.actingAccount = opts.account;

  /**
   * Universe marketId → window, so hydrated fills and old links can find their
   * pool. Each series has its own window length, and a shared link can name a
   * Window several rolls back, so the scan reaches behind the current index.
   */
  const resolved = new Map<string, ReturnType<typeof demoWindowAt>>();
  function windowFor(marketId: string): ReturnType<typeof demoWindowAt> | null {
    const key = marketId.toLowerCase();
    const cached = resolved.get(key);
    if (cached) return cached;
    const t = now();
    for (const s of demoSeries()) {
      const span = demoWindowSec(s.intervalSec);
      const idx = demoWindowIndex(s.intervalSec, t);
      for (let i = 2; i >= -12; i -= 1) {
        if (idx + i < 0) continue;
        const w = demoWindowAt(s.asset, s.intervalSec, DEMO_EPOCH_SEC + (idx + i) * span + 5);
        if (w.marketId.toLowerCase() === key) {
          resolved.set(key, w);
          return w;
        }
      }
    }
    return null;
  }

  function tick() {
    const t = now();
    // Phase 1 — seed and settle every series (a per-series prune here would
    // delete the other cadences of the same asset; pruning is one pass below).
    const keep = new Set<string>();
    const freshIds = new Set<string>();
    for (const s of demoSeries()) {
      const cur = demoWindowAt(s.asset, s.intervalSec, t);
      keep.add(cur.marketId);
      if (!state.windows.some((w) => w.marketId === cur.marketId)) {
        state.windows.push(cur);
        state.books[cur.upSymbol] = demoBookFor(cur);
        state.statusByMarket[cur.marketId] = 1;
      }
      for (const w of state.windows) {
        if (w.asset !== s.asset || w.intervalSec !== s.intervalSec) continue;
        // Other traders arrive while the Window is live: the pool tape grows,
        // and the Window's volume and trade count are its own tape's sums.
        seedTape(w, t);
        if (w.status === 1 && t > w.expiry) {
          const result = demoResultFor(w.marketId);
          w.status = 4;
          w.result = result;
          state.statusByMarket[w.marketId] = 4;
          settleClaims(w.marketId, w.pool, result);
        }
      }
      for (const h of demoHistoryFor(s.asset, s.intervalSec, t)) freshIds.add(h.marketId);
      // Keep the two most recent settled windows of this series for duel links.
      const settled = state.windows
        .filter((w) => w.asset === s.asset && w.intervalSec === s.intervalSec && w.status === 4)
        .sort((a, b) => b.expiry - a.expiry)
        .slice(0, 2);
      for (const w of settled) keep.add(w.marketId);
    }
    // Phase 2 — one prune across everything; history is exactly the fresh rows.
    state.windows = state.windows.filter((w) => keep.has(w.marketId));
    state.history = state.history.filter((h) => freshIds.has(h.marketId));
    for (const s of demoSeries()) {
      for (const h of demoHistoryFor(s.asset, s.intervalSec, t)) {
        if (!state.history.some((row) => row.marketId === h.marketId)) state.history.push(h);
      }
    }
  }

  /** Deterministic market colour on the pool tape, up to the current moment. */
  function seedTape(w: LiveWindow, atSec: number) {
    const list = (state.marketFills[w.pool] ??= []);
    for (const row of demoTapeFor(w.marketId, w.expiry, w.intervalSec, atSec)) {
      if (list.some((x) => x.id === row.id)) continue;
      list.push(row);
    }
    const mine = list.filter((r) => (r.marketId ?? "").toLowerCase() === w.marketId.toLowerCase());
    w.volumeQuote = Number(mine.reduce((sum, r) => sum + r.quote, 0).toFixed(2));
    w.tradeCount = mine.length;
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
        account,
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

  /** This wallet's settled rows only — the loser must never be offered the winner's payout. */
  function claimRowsFor(account: string) {
    const who = account.toLowerCase();
    return state.claims.filter((row) => !row.account || row.account.toLowerCase() === who);
  }

  function claimSessionFor(account: string) {
    const scoped = claimRowsFor(account);
    return {
      scoped,
      session: readClaimSession(
        scoped.map((row) => ({
          marketId: row.marketId,
          market: "0x00000000000000000000000000000000000000aa" as const,
          expiry: 0,
          isResolved: row.isResolved,
          isVoided: row.isVoided,
          winningOutcome: row.winningOutcome,
          up: row.up,
          down: row.down,
        })),
      ),
    };
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
        seedTape(settled, w.expiry);
        settleClaims(w.marketId, w.pool, settled.result as "up" | "down");
        return settled;
      }
      state.windows.push(w);
      state.books[w.upSymbol] = demoBookFor(w);
      state.statusByMarket[w.marketId] = 1;
      seedTape(w, now());
      return w;
    };
    return out;
  }

  const port = wrap();

  // Demo history is one shared store; the board asks per series.
  port.listSeriesHistory = async (asset: string, intervalSec: number) => {
    tick();
    return state.history.filter((h) => {
      const w = windowFor(h.marketId);
      return w !== null && w.asset === asset && w.intervalSec === intervalSec;
    });
  };

  /**
   * The stake walks the ladder, exactly like the SDK's own book-walking quote:
   * the limit is the average of the levels the stake consumes, so a Call big
   * enough to eat two levels pays for two levels. Depth is deep, not infinite —
   * a stake past the whole ladder quotes only what the ladder can fill.
   */
  port.quoteStake = async (marketId, side, stakeRaw) => {
    tick();
    const w = state.windows.find((row) => row.marketId === marketId) ?? windowFor(marketId);
    if (!w) return null;
    const stake = Number(stakeRaw) / 10 ** w.decimals;
    const est = fillEstimate(demoDepthFor(w), side, stake);
    if (!est || !(est.stake > 0) || !(est.avgOdds > 0)) return null;
    const plan = planCall({
      stake: est.stake,
      upPrice: side === "up" ? est.avgOdds : 1 - est.avgOdds,
      side,
      decimals: w.decimals,
      tick: w.tick,
      lot: w.lot,
    });
    if (plan.kind !== "take") return null;
    const quote: StakeQuote = {
      quantity: plan.sizeRaw,
      limitPrice: plan.priceRaw,
      escrow: (plan.sizeRaw * plan.priceRaw) / 10n ** BigInt(w.decimals),
    };
    return quote;
  };

  port.previewClaimSession = async (account) => {
    tick();
    const { session } = claimSessionFor(account);
    return { count: session.intents.length, windows: session.windows, payout: session.payout };
  };

  port.claimFinalized = async (account) => {
    tick();
    const { scoped, session } = claimSessionFor(account);
    for (const row of scoped) {
      row.up = 0n;
      row.down = 0n;
      state.holdings[`${account.toLowerCase()}:${row.marketId}`] = { up: 0n, down: 0n, decimals: 6 };
      state.holdings[`${account}:${row.marketId}`] = { up: 0n, down: 0n, decimals: 6 };
    }
    return {
      count: session.intents.length,
      windows: session.windows,
      payout: session.payout,
      failed: 0,
      txHash: session.intents.length ? `0xdemoclaim${instanceTag}` : undefined,
    };
  };

  port.watchAssetPrice = async () => undefined;
  port.assetPrice = (asset: string) => demoPriceFor(asset, now());

  // Outcome tokens land in the wallet the moment a demo Call fills, so the
  // Position row, the settle preview, and Exit all behave like the real thing.
  function moveHoldings(symbol: string, contracts: number, direction: 1 | -1) {
    const w = state.windows.find((row) => row.upSymbol === symbol || row.downSymbol === symbol);
    const account = state.actingAccount;
    if (!w || !account) return;
    const key = `${account}:${w.marketId}`;
    const held = state.holdings[key] ?? { up: 0n, down: 0n, decimals: w.decimals };
    const raw = BigInt(Math.round(contracts * 10 ** w.decimals)) * BigInt(direction);
    const side = w.upSymbol === symbol ? "up" : "down";
    const next = (held[side] ?? 0n) + raw;
    state.holdings[key] = { ...held, [side]: next > 0n ? next : 0n };
  }
  for (const [method, direction] of [
    ["iocBuy", 1],
    ["fokBuy", 1],
    ["iocSell", -1],
  ] as const) {
    const inner = port[method];
    port[method] = async (symbol: string, contracts: number, price: number) => {
      const txHash = await inner(symbol, contracts, price);
      if (txHash) moveHoldings(symbol, contracts, direction);
      return txHash;
    };
  }

  return Object.assign(port, {
    state,
    actAs(account?: string) {
      fake.actAs(account);
    },
    /**
     * The demo opponent's take: a FOK on the named side, stamped to the given
     * wallet, then the acting wallet is restored. This is how one browser can
     * record the whole duel loop — it is a simulated second trader, so it only
     * ever writes to the demo tape, and the duel still has to verify it there
     * like any other fill.
     */
    async takeAs(account: string, symbol: string, contracts: number, price: number) {
      const previous = state.actingAccount;
      fake.actAs(account);
      try {
        return await port.fokBuy(symbol, contracts, price);
      } finally {
        fake.actAs(previous);
      }
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
