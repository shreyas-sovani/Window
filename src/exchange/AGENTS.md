# AGENTS.md — src/exchange

## Ownership
ExchangeAdapter over `@somnia-chain/markets-sdk`.

## Purpose
The only module allowed to talk to SomniaMarkets. Maps SDK rows to `LiveWindow`. IOC buy/sell, post-only Rest, faucet, Claim, Claim-session preview, open tickets, series history, Stake quote, venue settlement fee, fill tape, open-position P&L. Maps the live four-sided book to BookTop / BookDepth. A second adapter (`fake.ts`) satisfies the same ExchangePort.

## What This Controls
If this is wrong, the UI shows the wrong Window, Calls the wrong symbol, or cannot Claim Finalized markets. If preview is an intent count, a void looks like two Claims.

## Connections
- Depends on: `@somnia-chain/markets-sdk` ≥ 0.28.1, `src/domain/pick-window.ts`, `src/domain/claim-session.ts`, `src/domain/series.ts`, `src/domain/book-depth.ts`, `src/domain/settle-preview.ts`, `src/exchange/port.ts`
- Depended on by: `src/ui/App.tsx`, `src/main.tsx` (`getExchange().client` for SomniaMarketsProvider)
- External systems touched: indexer `dev.smk.somnia.host`, Shannon WS RPC, BinaryMarketsModule

## Current State
Working against SDK types. A third adapter, `demo.ts` over `demo-universe.ts`, satisfies the same ExchangePort from the wall clock alone: deterministic per-cadence Windows, a six-level two-sided ladder its own quotes walk, a growing anonymous pool tape, a moving price feed, account-scoped claims, and fills that travel between browsers as a URL blob. `demoExchangeFor(account)` is the per-wallet session instance the app must use. `LiveWindow` carries chain-derived `result`; `marketById` resolves Finalized Windows; and replay-grade `fillsByPool` preserves marketId, taker, and side, paging the indexer tape (`readTapePages`, 400/page, hard cap 2000 rows) so a named tx deeper than one tail still verifies. Proof reads propagate indexer errors so the UI says verification unavailable instead of “no fill.” The account-aware fake implements every port method, writes distinct tx hashes, stamps fill ownership, and never fabricates a 50% quote. Default tests stay offline. Warm loading remains one `loadMarkets(true)` sweep at most every 45s, with landing/docs prewarming the SDK store.

## Decision Log

