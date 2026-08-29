import {
  isBinaryMarket,
  SOMNIA_TESTNET_ADDRESSES,
  SomniaMarkets,
  type BinaryMarket,
  type PlaceOrderResult,
  type UnifiedMarket,
} from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import type { Address, WalletClient } from "viem";
import type { BinarySide } from "@somnia-chain/markets-sdk";
import { executeClaims, readClaimSession, type SettledWindow } from "../domain/claim-session";
import { statusCode } from "../domain/lifecycle";
import { pickWindow } from "../domain/pick-window";
import { canonicalInterval } from "../domain/series";
import { parseSettlementFeeBps } from "../domain/settle-preview";
import type {
  ExchangePort,
  LiveWindow,
  OpenTicket,
  PastWindow,
  PositionPnl,
  SeriesResult,
  WalletFill,
} from "./port";

const indexerUrl = import.meta.env.VITE_INDEXER_URL ?? "https://dev.smk.somnia.host/v1/graphql";
const wsRpcUrl = import.meta.env.VITE_WS_RPC_URL ?? "wss://api.infra.testnet.somnia.network/ws";

let exchange: SomniaMarkets | null = null;
let lastFullLoad = 0;
let inflight: Promise<void> | null = null;

/** One loadMarkets(true) sweep at a time; the gate stamps only on success. */
function fullLoad(): Promise<void> {
  if (!inflight) {
    inflight = getExchange()
      .loadMarkets(true)
      .then(() => {
        lastFullLoad = Date.now();
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function getExchange(): SomniaMarkets {
  if (!exchange) {
    exchange = new SomniaMarkets({
      indexerUrl,
      chain: somniaShannon,
      wsRpcUrl,
      addresses: SOMNIA_TESTNET_ADDRESSES,
    });
  }
  return exchange;
}

export function bindWallet(walletClient: WalletClient | undefined) {
  getExchange().setSigner(walletClient ? { walletClient } : {});
}

/**
 * Cold `loadMarkets` hydration takes ~10s against the Shannon indexer. Landing and
 * docs fire this once on mount so the terminal's first query usually lands warm.
 * Failures are swallowed — the app route runs its own query with real error UI.
 */
let warmed = false;
export function warmExchange() {
  if (warmed) return;
  warmed = true;
  void fullLoad().catch(() => undefined);
}

function asBinary(m: UnifiedMarket): BinaryMarket | null {
  return isBinaryMarket(m.info) ? m.info : null;
}

async function liveFromBinary(info: BinaryMarket, unified?: UnifiedMarket): Promise<LiveWindow | null> {
  const code = statusCode(info.status);
  if (code !== 1 && code !== 2 && code !== 3) return null;
  const symbol = unified?.symbol ?? `${info.asset}-${info.interval ?? "15m"}`;
  const upSymbol =
    unified?.outcomes?.find((o) => o.index === 0)?.symbol ?? `${symbol}#YES`;
  const downSymbol =
    unified?.outcomes?.find((o) => o.index === 1)?.symbol ?? `${symbol}#NO`;
  const pool = info.poolAddress;
  let tick = 1000n;
  let lot = 1000n;
  try {
    const grid = await getExchange().client.getBinaryBookParams(pool);
    tick = grid.tickSize;
    lot = grid.lotSize;
  } catch {
    /* keep testnet-ish defaults only if the pool read fails */
  }
  const quoteDec = info.quoteDecimals || 6;
  const intervalSec = canonicalInterval(Number(info.intervalSec ?? 900));
  return {
    marketId: info.marketId,
    symbol,
    upSymbol,
    downSymbol,
    asset: info.asset,
    intervalSec: Number.isFinite(intervalSec) ? intervalSec : 900,
    expiry: Number(info.expiry),
    venueId: info.venueId ?? "",
    pool,
    status: code,
    openingPrice: undefined,
    volumeQuote: Number(info.cumulativeQuoteVolume) / 10 ** quoteDec,
    tradeCount: Number(info.tradeCount),
    oracleQuestionId: info.oracleQuestionId ?? undefined,
    tick,
    lot,
    decimals: quoteDec,
    marketAddress: info.marketAddress,
  };
}

async function toLive(m: UnifiedMarket): Promise<LiveWindow | null> {
  const info = asBinary(m);
  if (!info) return null;
  return liveFromBinary(info, m);
}

function seriesResult(voided: boolean, winningOutcome: number | null): SeriesResult {
  if (voided) return "void";
  if (winningOutcome === 0) return "up";
  if (winningOutcome === 1) return "down";
  return "unknown";
}

export const somniaExchange: ExchangePort = {
  async listLiveWindows() {
    const ex = getExchange();
    // A full loadMarkets(true) sweep costs ~10s (registry page + per-pool grid
    // reads). The SDK returns its warm store instantly on loadMarkets(false),
    // so: reload at most every 45s — first paint is instant when landing or docs
    // warmed the store, and successor Windows still appear within a roll.
    if (Date.now() - lastFullLoad > 45_000) await fullLoad();
    const markets = Object.values(await ex.loadMarkets(false));
    const fromLoad = await Promise.all(markets.filter((m) => m.type === "binary").map(toLive));
    let waiting: LiveWindow[] = [];
    try {
      const [locked, settling] = await Promise.all([
        ex.client.listPastBinaryMarkets({ status: "Locked", limit: 40 }),
        ex.client.listPastBinaryMarkets({ status: "Settling", limit: 20 }),
      ]);
      waiting = (
        await Promise.all([...locked, ...settling].map((row) => liveFromBinary(row)))
      ).filter((w): w is LiveWindow => w !== null);
    } catch {
      /* indexer past-Locked is best-effort; Trading rows from loadMarkets still show */
    }
    const byId = new Map<string, LiveWindow>();
    for (const w of [...fromLoad, ...waiting]) {
      if (w) byId.set(w.marketId, w);
    }
    const live = [...byId.values()];
    try {
      const opens = await ex.client.getOpeningPrices(live.map((w) => w.marketId));
      for (const w of live) {
        const raw = opens[w.marketId] ?? opens[w.marketId.toLowerCase()];
        if (raw) w.openingPrice = raw;
      }
    } catch {
      /* Line stays blank if the opening-price index is empty */
    }
    return live;
  },
  async book(upSymbol) {
    const book = await getExchange().fetchOrderBook(upSymbol, 5);
    return { bid: book.bids[0]?.[0], ask: book.asks[0]?.[0] };
  },
  async quoteStake(marketId, side, stakeRaw) {
    try {
      const q = await getExchange().client.quoteBinaryStake({
        marketId,
        side: side === "up" ? "BUY_YES" : "BUY_NO",
        stake: stakeRaw,
      });
      if (!q) return null;
      return { quantity: q.quantity, limitPrice: q.limitPrice, escrow: q.escrow };
    } catch {
      return null;
    }
  },
  async settlementFeeBps(marketId) {
    try {
      const fees = await getExchange().client.getMarketFees(marketId);
      return parseSettlementFeeBps(fees?.settlementFeeBps);
    } catch {
      return 0n;
    }
  },
  async listSeriesHistory(asset, intervalSec, venueId) {
    const ex = getExchange();
    let rows;
    try {
      rows = await ex.client.listPastBinaryMarkets({
        asset,
        venueId: venueId || undefined,
        status: "Finalized",
        limit: 40,
      });
    } catch {
      return [];
    }
    const cadence = canonicalInterval(intervalSec);
    rows = rows.filter((r) => canonicalInterval(Number(r.intervalSec ?? 0)) === cadence).slice(0, 12);
    let opens: Record<string, string | null> = {};
    try {
      opens = await ex.client.getOpeningPrices(rows.map((r) => r.marketId));
    } catch {
      /* Line stays blank */
    }
    return rows.map((r): PastWindow => {
      const marketId = r.marketId as `0x${string}`;
      const raw = opens[marketId] ?? opens[marketId.toLowerCase()] ?? undefined;
      return {
        marketId,
        expiry: Number(r.expiry),
        result: seriesResult(r.voided, r.winningOutcome),
        volumeQuote: Number(r.cumulativeQuoteVolume) / 10 ** (r.quoteDecimals || 6),
        openingPrice: raw ?? undefined,
        oracleQuestionId: r.oracleQuestionId ?? undefined,
      };
    });
  },
  async listMarketFills(pool, decimals) {
    try {
      const dec = decimals || 6;
      return getExchange()
        .client.getLiveFills(pool, { limit: 12 })
        .map((f) => ({
          id: f.id,
          price: Number(f.fillPrice) / 10 ** dec,
          quantity: Number(f.quantity) / 10 ** dec,
          quote: Number(f.quoteQuantity) / 10 ** dec,
          aggressor: f.takerSide
            ? f.takerSide.endsWith("YES")
              ? ("up" as const)
              : ("down" as const)
            : f.takerIsBid === true
              ? ("up" as const)
              : f.takerIsBid === false
                ? ("down" as const)
                : null,
          ts: Number(f.timestamp),
          txHash: f.txHash,
        }));
    } catch {
      return [];
    }
  },
  async watchAssetPrice(asset) {
    try {
      await getExchange().client.watchPrice(asset);
    } catch {
      /* price feed optional; board works without it */
    }
  },
  assetPrice(asset) {
    const p = getExchange().client.getLivePrice(asset);
    return p ? { asset: p.asset, price: p.price, ema: p.ema } : null;
  },
  async onchainStatus(marketId) {
    const oc = await getExchange().client.getMarketOnchain(marketId);
    return oc.status;
  },
  async iocBuy(symbol, contracts, price) {
    return writeTxHash(await placeIocBuy(symbol, contracts, price));
  },
  async iocSell(symbol, contracts, price) {
    return writeTxHash(await placeIocSell(symbol, contracts, price));
  },
  async restBuy(symbol, contracts, price) {
    return writeTxHash(await placePostOnlyBuy(symbol, contracts, price));
  },
  outcomeBalances,
  mintTestCollateral,
  previewClaimSession,
  claimFinalized,
  async listOpenTickets(symbol) {
    try {
      const rows = await getExchange().fetchOpenOrders(symbol, 50);
      return rows
        .filter((o) => o.status === "open" && o.remaining > 0)
        .map(
          (o): OpenTicket => ({
            id: o.id,
            symbol: o.symbol,
            side: o.side,
            price: o.price ?? 0,
            remaining: o.remaining,
          }),
        );
    } catch {
      return [];
    }
  },
  async cancelOpenTicket(id, symbol) {
    return writeTxHash(await getExchange().cancelOrder(id, symbol));
  },
  async listFills(account) {
    try {
      const p = await getExchange().client.getPortfolio(account, { tradesLimit: 50 });
      return p.trades
        .filter((t) => t.side !== null)
        .map((t) => {
          const dec = t.market.quoteDecimals || 6;
          const quoteRaw = (BigInt(t.quantity) * BigInt(t.fillPrice)) / 10n ** BigInt(dec);
          return {
            id: t.id,
            asset: t.market.asset,
            intervalSec: canonicalInterval(Number(t.market.intervalSec ?? 0)) || 0,
            ...splitSide(t.side),
            price: Number(t.fillPrice) / 10 ** dec,
            quantity: Number(t.quantity) / 10 ** dec,
            quote: Number(quoteRaw) / 10 ** dec,
            timestamp: Number(t.timestamp),
            txHash: t.txHash,
          } satisfies WalletFill;
        });
    } catch {
      return [];
    }
  },
  async listPositionPnl(account) {
    try {
      const rows = await getExchange().client.getOpenPositionsWithPnL(account);
      return rows.map(
        (r): PositionPnl => ({
          marketId: r.market.id as `0x${string}`,
          asset: r.market.asset,
          intervalSec: canonicalInterval(Number(r.market.intervalSec ?? 0)) || 0,
          up: r.balanceYes,
          down: r.balanceNo,
          costBasis: r.costBasis,
          avgCost: r.avgCost,
          markValue: r.markValue,
          unrealizedPnl: r.unrealizedPnl,
          realizedPnl: r.realizedPnl,
          decimals: r.market.quoteDecimals,
        }),
      );
    } catch {
      return [];
    }
  },
};

function writeTxHash(order: { txHash?: string; info?: unknown }): string | undefined {
  if (order.txHash) return order.txHash;
  const info = order.info as PlaceOrderResult | undefined;
  return info?.hash;
}

function splitSide(side: BinarySide | null): { side: "up" | "down" | null; direction: "buy" | "sell" | null } {
  if (!side) return { side: null, direction: null };
  const direction = side.startsWith("BUY") ? "buy" : "sell";
  const outcome = side.endsWith("YES") ? "up" : "down";
  return { side: outcome, direction };
}

export function selectSeries(windows: LiveWindow[], asset: string, intervalSec: number, nowSec = Date.now() / 1000) {
  const pin = import.meta.env.VITE_VENUE_ID || undefined;
  return pickWindow(windows, asset, intervalSec, nowSec, pin || undefined);
}

export async function placeIocBuy(symbol: string, contracts: number, price: number) {
  const snapped = getExchange().priceToPrecision(symbol, price);
  const size = getExchange().amountToPrecision(symbol, contracts);
  if (size === 0) throw new Error("below-lot");
  const order = await getExchange().createOrder(symbol, "limit", "buy", size, snapped, {
    timeInForce: "IOC",
  });
  const receipt = (order.info as PlaceOrderResult | undefined)?.receipt;
  if (receipt?.status === "reverted") throw new Error("Call reverted on-chain");
  return order;
}

export async function placeIocSell(symbol: string, contracts: number, price: number) {
  const snapped = getExchange().priceToPrecision(symbol, price);
  const size = getExchange().amountToPrecision(symbol, contracts);
  if (size === 0) throw new Error("below-lot");
  const order = await getExchange().createOrder(symbol, "limit", "sell", size, snapped, {
    timeInForce: "IOC",
  });
  const receipt = (order.info as PlaceOrderResult | undefined)?.receipt;
  if (receipt?.status === "reverted") throw new Error("Exit reverted on-chain");
  return order;
}

export async function placePostOnlyBuy(symbol: string, contracts: number, price: number) {
  const snapped = getExchange().priceToPrecision(symbol, price);
  const size = getExchange().amountToPrecision(symbol, contracts);
  if (size === 0) throw new Error("below-lot");
  const order = await getExchange().createOrder(symbol, "limit", "buy", size, snapped, {
    postOnly: true,
  });
  const receipt = (order.info as PlaceOrderResult | undefined)?.receipt;
  if (receipt?.status === "reverted") throw new Error("Rest reverted on-chain");
  return order;
}

export async function outcomeBalances(account: Address, marketId: `0x${string}`) {
  const ex = getExchange();
  const oc = await ex.client.getMarketOnchain(marketId);
  const up = await ex.client.getOutcomeBalance({ outcomeToken: oc.outcomeToken, account, id: oc.yesId });
  const down = await ex.client.getOutcomeBalance({ outcomeToken: oc.outcomeToken, account, id: oc.noId });
  return { up, down, decimals: oc.decimals };
}

export async function mintTestCollateral() {
  const res = await getExchange().trader.faucet();
  return res.hash;
}

async function listSettledSnapshots(account: Address, venueId?: string): Promise<SettledWindow[]> {
  const ex = getExchange();
  const settled = await ex.client.listBinaryMarkets({
    venueId,
    status: "Finalized",
    limit: 80,
  });
  settled.sort((a, b) => Number(b.expiry ?? 0) - Number(a.expiry ?? 0));
  const snapshots: SettledWindow[] = [];
  const seen = new Set<string>();
  for (const row of settled.slice(0, 40)) {
    if (seen.has(row.marketId)) continue;
    seen.add(row.marketId);
    const oc = await ex.client.getMarketOnchain(row.marketId);
    const up = await ex.client.getOutcomeBalance({ outcomeToken: oc.outcomeToken, account, id: oc.yesId });
    const down = await ex.client.getOutcomeBalance({ outcomeToken: oc.outcomeToken, account, id: oc.noId });
    snapshots.push({
      marketId: row.marketId,
      market: oc.marketAddress,
      expiry: Number(row.expiry ?? 0),
      isResolved: oc.isResolved,
      isVoided: oc.isVoided,
      winningOutcome: oc.winningOutcome,
      up,
      down,
    });
  }
  return snapshots;
}

/** Fees only for Windows with a redeem pending — the 40-row scan stays cheap. */
async function withHeldFees(rows: SettledWindow[]): Promise<SettledWindow[]> {
  const held = readClaimSession(rows, 40).held;
  if (held.length === 0) return rows;
  const fees = await Promise.all(
    held.map(async (h) => {
      try {
        const f = await getExchange().client.getMarketFees(h.marketId);
        return [h.marketId, parseSettlementFeeBps(f?.settlementFeeBps)] as const;
      } catch {
        return [h.marketId, 0n] as const;
      }
    }),
  );
  const byMarket = new Map(fees);
  return rows.map((r) => {
    const feeBps = byMarket.get(r.marketId);
    return feeBps === undefined || feeBps === 0n ? r : { ...r, feeBps };
  });
}

export async function previewClaimSession(account: Address, venueId?: string) {
  const rows = await withHeldFees(await listSettledSnapshots(account, venueId));
  const session = readClaimSession(rows, 40);
  return { count: session.intents.length, windows: session.windows, payout: session.payout };
}

export async function claimFinalized(account: Address, venueId?: string) {
  const rows = await withHeldFees(await listSettledSnapshots(account, venueId));
  const session = readClaimSession(rows, 40);
  return executeClaims(
    {
      async redeem(intent) {
        const res = await getExchange().trader.redeem({
          marketId: intent.marketId,
          market: intent.market,
          outcomeIdx: intent.outcomeIdx,
          amount: intent.amount,
        });
        if (res.receipt.status === "reverted") throw new Error("redeem reverted");
        return res.hash;
      },
    },
    session,
  );
}
