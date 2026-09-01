import { planCall } from "../domain/call-ticket";
import { readClaimSession } from "../domain/claim-session";
import { impliedUp } from "../domain/implied";
import type {
  AssetPrice,
  ExchangePort,
  LiveWindow,
  MarketFill,
  OpenTicket,
  OutcomeHoldings,
  PastWindow,
  PositionPnl,
  StakeQuote,
  WalletFill,
} from "./port";

export type FakeClaimRow = {
  marketId: `0x${string}`;
  venueId?: string;
  isResolved: boolean;
  isVoided: boolean;
  winningOutcome: 0 | 1 | null;
  up: bigint;
  down: bigint;
};

export type FakeExchangeState = {
  windows: LiveWindow[];
  statusByMarket: Record<string, number>;
  books: Record<string, { bid?: number; ask?: number }>;
  holdings: Record<string, OutcomeHoldings>;
  buys: { symbol: string; contracts: number; price: number }[];
  sells: { symbol: string; contracts: number; price: number }[];
  rests: { symbol: string; contracts: number; price: number }[];
  claims: FakeClaimRow[];
  history: PastWindow[];
  tickets: OpenTicket[];
  faucetCalls: number;
  cancelled: { id: string; symbol: string }[];
  feesByMarket: Record<string, bigint>;
  fills: WalletFill[];
  positionPnl: PositionPnl[];
  marketFills: Record<string, MarketFill[]>;
  prices: Record<string, AssetPrice>;
  watchedAssets: string[];
  /** Set false to simulate an IOC that lands on-chain but fills nothing (empty book crossing). */
  iocFills: boolean;
  /** Wallet whose IOC writes are stamped as the taker on the pool tape (duel verification). */
  actingAccount?: string;
};

const emptyHoldings = (): OutcomeHoldings => ({ up: 0n, down: 0n, decimals: 6 });

function claimSession(state: FakeExchangeState, venueId?: string) {
  const scoped = state.claims.filter((row) => !venueId || !row.venueId || row.venueId === venueId);
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

function recordFill(
  state: FakeExchangeState,
  symbol: string,
  contracts: number,
  price: number,
  direction: "buy" | "sell",
  txHash: string,
) {
  const w = state.windows.find((row) => row.upSymbol === symbol || row.downSymbol === symbol);
  if (!w) return;
  (state.marketFills[w.pool] ??= []).push({
    id: `mk_${state.fills.length + 1}`,
    price,
    quantity: contracts,
    quote: contracts * price,
    aggressor: w.upSymbol === symbol ? "up" : "down",
    ts: Date.now() / 1000,
    txHash,
    marketId: w.marketId,
    taker: state.actingAccount ?? null,
  });
  state.fills.push({
    id: `fake_${state.fills.length + 1}`,
    asset: w.asset,
    intervalSec: w.intervalSec,
    side: w.upSymbol === symbol ? "up" : "down",
    direction,
    price,
    quantity: contracts,
    quote: contracts * price,
    timestamp: Date.now() / 1000,
    txHash,
    marketId: w.marketId,
  });
}

export function createFakeExchange(seed: Partial<FakeExchangeState> = {}): ExchangePort & {
  state: FakeExchangeState;
} {
  const state: FakeExchangeState = {
    windows: seed.windows ?? [],
    statusByMarket: seed.statusByMarket ?? {},
    books: seed.books ?? {},
    holdings: seed.holdings ?? {},
    buys: seed.buys ?? [],
    sells: seed.sells ?? [],
    rests: seed.rests ?? [],
    claims: seed.claims ?? [],
    history: seed.history ?? [],
    tickets: seed.tickets ?? [],
    faucetCalls: seed.faucetCalls ?? 0,
    cancelled: seed.cancelled ?? [],
    feesByMarket: seed.feesByMarket ?? {},
    fills: seed.fills ?? [],
    positionPnl: seed.positionPnl ?? [],
    marketFills: seed.marketFills ?? {},
    prices: seed.prices ?? {},
    watchedAssets: seed.watchedAssets ?? [],
    iocFills: seed.iocFills ?? true,
    actingAccount: seed.actingAccount,
  };

  let txSeq = 0;
  const nextTx = (): string => `0xfake${(txSeq += 1)}`;

  const port: ExchangePort = {
    async listLiveWindows() {
      return state.windows.filter((w) => w.status === 1 || w.status === 2 || w.status === 3);
    },
    async book(upSymbol) {
      return state.books[upSymbol] ?? {};
    },
    async quoteStake(marketId, side, stakeRaw) {
      const w = state.windows.find((row) => row.marketId === marketId);
      if (!w) return null;
      const plan = planCall({
        stake: Number(stakeRaw) / 10 ** w.decimals,
        upPrice: impliedUp(state.books[w.upSymbol]) ?? 0.5,
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
    },
    async settlementFeeBps(marketId) {
      return state.feesByMarket[marketId] ?? 0n;
    },
    async listSeriesHistory() {
      return state.history;
    },
    async listMarketFills(pool) {
      return [...(state.marketFills[pool] ?? [])].sort((a, b) => b.ts - a.ts);
    },
    async watchAssetPrice(asset) {
      if (!state.watchedAssets.includes(asset)) state.watchedAssets.push(asset);
    },
    assetPrice(asset) {
      return state.prices[asset] ?? null;
    },
    async marketById(marketId) {
      return state.windows.find((w) => w.marketId === marketId) ?? null;
    },
    async fillsByPool(pool) {
      return [...(state.marketFills[pool] ?? [])].sort((a, b) => b.ts - a.ts);
    },
    async onchainStatus(marketId) {
      return state.statusByMarket[marketId] ?? 1;
    },
    async iocBuy(symbol, contracts, price) {
      state.buys.push({ symbol, contracts, price });
      const hash = nextTx();
      if (state.iocFills) recordFill(state, symbol, contracts, price, "buy", hash);
      return hash;
    },
    async iocSell(symbol, contracts, price) {
      state.sells.push({ symbol, contracts, price });
      const hash = nextTx();
      if (state.iocFills) recordFill(state, symbol, contracts, price, "sell", hash);
      return hash;
    },
    async restBuy(symbol, contracts, price) {
      state.rests.push({ symbol, contracts, price });
      return nextTx();
    },
    async outcomeBalances(account, marketId) {
      return state.holdings[`${account}:${marketId}`] ?? emptyHoldings();
    },
    async mintTestCollateral() {
      state.faucetCalls += 1;
      return nextTx();
    },
    async previewClaimSession(_account, venueId) {
      const { session } = claimSession(state, venueId);
      return { count: session.intents.length, windows: session.windows, payout: session.payout };
    },
    async claimFinalized(_account, venueId) {
      const { scoped, session } = claimSession(state, venueId);
      for (const row of scoped) {
        row.up = 0n;
        row.down = 0n;
      }
      return {
        count: session.intents.length,
        windows: session.windows,
        payout: session.payout,
        failed: 0,
        txHash: session.intents.length ? nextTx() : undefined,
      };
    },
    async listOpenTickets(symbol) {
      return state.tickets.filter((t) => !symbol || t.symbol === symbol);
    },
    async cancelOpenTicket(id, symbol) {
      state.cancelled.push({ id, symbol });
      state.tickets = state.tickets.filter((t) => t.id !== id);
      return nextTx();
    },
    async listFills() {
      return [...state.fills].sort((a, b) => b.timestamp - a.timestamp);
    },
    async listPositionPnl() {
      return state.positionPnl;
    },
  };

  return Object.assign(port, { state });
}