### 2026-09-09 — Claim scan: parallel 20-market snapshot + preview-to-execute cache
- **Change**: `somnia.ts listSettledSnapshots` now dedupes the 80-row Finalized list down to the newest 20 unique marketIds, then runs one `getMarketOnchain` + `Promise.all(getOutcomeBalance YES, NO)` per market — all 20 markets in parallel. Per-read timeouts dropped 15s → 10s. New per-account `claimCache` (15s TTL) holds the snapshot the preview returned; `claimFinalized` reuses it instead of re-scanning, and clears it after redeem so the next preview reads the post-redeem balances.
- **Reasoning**: Live report — winner pressed Claim, MetaMask took 30+ minutes to open, and the panel never cleared after the redeem tx mined. Root cause: `listSettledSnapshots` was a serial `for` loop over 40 markets, each doing three sequential 15s-timeout reads (`getMarketOnchain`, YES balance, NO balance) — one hung read gated the whole scan at 15s, 40 markets × 3 reads was a 30-minute worst case, and `previewClaimSession` + `claimFinalized` ran the same scan twice. Parallel-20 caps the wall-clock at one round-trip (≈2-5s), the cache means Claim uses the same reads the preview just paid for, and dropping the cap to 20 costs nothing — the just-settled duel Window is always #1 in the newest-expired order.
- **Rejected alternative(s)**: `Promise.allSettled` throughout (a stray timeout should surface, not silently drop a claimable Window — one caught try/catch per row does the same job); persist the cache across sessions (balances change between sessions; a wrong 0 hides real winnings); scan all 80 in parallel (the SDK's built-in read concurrency is already the bottleneck; 20 is plenty for the redeem horizon).
- **Task/session**: Real-Shannon Claim end-to-end fix.

### 2026-09-09 — Widen quoteBinaryStake's slippage cushion to 3000 bps (30%) on Shannon
- **Change**: `somnia.ts quoteStake` now passes `slippageBps: 3000n` to `client.quoteBinaryStake`. The SDK re-fits quantity to keep escrow ≤ stake, so the wallet's exact-stake approval invariant still holds (`approveAmount` unchanged). `fake.ts` unaffected — its `quoteStake` is a raw walk of the seeded book.
- **Reasoning**: A signed BTC-15m Call still reverted on real Shannon at 1000 bps. Decoding the failed tx (`0x659b…291d`) confirmed the SDK cushion arithmetic — Param #2 (yesPrice) landed at 348_000 for a BUY_NO with walked worst yesPrice ≈ 0.383 (0.383 × 0.9 = 0.345 tick-aligned) — but the book still moved past the 10% headroom in the ~5-10s between the polled `refetchInterval: 4_000` quote and the wallet signature landing. 3000 bps buys real drift tolerance on Shannon's thin binary books; the SDK's re-fit converts that headroom into ~15-20% fewer contracts (a fair trade for a first-try fill instead of a gas-burned refusal).
- **Rejected alternative(s)**: Layer a second cushion in `prepareQuotedCall` (breaks the SDK's escrow≤stake invariant — see domain AGENTS entry); bump `approveAmount` past stake (violates the "approve exactly what may be spent" W-031 rule and surprises the user in MetaMask); pass `slippageMinTicks` instead (the bps cushion already dominates at BTC-15m mid-prices); fall back to MINT_A_PAIR on IOC fail (that path needs an OPPOSITE-side taker on the book too — no free win when the book is truly empty).
- **Task/session**: Real-Shannon Call end-to-end fix (round 2, after 1000 bps was still not enough).

### 2026-09-08 — Demo universe: a real ladder, per-cadence Windows, live tape, one session per wallet
- **Change**: `demo-universe.ts` — new `demoWindowSec(intervalSec)` (`max(150, headroomSec × 3)`) so every compressed Window stays callable for two thirds of its life; `demoWindowIndex`; pools salted with the cadence (two chips of one asset no longer share a tape); new `demoDepthFor` (6 levels a side, 1-point spread, 250→1800 contracts per level ≈ 2.7k tUSDC executable) with `demoBookFor` now the top of that same ladder; new `demoTapeFor` (anonymous `taker: null` colour arriving every 6s of the Window) and `demoPriceFor`. `demo.ts` — `quoteStake` walks the ladder through `fillEstimate` (a 500 tUSDC Call pays a worse average than a 10 tUSDC one); `previewClaimSession`/`claimFinalized` are account-scoped (`FakeClaimRow.account`); buys/sells move `holdings` so Position, settle preview, and Exit work; `seedTape` keeps the pool tape growing and sets each Window's `volumeQuote`/`tradeCount` from its own tape; `windowFor` scans each series at its own span, 12 rolls back, memoized; new `demoExchangeFor(account)` session singleton and `takeAs(account, …)` for the simulated opponent. `fake.ts` — optional `nowSec` clock for recorded fills (+ `FakeClaimRow.account`).
- **Reasoning**: The demo was a single quote pretending to be a market: no depth meant the Book cell said "top of book", the drawer was empty, and any stake filled at the top price. Uniform 150s Windows against real cadence headroom (120s for 1h+) left those chips callable for only 30s of each Window. Claims were adapter-global, so a hydrated opponent's win showed up as the viewer's Claim. And `createDemoExchange` ran on every render of the demo route, so the terminal rewriting its own hash after an accept silently reset the market mid-take.
- **Rejected alternative(s)**: Infinite depth at the top of book (contradicts the ladder the UI shows, and hides the walked-average behaviour the product is about); running demo Windows at their true cadence (a 24h chip cannot settle in a recording); scoping claims by venueId (venue is one demo string); a real scripted opponent bot on a timer (fires before the link is shared — the accept is an explicit control instead).
- **Task/session**: Demo-mode completion pass — BACKLOG W-117.

### 2026-09-08 — fillFromChain: the receipt read through the SDK's own viem client
- **Change**: `somnia.ts` — optional port method `fillFromChain(txHash, win, account)`: `getMarketOnchain` for yesId/noId/decimals, `client.getViemClient().getTransactionReceipt` (shares the SDK WebSocket — no second socket), status must be `success`, then `fillFromReceiptLogs`. Any failure → null (witness absent, not an error). Deadline-wrapped 15s.
- **Reasoning**: Verification needed a witness with no indexer in the path; the SDK exposes the raw viem client exactly for unmodeled reads.
- **Rejected alternative(s)**: A second viem PublicClient (new WebSocket for nothing); raising the read through the portfolio path (the indexer is the outage).
- **Task/session**: Live-deploy fill-verification bug 4 — BACKLOG W-111.

### 2026-09-07 — Read deadlines: a hung indexer request can no longer wedge the board
- **Change**: New `timeout.ts` — `withTimeoutMs(read, ms, label)` (+ tests: pass-through, early-reject propagation, deadline rejection, no post-resolve rejection). Wired across every awaited read in `somnia.ts`: the `loadMarkets` sweep (45s — gate still stamps only on success), warm store + past-Locked/Settling + opening prices + series history (15s), `marketById`, `onchainStatus`, `outcomeBalances`, `fetchOrderBook`, `fetchOpenOrders`, `getPortfolio`, `getOpenPositionsWithPnL`, per-page `getFills`, and the 40-row claim scan's reads (15s each); `quoteBinaryStake`/`getMarketFees` at 10s into their existing catches. Writes untouched.
- **Reasoning**: Live deploy wedged on "Reading the indexer…" indefinitely while other GraphQL traffic flowed — one pending-forever promise (no try/catch can save a hang) held `windowsQ.isLoading` true with no path to the Retry banner. Deadlines turn a hang into the same rejection every catch path already handles honestly.
- **Rejected alternative(s)**: SDK-level AbortController (SDK takes no signal); timeout only on the sweep (any single read could hang); timing out writes (a mined tx reported failed is worse than slow).
- **Task/session**: Live-deploy infinite-loading bug — BACKLOG W-108.

### 2026-09-07 — Blank-safe env URLs on the SDK constructor
- **Change**: `somnia.ts` reads `VITE_INDEXER_URL`/`VITE_WS_RPC_URL` through `envUrl` (from `src/chain/shannon.ts`) — a blank or whitespace var now falls back to the Shannon default instead of reaching `new SomniaMarkets` as `""`.
- **Reasoning**: The Vercel deploy crashed `#/app` with `createClient — needs indexerUrl` because `??` passes empty strings through; see `src/chain/AGENTS.md` 2026-09-07 for the full trace.
- **Rejected alternative(s)**: Local-only fix (`||` in somnia.ts) — chain/wagmi reads had the same trap.
- **Task/session**: Vercel deploy bug — BACKLOG W-106.

### 2026-09-06 — Paged tape reads for proof verification
- **Change**: New `tape-pages.ts` — `readTapePages(fetchPage, pageSize, hardCap)` + `tape-pages.test.ts`; `somnia.ts fillsByPool` pages via the SDK `FillsOptions.offset` (page 400, hard cap 2000 rows).
- **Reasoning**: Duel/replay proofs name exact transactions; a single tail-capped `getFills` can miss the named tx on a busy pool and refuse a valid link (`missing-fill`/`missing-accept-fill`). The SDK supports `offset` paging, so the read pages until the tape is short or the cap stops a hostile pool from looping the reader.
- **Rejected alternative(s)**: One bigger `limit` (still one tail, unbounded trust in its size); unbounded paging (reader abuse surface); paging in the domain (SDK transport mechanics belong to the adapter).
- **Task/session**: Adversarial-review implementation pass — BACKLOG W-100.

### 2026-09-03 — fokBuy seam
- **Change**: `port.ts` `VenueWriter.fokBuy(symbol, contracts, price)`; `somnia.ts` refactors `placeIocBuy` into `placeTimedBuy(…, tif: "IOC" | "FOK", revertCopy)` on the unified `createOrder` TIF; `fake.ts` records `state.foks` and fills the tape like an IOC.
- **Reasoning**: Duel accepts need whole-or-nothing execution. The unified path already exposes `timeInForce: "FOK"`, so no ADR-0002 fight and no raw trader call.
- **Rejected alternative(s)**: Raw `trader.placeOrder` (bypasses the unified seam for no gain); reusing `iocBuy` for accepts (a partial undershoot would then rely on the floor refusal alone).
- **Task/session**: Deepen-the-Duel pass — FOK accept.


### 2026-09-01 — Replay-grade result/error mapping and honest fake parity
- **Change**: `LiveWindow.result` and Somnia `seriesResult` map voided/winningOutcome for Finalized replay. `marketById`, `fillsByPool`, and `listFills` now propagate proof-read failures; only optional display feeds remain best-effort. `FakeExchangeState` gained account-relative fill ownership, acting-wallet pool-tape stamps, exact quote behavior, `marketById`/`fillsByPool` parity, and configurable zero-fill IOC behavior. Port contract tests enforce the complete adapter surface.
- **Reasoning**: Empty evidence and unavailable evidence have different safety meanings. The fake must exercise the same account, market, and tx boundaries as Shannon or green tests merely certify a different product.
- **Rejected alternative(s)**: Swallowing every adapter error as an empty array; deriving settlement in the UI; a permissive fake with global fills and 50% default odds; live indexer calls in default CI.
- **Task/session**: Adversarial winner-readiness build — W-075, W-079, W-080.

### 2026-08-31 — Duel seams: marketId-stamped fills, pool-tape reads, unique fake tx hashes
- **Change**: `port.ts` — `WalletFill.marketId?` (duels key by market; fake stamps it, somnia's portfolio path cannot — see Reasoning), `MarketFill.marketId?/taker?/maker?` (replay-grade), `WindowFeed.marketById(marketId)` (replay-grade; Finalized rows included) and `WindowFeed.fillsByPool(pool, decimals, limit?)` (one-shot indexer read via `client.getFills`). `somnia.ts` — `marketById` via `client.getMarket` + `liveFromBinary(…, {finalizedOk: true})`; `fillsByPool` maps FillRow incl. `takerOrder.side`→aggressor with `takerSide`/`takerIsBid` fallbacks. `fake.ts` — every write returns a distinct `0xfakeN` hash and stamps it on the wallet fill tape; IOC writes also append to the pool tape (`marketFills[pool]`) with `state.actingAccount` as taker; new `iocFills: boolean` knob simulates a landed-but-unfilled IOC; `marketById`/`fillsByPool` implemented.
- **Reasoning**: Duels verify fills by marketId + wallet. The SDK's `PortfolioTrade.market` has no marketId, so the real adapter cannot stamp it on the wallet tape — duel verification therefore reads the pool's public tape (`getFills`), which carries `market` (bytes32), `taker`, and sides. Unique fake hashes make tx-hash receipt matching meaningful in tests; `iocFills: false` makes the zero-fill refusal path testable end-to-end.
- **Rejected alternative(s)**: Stamping marketId on the somnia wallet tape anyway (type error — field genuinely absent; faking it by asset+cadence would cross sibling Windows); reusing `getLiveFills` for replay (live-store tail rotates; the one-shot indexer query is the stable read); keeping `"0xfake"` for all writes (tx-hash matching would sum unrelated fills).
- **Task/session**: Window Duel identity pass — items 1, 3, 4, 12 adapter seams.


### 2026-08-30 — Warm start + 45s reload gate
- **Change**: `fullLoad()` — single in-flight `loadMarkets(true)`, stamps `lastFullLoad` **on success only**. `listLiveWindows`: full sweep only when `Date.now() - lastFullLoad > 45_000`, else `loadMarkets(false)` (warm store, instant). `warmExchange()` (module-flagged) fired from `Landing` and `Docs` mounts.
- **Reasoning**: Cold `loadMarkets(true)` costs ~10s (registry page + per-pool grid reads) — a judge clicking through from the landing saw 12s of skeleton. The SDK returns its warm store instantly on `loadMarkets(false)`; full reload still runs at most every 45s so successor Windows appear within a roll. Stamping on success means a failed sweep leaves the gate stale and the next poll retries instead of serving an empty store for 45s.
- **Rejected alternative(s)**: `loadMarkets(false)` forever (store is frozen — successors never appear; the SDK only rebuilds `exchange.markets` inside `loadMarkets`). Reloading every 8s poll (12s+ per query forever). Stamping at sweep start (one indexer hiccup = 45s of "No live Window").
- **Task/session**: Hackathon enhancement pass — live-browser QA finding (measured 15.8s cold → 5.8s warm to live question).

### 2026-08-28 — Multi-venue, deduped, fee-aware claim scan
- **Change**: `listSettledSnapshots` dedupes by `marketId` (`seen` set). New `withHeldFees`: after a first `readClaimSession`, fetch `getMarketFees` only for held marketIds and re-read with `SettledWindow.feeBps` set — preview and execute share it. `previewClaimSession`/`claimFinalized` signatures unchanged (venueId stays optional but App passes none).
- **Reasoning**: Winnings must not hide behind the live Window's venue (two venues share the indexer). Per-market fees on all 40 rows would be 40 extra reads; fees only matter where a redeem is pending (usually 0–3 rows).
- **Rejected alternative(s)**: Two venue-scoped scans merged client-side (doubles indexer round-trips). Passing a per-row fee map into `readClaimSession` (the row carrying its own fee keeps the domain fold pure).
- **Task/session**: Brutal-overhaul session — W-050/W-051.

### 2026-08-28 — Claim receipt includes failed Windows
- **Change**: Fake `claimFinalized` returns `failed: 0` (in-memory Claim is atomic). Live path inherits `executeClaims` continue-after-fail.
- **Reasoning**: Receipt shape must match `ClaimReceipt` so App toast copy can name leftover Windows.
- **Rejected alternative(s)**: Teaching the fake to inject a failing redeem (no product value; domain already covers it).
- **Task/session**: Loop tick 31 — W-048.

### 2026-08-28 — Claim preview is a session, not a count
- **Change**: `previewClaimSession` returns `{ count, windows, payout }` from `readClaimSession`. `claimFinalized` returns the same plus `txHash`. Fake zeros balances only on Claim, not preview.
- **Reasoning**: Tote and toast need unique Windows and expected tUSDC. Intent length made a void look like two Claims.
- **Rejected alternative(s)**: Returning only `windows` (loses redeem count for execute). Fetching per-row `getMarketFees` on the 40-row scan.
- **Task/session**: Loop tick 30 — W-047.

### 2026-08-28 — Market tape + price feed on the port
- **Change**: `WindowFeed.listMarketFills(pool, decimals)` maps SDK `getLiveFills` (aggressor from `takerSide`, falling back to `takerIsBid`) and `watchAssetPrice`/`assetPrice` wrap `client.watchPrice` + `getLivePrice` (human `price`/`ema`). Fake stores `marketFills`/`prices`/`watchedAssets` seed state.
- **Reasoning**: `getLiveFills` is a sync live-store read (no round-trip) — the public tape is nearly free. `watchPrice` is ref-counted by the SDK; calling it per asset change composes with SDK internals. Both degrade to empty/null on any failure; the board never depends on them.
- **Rejected alternative(s)**: `getFills(pool)` one-shot (indexer lag on a tape meant to feel live). Polling `fetchOrderBook` for price (wrong number — that's a probability, not the underlying).
- **Task/session**: Three-page redesign session — Pulse charts.

### 2026-08-28 — Cancel Open ticket hash
- **Change**: `VenueWriter.cancelOpenTicket` returns `string | undefined`. Somnia `writeTxHash(cancelOrder)` — unified cancel has `info: TxResult`, no `txHash` on the wrapper. Fake returns `"0xfake"` after dropping the ticket.
- **Reasoning**: Explorer proof for the remaining wallet write. Rest quote leaves escrow; cancel is how it returns.
- **Rejected alternative(s)**: Parsing `cancelOrder.id` (on-chain order id, not a tx). Domain `executeCancel` (no Call-session gate; cancel is already a port write).
- **Task/session**: Loop tick 22 — W-040.

### 2026-08-28 — Series history oracle receipts
- **Change**: `PastWindow.oracleQuestionId`. Somnia maps `listPastBinaryMarkets` `oracleQuestionId`. Fake history round-trips the field. CallBoard chips with an id are `oracleReceipt` links; chips without stay spans.
- **Reasoning**: PRD #34. The live Window's ghost link is the successor (often still Trading). Settled receipts belong on the history strip.
- **Rejected alternative(s)**: Domain importing the oracle host (chain owns `oracleReceipt`). Fetching `getOracleQuestion` per chip (the id is already on the market row).
- **Task/session**: Loop tick 20 — W-038.

### 2026-08-28 — Claim + faucet hashes
- **Change**: `claimFinalized` returns `{ count, txHash }`. Somnia redeem/faucet return `TxResult.hash`. Fake returns `"0xfake"` on Claim and mint.
- **Reasoning**: Explorer proof for writes that are not IOC orders. Last redeem is enough for a batch Claim.
- **Rejected alternative(s)**: Changing `previewClaimSession` (still a count). Returning the full hash list through the port.
- **Task/session**: Loop ticks 18–19 — W-037.

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
Demo: never call `createDemoExchange` inside a React render — use `demoExchangeFor` (the market is in-memory state). Demo tape colour must keep `taker: null`: every proof read matches a named wallet and a named tx, so anonymous rows can never become a duel leg or mint a claim. `demoWindowSec` compresses duration but the cadence label stays the venue's, so headroom (and therefore the invite TTL) still comes from `intervalSec` — max 120s on any chip. Key by `marketId`. Pools recycle. `loadMarkets()` skips Finalized binaries. Receipt for unified `createOrder` is on `order.info`. Bind wallet before faucet/Call/Claim or `trader` throws SignerRequiredError. `getOutcomeBalance` takes `{ outcomeToken, account, id }` — recipes.md still shows positional args. `listPastBinaryMarkets` cadence filter is exact; snap client-side because live 1h rows can be 3598s. `quoteBinaryStake` needs an active marketId watch (`useLiveOdds`); catch and return null so a cold store falls back to the polled book. `getMarketFees` indexer strings are standard bps (not bpsTimes1k despite the client d.ts comment). `getPortfolio(account)` is the unsigned fill tape; `fetchMyTrades` throws without a signer. `computeOpenPositionsPnL` still groups fills by pool — prefer portfolio trades keyed by market when mapping the tape. `loadMarkets` / unified `active` is `now < expiry`; just-expired Locked rows come from `listPastBinaryMarkets`, not the live registry.
