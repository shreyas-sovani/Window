import type { Address } from "viem";

export type LiveWindow = {
  marketId: `0x${string}`;
  symbol: string;
  upSymbol: string;
  downSymbol?: string;
  asset: string;
  intervalSec: number;
  expiry: number;
  venueId: string;
  pool: `0x${string}`;
  status: number;
  openingPrice?: string;
  impliedUp?: number;
  volumeQuote?: number;
  tradeCount?: number;
  oracleQuestionId?: string;
  tick: bigint;
  lot: bigint;
  decimals: number;
  marketAddress?: `0x${string}`;
};

export type BookTop = { bid?: number; ask?: number };

/** Live-book size of a collateral stake. Raw outcome quantity and protective limit. */
export type StakeQuote = {
  quantity: bigint;
  limitPrice: bigint;
  escrow: bigint;
};

export type OpenTicket = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  price: number;
  remaining: number;
};

export type SeriesResult = "up" | "down" | "void" | "unknown";

export type PastWindow = {
  marketId: `0x${string}`;
  expiry: number;
  result: SeriesResult;
  volumeQuote?: number;
  openingPrice?: string;
};

export type OutcomeHoldings = { up: bigint; down: bigint; decimals: number };

/** One fill this wallet participated in, account-relative. Display-grade. */
export type WalletFill = {
  id: string;
  asset: string;
  intervalSec: number;
  side: "up" | "down" | null;
  direction: "buy" | "sell" | null;
  /** Fill price as a 0..1 probability. */
  price: number;
  /** Outcome-token quantity, human units. */
  quantity: number;
  /** Collateral value, human units. */
  quote: number;
  timestamp: number;
  txHash: string;
};

/** Avg-cost P&L for one open position, raw collateral units (see decimals). */
export type PositionPnl = {
  marketId: `0x${string}`;
  asset: string;
  intervalSec: number;
  up: bigint;
  down: bigint;
  costBasis: bigint;
  avgCost: bigint;
  markValue: bigint;
  unrealizedPnl: bigint;
  realizedPnl: bigint;
  decimals: number;
};

/** Reads the live board. Two adapters (Somnia + fake) sit at this seam. */
export type WindowFeed = {
  listLiveWindows(): Promise<LiveWindow[]>;
  book(upSymbol: string): Promise<BookTop>;
  quoteStake(marketId: `0x${string}`, side: "up" | "down", stakeRaw: bigint): Promise<StakeQuote | null>;
  settlementFeeBps(marketId: `0x${string}`): Promise<bigint>;
  listSeriesHistory(asset: string, intervalSec: number, venueId?: string): Promise<PastWindow[]>;
};

/** Writes and wallet-scoped reads. Gate Call/Exit on onchainStatus === 1. */
export type VenueWriter = {
  onchainStatus(marketId: `0x${string}`): Promise<number>;
  iocBuy(symbol: string, contracts: number, price: number): Promise<string | undefined>;
  iocSell(symbol: string, contracts: number, price: number): Promise<string | undefined>;
  restBuy(symbol: string, contracts: number, price: number): Promise<string | undefined>;
  outcomeBalances(account: Address, marketId: `0x${string}`): Promise<OutcomeHoldings>;
  mintTestCollateral(): Promise<void>;
  claimFinalized(account: Address, venueId?: string): Promise<number>;
  /** Claim session intent count. Does not redeem. */
  previewClaimSession(account: Address, venueId?: string): Promise<number>;
  listOpenTickets(symbol?: string): Promise<OpenTicket[]>;
  cancelOpenTicket(id: string, symbol: string): Promise<void>;
  listFills(account: Address): Promise<WalletFill[]>;
  listPositionPnl(account: Address): Promise<PositionPnl[]>;
};

export type ExchangePort = WindowFeed & VenueWriter;
