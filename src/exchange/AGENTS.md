# AGENTS.md — src/exchange

## Ownership
ExchangeAdapter over `@somnia-chain/markets-sdk`.

## Purpose
The only module allowed to talk to SomniaMarkets. Maps SDK rows to `LiveWindow`. IOC buy/sell, post-only Rest, faucet, Claim, Claim-session preview, open tickets, series history, Stake quote, venue settlement fee, fill tape, open-position P&L. Maps the live four-sided book to BookTop / BookDepth. A second adapter (`fake.ts`) satisfies the same ExchangePort.

## What This Controls
If this is wrong, the UI shows the wrong Window, Calls the wrong symbol, or cannot Claim Finalized markets.

## Connections
- Depends on: `@somnia-chain/markets-sdk` ≥ 0.28.1, `src/domain/pick-window.ts`, `src/domain/claim-session.ts`, `src/domain/series.ts`, `src/domain/book-depth.ts`, `src/domain/settle-preview.ts`, `src/exchange/port.ts`
- Depended on by: `src/ui/App.tsx`, `src/main.tsx` (`getExchange().client` for SomniaMarketsProvider)
- External systems touched: indexer `dev.smk.somnia.host`, Shannon WS RPC, BinaryMarketsModule

## Current State
Working against SDK types. `npm test` uses `createFakeExchange`, not the live indexer.

## Decision Log

### 2026-08-28 — Post-only restBuy
- **Change**: `VenueWriter.restBuy`. Somnia `createOrder(..., { postOnly: true })` — no `timeInForce: "IOC"`. Fake records `state.rests` and does not write a fill.
- **Reasoning**: Unified `postOnly` maps to POST_ONLY. Mixing it into `iocBuy` would make the default Call rest by accident.
- **Rejected alternative(s)**: `timeInForce: "PO"` only (alias of postOnly). Recording a fill on rest (it has not taken).
- **Task/session**: Loop tick 15 — W-034.

### 2026-08-28 — Unified order tx hash
- **Change**: `iocBuy` / `iocSell` return `writeTxHash(order)` — `UnifiedOrder.txHash` then `PlaceOrderResult.hash`. Fake returns `"0xfake"`.
- **Reasoning**: Call session is SDK-free; the adapter is the only place that may read `order.info`.
- **Rejected alternative(s)**: Domain importing `PlaceOrderResult`. Parsing `order.id` (that can be an on-chain order id, not a tx).
- **Task/session**: Loop tick 14 — W-033.

### 2026-08-28 — Claim session preview
- **Change**: `VenueWriter.previewClaimSession` returns `planClaimSession` length without redeem. Somnia shares `listSettledSnapshots` with `claimFinalized`. Fake does not zero balances on preview.
- **Reasoning**: Claim primary needs a count. Re-scanning on click only left Claim as a ghost until the user already knew to look for it.
- **Rejected alternative(s)**: Inferring claimable from Series history (no balances). A lighter 10-row scan that would disagree with Claim all.
- **Task/session**: Loop tick 13 — W-032.

### 2026-08-28 — Locked/Settling in the live feed
- **Change**: `toLive` no longer requires `m.active`. `listLiveWindows` merges `loadMarkets` binaries with `listPastBinaryMarkets({ status: "Locked"|"Settling" })`. Fake lists status 1/2/3, not Finalized.
- **Reasoning**: SDK `active` is `now < expiry`; registry load is live series only. Just-expired Locked rows live in the past list. Domain `pickWindow` already prefers a successor when one exists.
- **Rejected alternative(s)**: Treating `listLiveBinaryMarkets` as enough (`expiry > now` misses Locked). Mapping Finalized into the live feed.
- **Task/session**: Loop tick 10 — W-029.

### 2026-08-28 — Fill tape + position P&L
- **Change**: `VenueWriter.listFills` / `listPositionPnl`. Somnia: `client.getPortfolio(account).trades` (quote = quantity × fillPrice / 10^decimals) and `client.getOpenPositionsWithPnL`. Fake records a `WalletFill` on each IOC and returns seeded `positionPnl`.
- **Reasoning**: `fetchMyTrades` needs a signer; portfolio takes an explicit account so the UI can read without a write. Tape must not key fills by pool (recycle).
- **Rejected alternative(s)**: `quoteQuantity` on `PortfolioTrade` (that field does not exist). Grouping FillRow by pool like `computeOpenPositionsPnL`. Domain importing markets-sdk.
- **Task/session**: Loop tick 8 — W-027.

