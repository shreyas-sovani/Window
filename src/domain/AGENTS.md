# AGENTS.md — src/domain

## Ownership
Pure Event Contract domain: Grid, Lifecycle, CallTicket, Call session, Rest quote, Claim session, Claim primary, Window board, Book depth, Series record, Series P&L, Board notice, Pulse chart folds, Settle preview, Wallet P&L, Window phase, ClaimPlan, WalletGate, RevertCopy, pickWindow, Cadence, order expiry.

## Purpose
Encode venue rules (tick/lot, Trading-only writes, Finalized claims, four-state wallet, cadence snap) so UI and SDK adapters cannot drift.

## What This Controls
Wrong Grid → InvalidPrice or silent zero-size orders. Wrong ClaimPlan → gas spent on losers or missed voids. Wrong Lifecycle → orders on Locked Windows. Wrong Cadence snap → 1h series missing when indexer reports 3598s. Wrong Claim primary → winnings stay behind a ghost button while the successor is Trading. Wrong Rest quote → a "post-only" control that actually IOC-takes. Wrong Series P&L → ETH 1h money mixed into BTC 15m. Wrong Board notice → stacked banners with no next action. Wrong `pulseReady` → last-window bars hidden behind "Collecting ticks…" until a spark has two samples. Wrong RevertCopy → `below-lot` or SignerRequired dumps as a generic STT toast. Wrong `crashNotice` → a stack in the banner and no Retry.

## Connections
- Depends on: `viem` (`parseUnits` in CallTicket / Window board), `src/exchange/port.ts` types only (`LiveWindow`, `BookTop`, `StakeQuote`, `PastWindow`, `WalletFill`, `PositionPnl`, `Sample`, `MarketFill`)
- Depended on by: `src/ui/App.tsx`, `src/exchange/somnia.ts`, `src/exchange/fake.ts`, `src/domain/*.test.ts`
- External systems touched: none

## Current State
Working. Covered by Vitest (Call session including Stake quote, IOC hash, and Rest quote, Claim session, Claim primary / totePrimary, Window board, Book depth, Series record, Series P&L, Board notice, Crash notice, Settle preview, Wallet P&L, Window phase including Locked fallback, fake ExchangeAdapter, cadence, RevertCopy Call-path throws, Pulse chart folds).

## Decision Log

### 2026-08-28 — Crash notice
- **Change**: `crashNotice(message)` returns a BoardNotice with Retry. First line, 160 chars, no stack. ErrorBoundary remounts on Retry.
- **Reasoning**: PRD #50 next-action on errors. Render crashes are not indexer Board notices, but they share the same notice shape.
- **Rejected alternative(s)**: A second notice type. Showing `error.stack` in the banner.
- **Task/session**: Loop tick 28 — W-045.

### 2026-08-28 — RevertCopy Call-path throws
- **Change**: `revertCopy` maps `below-lot`, `Window is not Trading`, `SignerRequired`, and on-chain/redeem revert. Adapter `placeIocBuy` throws `below-lot`; Call session throws not-Trading — both used to hit the generic STT fallback.
- **Reasoning**: PRD #24. Prepare-skip already has `callSkipCopy`; the write catch path did not.
- **Rejected alternative(s)**: Importing `callSkipCopy` into RevertCopy (couples a write-failure mapper to prepare reasons). Showing the raw `below-lot` string.
- **Task/session**: Loop tick 27 — W-044.

### 2026-08-28 — Chart folds
- **Change**: `chart.ts` — `pushSample` (append newest-last, drop duplicate `t`, cap 120), `sparkPath` (min-max normalized SVG polyline, empty under 2 points, constant-series safe), `outcomeBars` (newest-first capped history bars), `tapeRows` (newest-first market tape). Types `Sample`/`MarketFill` live in `exchange/port.ts`.
- **Reasoning**: Sparkline geometry is pure math — belongs in the tested domain layer, not JSX. Normalization handles any scale (price vs probability) with one function.
- **Rejected alternative(s)**: A chart library (ADR-0003 spirit: no UI dep in domain; SVG paths are 30 lines). Sampling inside components (untestable, and the cap/dedupe rules would rot).
- **Task/session**: Three-page redesign session — Pulse charts.

### 2026-08-28 — History Line
- **Change**: `historyLine(openingPrice)` returns a positive number or undefined. CallBoard chips append `fmt(line, 2)` next to the settle time.
- **Reasoning**: PRD #35. Adapter already fetches `getOpeningPrices` onto `PastWindow.openingPrice`; the chip was result + time only.
- **Rejected alternative(s)**: Parsing Line from question text. Showing `0` / `NaN` as a fake Line.
- **Task/session**: Loop tick 21 — W-039.

### 2026-08-28 — Claim receipt hash
- **Change**: `ClaimWriter.redeem` returns a hash. `executeClaims` returns `{ count, txHash }` using the last successful redeem.
- **Reasoning**: PRD #37. A Claim session is N redeems; the toast can only reasonably link one. Last hash is the most recent write.
- **Rejected alternative(s)**: Linking every redeem in the toast. Returning only `count` and hoping the fill tape indexes Claims (it is trade fills, not redeems).
- **Task/session**: Loop ticks 18–19 — W-037.

### 2026-08-28 — Series P&L + Board notice
- **Change**: `seriesPnl` / `seriesPnlCopy` filter Wallet P&L by asset + `canonicalInterval`. `boardNotice` picks one empty/error/thin-book/short-collateral row with a next action.
- **Reasoning**: PRD #36 vs Series record (scoreboard, not money). PRD #50 — stacked banners hid the next action. Load errors beat missing Windows; short collateral beats a thin book.
- **Rejected alternative(s)**: Replacing mast Wallet P&L with series-only (wallet-scoped tape stays in PnlStrip). Inferring series money from history chips. Multiple simultaneous banners.
- **Task/session**: Loop ticks 16–17 — W-035, W-036.

