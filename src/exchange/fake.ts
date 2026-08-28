import { planCall } from "../domain/call-ticket";
import { planClaimSession } from "../domain/claim-session";
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
};

const emptyHoldings = (): OutcomeHoldings => ({ up: 0n, down: 0n, decimals: 6 });

function claimIntents(state: FakeExchangeState, venueId?: string) {
  const scoped = state.claims.filter((row) => !venueId || !row.venueId || row.venueId === venueId);
  return {
    scoped,
    intents: planClaimSession(
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
) {
  const w = state.windows.find((row) => row.upSymbol === symbol || row.downSymbol === symbol);
  if (!w) return;
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
    txHash: "0xfake",
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
  };

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
    async onchainStatus(marketId) {
      return state.statusByMarket[marketId] ?? 1;
    },
    async iocBuy(symbol, contracts, price) {
      state.buys.push({ symbol, contracts, price });
      recordFill(state, symbol, contracts, price, "buy");
      return "0xfake";
    },
    async iocSell(symbol, contracts, price) {
      state.sells.push({ symbol, contracts, price });
      recordFill(state, symbol, contracts, price, "sell");
      return "0xfake";
    },
    async restBuy(symbol, contracts, price) {
      state.rests.push({ symbol, contracts, price });
      return "0xfake";
    },
    async outcomeBalances(account, marketId) {
      return state.holdings[`${account}:${marketId}`] ?? emptyHoldings();
    },
    async mintTestCollateral() {
      state.faucetCalls += 1;
      return "0xfake";
    },
    async previewClaimSession(_account, venueId) {
      return claimIntents(state, venueId).intents.length;
    },
    async claimFinalized(_account, venueId) {
      const { scoped, intents } = claimIntents(state, venueId);
      for (const row of scoped) {
        row.up = 0n;
        row.down = 0n;
      }
      return { count: intents.length, txHash: intents.length ? "0xfake" : undefined };
    },
    async listOpenTickets(symbol) {
      return state.tickets.filter((t) => !symbol || t.symbol === symbol);
    },
    async cancelOpenTicket(id, symbol) {
      state.cancelled.push({ id, symbol });
      state.tickets = state.tickets.filter((t) => t.id !== id);
      return "0xfake";
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
