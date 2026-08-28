# AGENTS.md — src/domain

## Ownership
Pure Event Contract domain: Grid, Lifecycle, CallTicket, Call session, Rest quote, Claim session, Claim primary, Window board, Book depth, Series record, Series P&L, Board notice, Settle preview, Wallet P&L, Window phase, ClaimPlan, WalletGate, RevertCopy, pickWindow, Cadence, order expiry.

## Purpose
Encode venue rules (tick/lot, Trading-only writes, Finalized claims, four-state wallet, cadence snap) so UI and SDK adapters cannot drift.

## What This Controls
Wrong Grid → InvalidPrice or silent zero-size orders. Wrong ClaimPlan → gas spent on losers or missed voids. Wrong Lifecycle → orders on Locked Windows. Wrong Cadence snap → 1h series missing when indexer reports 3598s. Wrong Claim primary → winnings stay behind a ghost button while the successor is Trading. Wrong Rest quote → a "post-only" control that actually IOC-takes. Wrong Series P&L → ETH 1h money mixed into BTC 15m. Wrong Board notice → stacked banners with no next action.

## Connections
- Depends on: `viem` (`parseUnits` in CallTicket / Window board), `src/exchange/port.ts` types only (`LiveWindow`, `BookTop`, `StakeQuote`, `PastWindow`, `WalletFill`, `PositionPnl`)
- Depended on by: `src/ui/App.tsx`, `src/exchange/somnia.ts`, `src/exchange/fake.ts`, `src/domain/*.test.ts`
- External systems touched: none

## Current State
Working. Covered by Vitest (Call session including Stake quote, IOC hash, and Rest quote, Claim session, Claim primary / totePrimary, Window board, Book depth, Series record, Series P&L, Board notice, Settle preview, Wallet P&L, Window phase including Locked fallback, fake ExchangeAdapter, cadence).

## Decision Log

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

### 2026-08-28 — Parse settlement fee
- **Change**: `parseSettlementFeeBps` turns indexer decimal strings into bigint bps; null/blank/junk/negative → 0n.
- **Reasoning**: Adapter must not inline string parsing; tests pin the missing-plumbing case.
- **Rejected alternative(s)**: Dividing by 1000 (that is on-chain `bpsTimes1k`, not the indexer field `estPayoutFor` consumes).
- **Task/session**: Loop tick 7 — W-026.

### 2026-08-28 — Settle preview
- **Change**: `settlePreview` / `settlePreviewCopy` — winner `amount × (10_000 − feeBps) / 10_000`, Void half each side, loser 0. Default fee 0 bps.
- **Reasoning**: Same protocol rule as SDK `estPayoutFor`, tested offline. Position banner can show Claim-time collateral without a live fee fetch.
- **Rejected alternative(s)**: Domain importing markets-sdk. Treating Void as 0 (protocol redeems both sides at 0.5).
- **Task/session**: Loop tick 6 — W-025.

### 2026-08-28 — Series record
- **Change**: `readSeriesRecord` / `seriesRecordCopy` tally Finalized Up/Down/Void. `last` is the newest expiry even when the indexer array is unsorted.
- **Reasoning**: History chips were untested display. A series scoreboard belongs in domain; it is not fill-based wallet P&L.
- **Rejected alternative(s)**: Importing SDK `computePositionPnL` (ADR-0003). Treating chip order as recency (indexer order is not a contract).
- **Task/session**: Loop tick 5 — W-024.

### 2026-08-28 — Book depth
- **Change**: `readBookDepth` / `summarizeDepth` convert raw Up bids/asks into human levels (Down = 1 − Up), skip zero/invalid prices, cap at 5, accumulate size.
- **Reasoning**: Drawer display rules belong in domain so UI cannot grow a four-sided blotter. SDK BinaryOrderBook stays in the exchange adapter.
- **Rejected alternative(s)**: Passing `BinaryOrderBook` into CallBoard (ADR-0003). Showing NO bids/asks as a second ladder (same book, inverted).
- **Task/session**: Loop tick 4 — W-014.

### 2026-08-28 — Stake quote
- **Change**: `prepareQuotedCall` takes a `StakeQuote` (raw quantity / limitPrice / escrow) and still gates on Trading + headroom. `readBoard` prefers `upQuote`/`downQuote` when present.
- **Reasoning**: Live-book fill size belongs in Call session, not App. Quote fields stay raw so the adapter can pass SDK `BinaryStakeQuote` through without domain importing markets-sdk.
- **Rejected alternative(s)**: Domain calling `quoteBinaryStake` (violates ADR-0003). Treating a null quote as "disable Call" (a cold watch would lock the ticket).
- **Task/session**: Loop tick 3 — W-022.

### 2026-08-28 — Window board
- **Change**: `readBoard` composes pickWindow, Call session, implied Up, and WalletGate. `gateLabel` names the four-state primary action.
- **Reasoning**: App was re-deriving live/plans/gate in the render path (no locality). WalletBar and CallBoard now render a board they do not compute.
- **Rejected alternative(s)**: Extracting only JSX without a tested read model (shallow split).
- **Task/session**: Loop tick 2 — split App wallet vs board.

### 2026-08-28 — Claim session
- **Change**: `planClaimSession` sorts newest-expired first, caps the scan, and expands ClaimPlan into redeem intents. `executeClaims` is the write loop.
- **Reasoning**: Deletion test — without this, sort/cap/void/winner rules live in the Somnia adapter and cannot be tested offline.
- **Rejected alternative(s)**: Keeping the scan loop in `claimFinalized` (no locality). Teaching App to call `planClaims` per row.
- **Task/session**: Loop tick — deepen Claim session.

### 2026-08-28 — Call session + cadence snap
- **Change**: `prepareCall` / `executeCall` / `prepareExit` / `executeExit` gate IOC writes on on-chain Trading. `canonicalInterval` snaps indexer `intervalSec` onto 60/300/900/3600/14400/86400.
- **Reasoning**: App was owning write rules (no locality). Live ETH 1h rows arrive as 3598s (`expiry − tradingStart`), so exact match hid the series.
- **Rejected alternative(s)**: React hook owning the Trading check (untestable without wagmi). Parsing `interval` labels from question text (CONTEXT forbids that).
- **Task/session**: Architecture pass after first live UI.

### 2026-08-28 — First domain slice
- **Change**: Added Grid, Lifecycle, CallTicket, ClaimPlan, WalletGate, RevertCopy, pickWindow.
- **Reasoning**: ADR-0003 — SDK-free domain so tests run offline.
- **Rejected alternative(s)**: Putting tick snap only in the SDK call site (untested in CI).
- **Task/session**: Initial Window build.

## Known Gotchas
Headroom is 10% of `intervalSec`, not a fixed 300s (that kills 5m series). Collateral decimals come from the Window, not a hardcoded 6. Indexer cadence can be a few seconds off the label — always snap.