### 2026-08-28 — Venue settlement fee
- **Change**: `WindowFeed.settlementFeeBps(marketId)` — Somnia `client.getMarketFees` + `parseSettlementFeeBps`; fake `feesByMarket`. Catch/null → 0n.
- **Reasoning**: Same id the SDK `getClaimable` path uses. Fees are frozen; UI can cache. Missing pre-plumbing rows are 0, matching createClient.
- **Rejected alternative(s)**: On-chain `settlementFeeBpsTimes1k` (different unit). Keying by pool (recycle).
- **Task/session**: Loop tick 7 — W-026.

### 2026-08-28 — Book depth mapping
- **Change**: `bookDepthFromBinary` feeds `yesBids`/`yesAsks` into `readBookDepth`. Tests pin that inverted NO sides are ignored.
- **Reasoning**: Pools recycle; watches stay marketId-keyed. NO levels are the Up book inverted — duplicating them would fake extra depth.
- **Rejected alternative(s)**: Keying depth on pool. Rendering all four SDK arrays.
- **Task/session**: Loop tick 4 — W-014.

### 2026-08-28 — Stake quote on ExchangePort
- **Change**: `WindowFeed.quoteStake(marketId, side, stakeRaw)` on Somnia (`client.quoteBinaryStake` keyed by marketId) and fake (`planCall` from the seeded book). Returns `StakeQuote | null`.
- **Reasoning**: SDK walks the live book; domain must not import markets-sdk. Fake sizes without a clock so tests do not depend on Window expiry.
- **Rejected alternative(s)**: Keying by pool (recycle leak). Sending `trader.placeOrder` MARKET from the quote (Window still submits unified IOC `createOrder` with human units).
- **Task/session**: Loop tick 3 — W-022.

### 2026-08-28 — Claim session at the adapter
- **Change**: `claimFinalized` (Somnia + fake) maps rows to `SettledWindow` then `planClaimSession` / `executeClaims`.
- **Reasoning**: Adapter fetches and writes; Claim session owns newest-first cap and void/winner intents.
- **Rejected alternative(s)**: Fetching all 80 on-chain snapshots before the cap (too many RPCs). Domain already caps; Somnia still slices 40 first.
- **Task/session**: Loop tick — W-021.

### 2026-08-28 — Real seam: fake + Somnia adapters
- **Change**: `ExchangePort` now covers WindowFeed + VenueWriter (`iocBuy`/`iocSell`/`claimFinalized`/`listOpenTickets`/`listSeriesHistory`). `createFakeExchange` is the second adapter. Live book conversion is `bookTopFromBinary` (marketId-keyed watches in UI).
- **Reasoning**: One adapter is a hypothetical seam. Two adapters make Call session tests run without Shannon.
- **Rejected alternative(s)**: Mocking `SomniaMarkets` internals (tests would break on SDK refactors). Poll-only books (SDK docs: snapshot once, then watches).
- **Task/session**: Architecture pass; W-008 / W-011 / W-013.

### 2026-08-28 — SDK not HTTP
- **Change**: `SomniaMarkets` + `loadMarkets` + `setSigner(walletClient)` + `listBinaryMarkets({ status: "Finalized" })`.
- **Reasoning**: ADR-0002. HTTP API has no Event Contract endpoints. `setSigner` is the documented browser path.
- **Rejected alternative(s)**: Rest client; private key in the frontend.
- **Task/session**: Initial Window build.

## Known Gotchas
Key by `marketId`. Pools recycle. `loadMarkets()` skips Finalized binaries. Receipt for unified `createOrder` is on `order.info`. Bind wallet before faucet/Call/Claim or `trader` throws SignerRequiredError. `getOutcomeBalance` takes `{ outcomeToken, account, id }` — recipes.md still shows positional args. `listPastBinaryMarkets` cadence filter is exact; snap client-side because live 1h rows can be 3598s. `quoteBinaryStake` needs an active marketId watch (`useLiveOdds`); catch and return null so a cold store falls back to the polled book. `getMarketFees` indexer strings are standard bps (not bpsTimes1k despite the client d.ts comment). `getPortfolio(account)` is the unsigned fill tape; `fetchMyTrades` throws without a signer. `computeOpenPositionsPnL` still groups fills by pool — prefer portfolio trades keyed by market when mapping the tape. `loadMarkets` / unified `active` is `now < expiry`; just-expired Locked rows come from `listPastBinaryMarkets`, not the live registry.