### 2026-08-28 — Rest quote (post-only)
- **Change**: `restLimit` / `planRest`. `prepareRest` / `executeRest` / `restSkipCopy`. `CallWriter.restBuy` is not `iocBuy`. Rest Up prices at the bid; Rest Down at `1 − ask`. Crossed book is `would-take`.
- **Reasoning**: PRD #46. Default Call stays IOC so leftover size does not rest. Power users need a deliberate maker path; Open tickets already cancel escrow.
- **Rejected alternative(s)**: A post-only toggle on Call Up/Down (would make resting the easy accident). GTC without post-only (can still take).
- **Task/session**: Loop tick 15 — W-034.

### 2026-08-28 — Call session returns IOC hash
- **Change**: `CallWriter.iocBuy` / `iocSell` return `string | undefined`. `executeCall` / `executeExit` pass that hash through.
- **Reasoning**: PRD #37. The toast is the moment the user wants to prove the Call; the P&L tape only appears after the indexer catches up.
- **Rejected alternative(s)**: Putting Shannon explorer URLs in domain (chain owns `explorerTx`). Waiting for `listFills` before linking.
- **Task/session**: Loop tick 14 — W-033.

### 2026-08-28 — Claim primary
- **Change**: `totePrimary({ gate, claimable })` / `totePrimaryCopy`. Claim beats Call, approve, and wait once Shannon is selected. Connect and switch still come first.
- **Reasoning**: PRD #29. Successor Windows are Trading (PRD #41) so WalletGate said `call` and Claim stayed a ghost. Redeem does not need tUSDC allowance.
- **Rejected alternative(s)**: Hiding the successor until Claim (blocks the next Call). A new WalletGate action (Claim is not a Call gate).
- **Task/session**: Loop tick 13 — W-032.

### 2026-08-28 — Bounded stake allowance
- **Change**: `approveAmount(stakeRaw)` returns the stake or 0n. App refuses to send `approve` when the amount is 0. Removed the 10_000 tUSDC fallback.
- **Reasoning**: PRD #49. A 10k fallback is a hidden extra allowance if stake is ever 0 on the approve path. Domain owns the amount so UI cannot reintroduce max-uint.
- **Rejected alternative(s)**: Approving the faucet cap (10_000) "so they only sign once". Infinite `MaxUint256`.
- **Task/session**: Loop tick 12 — W-031.

### 2026-08-28 — Cadence label
- **Change**: `cadenceLabel` snaps then prints 1m / 5m / 15m / 1h / 4h / 24h. `gateLabel("wait", …, phase)` reuses `windowPhaseCopy` so the primary is Locking/Locked, not a dead Call.
- **Reasoning**: `intervalSec / 60 + "m"` printed BTC 24h as 1440m. Wait-gate copy was generic while the tote already knew the phase.
- **Rejected alternative(s)**: Duplicating hour/minute branches in CallBoard and PnlStrip. A new GateAction for locking (Call session already refuses).
- **Task/session**: Loop tick 11 — W-030.

### 2026-08-28 — Just-expired Locked fallback
- **Change**: `pickWindow` falls back to the newest Trading/Locked/Settling row whose expiry is within one cadence behind now. Successor (unexpired) still wins. Stale Locked older than one interval is dropped.
- **Reasoning**: After expiry `loadMarkets` marks binaries inactive (`now >= expiry`). Without a wait row the board went blank again until the next series listed.
- **Rejected alternative(s)**: Showing Finalized on the live board (series history). Keeping Locked forever (would hide a missing successor).
- **Task/session**: Loop tick 10 — W-029.

### 2026-08-28 — Window phase (board through headroom)
- **Change**: `pickWindow` keeps unexpired Trading/Locked rows even inside headroom. `windowPhase` / `windowPhaseCopy` name Trading vs Locking vs Locked. `readBoard.phase` carries that onto the tote.
- **Reasoning**: Headroom is a Call gate. Hiding the row also hid Exit, holdings, and the countdown for the last ~90s of a 15m Window.
- **Rejected alternative(s)**: A second picker (`pickCallableWindow`) — Call session already refuses too-close. Listing Finalized rows as live (those belong in series history).
- **Task/session**: Loop tick 9 — W-028.

### 2026-08-28 — Wallet P&L from fills
- **Change**: `fillCashflow` / `sessionTape` / `pnlTotals` / `pnlCopy` in `pnl.ts`. Buy quote is negative cashflow; unattributable side/direction rows are dropped. Totals scale each `PositionPnl` by its own decimals.
- **Reasoning**: Adapter owns SDK P&L; domain only aggregates display-grade rows. Series record stays a scoreboard.
- **Rejected alternative(s)**: Importing `computeOpenPositionsPnL` (ADR-0003, and that fold groups fills by pool). Inventing tUSDC P&L from Series history alone.
- **Task/session**: Loop tick 8 — W-027.

## Earlier history (condensed)
First slice: Grid, Lifecycle, CallTicket, ClaimPlan, WalletGate, RevertCopy, pickWindow. Then Call session + cadence snap, Claim session, Window board, Stake quote, Book depth, Series record, Settle preview, `parseSettlementFeeBps`.

## Known Gotchas
Headroom is 10% of `intervalSec`, not a fixed 300s (that kills 5m series). Collateral decimals come from the Window, not a hardcoded 6. Indexer cadence can be a few seconds off the label — always snap.
