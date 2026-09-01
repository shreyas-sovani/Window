import type { Address } from "viem";
import type { ClaimPreview, ClaimReceipt } from "../domain/claim-session";

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
  oracleQuestionId?: string;
};

export type OutcomeHoldings = { up: bigint; down: bigint; decimals: number };

/** Time-series point for sparklines. */
export type Sample = { t: number; v: number };

/** One fill on a pool's public tape; aggressor is the taker direction, null while unresolved. */
export type MarketFill = {
  id: string;
  price: number;
  quantity: number;
  quote: number;
  aggressor: "up" | "down" | null;
  ts: number;
  txHash: string;
  /** Owning marketId — pools recycle; replay keys by market. */
  marketId?: string;
  /** Taker wallet, when the tape names it (replay-grade reads). */
  taker?: string | null;
  /** Maker (resting) wallet, when the tape names it. */
  maker?: string | null;
};

/** Latest feed read for an underlying asset. */
export type AssetPrice = { asset: string; price: number; ema: number };

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
  /** Owning Window — duels key by marketId; a sibling Window is a different market. */
  marketId?: `0x${string}`;
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
  /** Public tape of a pool. */
  listMarketFills(pool: string, decimals: number): Promise<MarketFill[]>;
  /** Watch + read the underlying asset's on-chain price feed. */
  watchAssetPrice(asset: string): Promise<void>;
  assetPrice(asset: string): AssetPrice | null;
  /** One Window by marketId — replay-grade; Finalized rows included. */
  marketById(marketId: `0x${string}`): Promise<LiveWindow | null>;
  /** One-shot indexer fill tape for a pool, carrying marketId + wallets. */
  fillsByPool(pool: string, decimals: number, limit?: number): Promise<MarketFill[]>;
};

/** Writes and wallet-scoped reads. Gate Call/Exit on onchainStatus === 1. */
export type VenueWriter = {
  onchainStatus(marketId: `0x${string}`): Promise<number>;
  iocBuy(symbol: string, contracts: number, price: number): Promise<string | undefined>;
  iocSell(symbol: string, contracts: number, price: number): Promise<string | undefined>;
  restBuy(symbol: string, contracts: number, price: number): Promise<string | undefined>;
  outcomeBalances(account: Address, marketId: `0x${string}`): Promise<OutcomeHoldings>;
  mintTestCollateral(): Promise<string | undefined>;
  claimFinalized(account: Address, venueId?: string): Promise<ClaimReceipt>;
  /** Claim session preview (Windows + expected collateral). Does not redeem. */
  previewClaimSession(account: Address, venueId?: string): Promise<ClaimPreview>;
  listOpenTickets(symbol?: string): Promise<OpenTicket[]>;
  cancelOpenTicket(id: string, symbol: string): Promise<string | undefined>;
  listFills(account: Address): Promise<WalletFill[]>;
  listPositionPnl(account: Address): Promise<PositionPnl[]>;
};

export type ExchangePort = WindowFeed & VenueWriter;
