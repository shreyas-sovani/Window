# AGENTS.md — src/domain

## Ownership
Pure Event Contract domain: Grid, Lifecycle, CallTicket, Call session, Filled receipt, Rest quote, Claim session, Claim primary, Window board (incl. side-aware gate + windowTickets), Book depth, Market health, Series record, Series P&L, Board notice, Pulse chart folds, Settle preview, Wallet P&L, Window phase, ClaimPlan, WalletGate, RevertCopy, pickWindow, Cadence, order expiry, Rematch (roll), Duel, Challenge link, Judge replay, auto-series/onboarding folds.

## Purpose
Encode venue rules (tick/lot, Trading-only writes, Finalized claims, four-state wallet, cadence snap) so UI and SDK adapters cannot drift.

## What This Controls
Wrong Grid → InvalidPrice or silent zero-size orders. Wrong ClaimPlan → gas spent on losers or missed voids. Wrong Claim session preview → void counts as two "winnings" or the tote says "outcome balances". Wrong `executeClaims` abort → one reverted redeem hides later Windows. Wrong Lifecycle → orders on Locked Windows. Wrong Cadence snap → 1h series missing when indexer reports 3598s. Wrong Claim primary → winnings stay behind a ghost button while the successor is Trading. Wrong Rest quote → a "post-only" control that actually IOC-takes. Wrong Series P&L → ETH 1h money mixed into BTC 15m. Wrong Board notice → stacked banners with no next action. Wrong `pulseReady` → last-window bars hidden behind "Collecting ticks…" until a spark has two samples. Wrong RevertCopy → `below-lot` or SignerRequired dumps as a generic STT toast. Wrong `crashNotice` → a stack in the banner and no Retry. Wrong Market health → "No odds" beside enabled Call buttons, or a claimed depth the watch never saw. Wrong Rematch → an offer to Call a side with no executable odds, or on the dead marketId. Wrong Filled receipt → an intent masquerading as a fill (receipt, roll, and challenge from an unfilled IOC). Wrong Duel → a "winner" from URL fields, a matched-pot implication, or an accept credited before the tape verifies. Wrong Challenge link decode → a half-trusted hint. Wrong Judge replay → a duel reconstructed from a hash that is not a fill on that market.

## Connections
- Depends on: `viem` (`parseUnits` in CallTicket / Window board), `src/exchange/port.ts` types only (`LiveWindow`, `BookTop`, `StakeQuote`, `PastWindow`, `WalletFill`, `PositionPnl`, `Sample`, `MarketFill`)
- Depended on by: `src/ui/App.tsx`, `src/exchange/somnia.ts`, `src/exchange/fake.ts`, `src/domain/*.test.ts`
- External systems touched: none

## Current State
Working. Covered by Vitest (Call session including Stake quote, IOC hash, and Rest quote, Filled receipt incl. marketId scoping and bare-series refusal, Claim session including Windows + payout copy and continue-after-fail, Claim primary / totePrimary, Window board incl. side-aware either-side gate and windowTickets, Book depth, Market health, Rematch, Duel incl. tape aggregation + fake two-wallet fixtures, Challenge link incl. tamper/refusal, Judge replay incl. fail-closed, auto-series incl. hottestCadence, Series record, Series P&L, Board notice, Crash notice, Settle preview, Wallet P&L, Window phase including Locked fallback, fake ExchangeAdapter, cadence, RevertCopy Call-path throws, Pulse chart folds).

## Decision Log

### 2026-08-31 — challengeableReceipt selector
- **Change**: `challenge-link.ts` gains `challengeableReceipt(receipts, challenger, nowSec)` — newest receipt that still passes `challengePayloadFromReceipt` (wallet named, fill hash present, Window unexpired). The UI strip's only source.
- **Reasoning**: The strip needs one deterministic pick from the session receipts; the eligibility rules already lived in `challengePayloadFromReceipt`, so the selector just orders and reuses them.
- **Rejected alternative(s)**: First-element trust (an expired or zero-fill receipt would show a dead link); duplicating eligibility checks in the UI.
- **Task/session**: Window Duel UX-only pass — item 1/3.


### 2026-08-31 — Duel, Filled receipt, Challenge link, Judge replay; Roll → Rematch
- **Change**: New `filled-call.ts` (`filledCall` reads a Call's actual fill off the wallet tape — tx-hash, since-sec, or marketId locators, `callReceiptFromFill` builds the receipt from tape numbers only; bare series match refused). New `duel.ts` — `DuelFill`/`DuelWindow`/`ChallengeHint` chain-shaped snapshots; `verifyChallenge` (fill wins over every URL field), `verifyAccept` (refuses self/same-side/wrong-market/missing-fill/not-Trading; unequal stakes stay visible), `settleDuel` (winner = side match; void = draw; unknown stays open), `readDuel` full state machine (a fill before expiry proves Trading then — settled duels are not re-gated; one lonely fill past expiry = expired, not a win), `tapeDuelFill` (pool-tape aggregation, marketId first so sibling Windows never cross), `duelRefusalCopy`. New `challenge-link.ts` — versioned base64url `#/app?d=` payload (marketId, challenger, side, stake, txHash, expiry), `decodeChallengeLink` fail-soft to null, `challengePayloadFromReceipt` only from a verified receipt on an unexpired Window with a wallet to name. New `replay.ts` — `replayDuel` from pinned marketId + two tx hashes + finalized outcome, fail-closed (`replayRefusalCopy`). `roll.ts` renamed to Rematch (side kept, never flipped; still successor-only, series-snapped, callable-gated, per-marketId dismiss). `window-board.ts` gate now `upPlan.ok || downPlan.ok` (a Down-only book allows Call Down; each button still gates on its own plan) + new `windowTickets` (Up and Down symbols of the live Window).
- **Reasoning**: The duel is the product, and every success state must come from a verified fill or settlement — so the receipt/roll/challenge pipeline had to move from intent-plan numbers to tape-read numbers, and the duel state machine had to take chain-shaped snapshots with the URL as locator only. Duel proofs read the pool's public tape (`MarketFill` with marketId + wallets) rather than portfolio trades because the SDK's PortfolioTrade.market carries no marketId — asset+cadence matching would cross sibling Windows of the same series. `readDuel` treats an in-window fill as its own proof of Trading because the pool cannot fill otherwise; re-checking today's status would mark every settled duel invalid.
- **Rejected alternative(s)**: Receipts from `PlaceOrderResult.fills` (OrderFill's NO-side price semantics are undocumented — the tape is unambiguous); building duels on WalletFill rows (no marketId on the real adapter's portfolio path); a matched-pot/escrow interpretation (users are social opponents, not counterparties — spec); side-flip on rematch (keep is one rule, matches roll semantics, tested); trusting the link's expiry for expiry state (chain window wins).
- **Task/session**: Window Duel identity pass — items 1–5, 10, 12 domain.

### 2026-08-31 — tapeDuelFill notTaker
- **Change**: `tapeDuelFill` accepts `notTaker` — find the opponent by exclusion (any other wallet on the opposite side), used by App so a settled duel renders for a viewer who is neither wallet.
- **Reasoning**: The result view is public evidence, not a participant control.
- **Rejected alternative(s)**: Deriving the acceptor only from the connected wallet (a judge with one browser sees nothing settle).
- **Task/session**: Window Duel close-out verification pass.

### 2026-08-30 — Market health, hottest cadence, Roll
- **Change**: W-060 `market-health.ts` — `marketHealth({book, depth, expirySec, intervalSec, nowSec})` grades strong/fair/thin/none from spread + min-side walked depth (`fillEstimate` at ∞), with `healthDetail` compact copy. W-062 `hottestCadence` in `auto-series.ts` (max `seriesScore` per cadence, tie → shorter). New `roll.ts` W-roll — `rollPrompt` offers the last witnessed Call on the successor of the same series, dismissed per-marketId.
- **Reasoning**: The board needed one honest answer to "can I actually trade this?" — spread-only when the depth watch is cold (grades the spread, says "top of book", never claims depth), thin from the same `headroomSec` where Calls actually close (no "thin" beside live buttons). Roll is the consumer-safe roll companion: SDK-FEEDBACK #9 documents why a hot-key roll bot is not shippable (`placeBinaryOrderFor` exists on-chain but Trader exposes no binary place-for path), so the human presses and the wallet signs.
- **Rejected alternative(s)**: Grading on the polled top alone (claims nothing about size); a fixed 120s near-lock cap (contradicted enabled Calls on 5m windows for 90s); gating roll on `upPlan.ok` only (offered a Down roll the ticket would then refuse — fixed side-aware in App); a real session-key bot (ADR-0001 + unprovable through the SDK).
- **Task/session**: Hackathon enhancement pass — W-060/W-062/Roll.

### 2026-08-29 — Onboarding step + chip status
- **Change**: `onboarding.ts` — `nextStep` folds connect/switch/gas/mint/approve/wait/call into one `{kind,title,action,explanation}` with honest copy (approve names the exact stake; gas only when STT provably zero; wait explains lock/roll). `chipStatus` per series: trading / waiting / none, cadence-snapped.
- **Reasoning**: The guided panel is presentation, but the *order and copy* of the journey is product truth — testable, SDK-free, reusable if the UI changes again. WalletGate stays the write gate; this is its consumer-facing projection plus gas/mint steps WalletGate never owned.
- **Rejected alternative(s)**: Extending WalletGate (its GateAction feeds write gating; mint/gas would pollute it). Deriving steps in CallBoard JSX (untestable, and copy would drift from gate truth).
- **Task/session**: Onboarding redesign — W-069.

### 2026-08-29 — RevertCopy stops leaking internals
- **Change**: `stringify` uses `shortMessage`/`message`/`details` only, 240-char cap. No `err.stack`, no `JSON.stringify(err)` in the fallback path (W-066).
- **Reasoning**: The audit found stack traces and serialized error objects reaching the toast — technical leakage with no user value.
- **Rejected alternative(s)**: Truncating the stack instead of dropping it (still leaks paths/frames). A allowlist of known error shapes only (new pool errors would fall to generic copy — acceptable, but the field filter keeps newer viem shortMessages readable).
- **Task/session**: Adversarial safety audit — W-066.

### 2026-08-29 — Liquidity preview + proof cards
- **Change**: W-058 `liquidity.ts` — `fillEstimate` walks top-5 depth per side (Up: YES asks asc; Down: NO asks = 1 − YES bids, best first) returning filled stake / avg odds / unfilled remainder / whole-book ceiling; `fillCopy` prefixes "est." and never promises. W-059 `proof-card.ts` — `proofCard` / `settledProofCard` format a witnessed `CallReceipt` (decision, Line, lock, stake → contracts @ avg odds, if-right/at-risk, explorer tx; settled variant appends result + oracle link).
- **Reasoning**: The ticket showed sizing but not *how executable* it was at these odds; and every share of a receipt is distribution for dreamDEX with zero backend. Both folds are pure and SDK-free (ADR-0003).
- **Rejected alternative(s)**: Reading liquidity from the SDK stake quote alone (one number, no avg-odds or ceiling; the quote also needs a live watch snapshot). Persisted receipts (localStorage) — session-witnessed only keeps the "we do not fabricate history" guarantee. Fake share counters.
- **Task/session**: Product-innovation pass — W-058/W-059.

### 2026-08-28 — Honesty pass: no fabricated prices, fee-aware claims, auto-select
- **Change**: W-049 `prepareCall` returns `bad-price` when `impliedUp(book)` is undefined (the `?? 0.5` fallback is gone) and `prepareExit` gains `bad-price` for an empty book. W-050/051 `SettledWindow.feeBps` (per-Window fee over the session fallback) and the empty-scan copy names the 40-window bound. W-052 new `auto-series.ts`: `seriesScore` (Trading + real Line + headroom; -1 otherwise) and `autoSeries` (best series across assets/cadences, venue-blind). W-053 `seriesPnlCopy` says "tape · … fills only, Claim payouts not counted".
- **Reasoning**: An invented 50% could size a Call at odds that do not exist; a venue-scoped claim hid winnings on the other Shannon venue; "Series P&L" overstated what fills can know (redeems are not fills).
- **Rejected alternative(s)**: Keeping 50% as a "provisional" size with a warning (still a lie at sign time). Claim scanning both venues via two venue-scoped queries (one unscoped query + marketId dedupe is one round-trip). Estimating claimed P&L from history results + zero balances (needs per-market balance archaeology the SDK does not expose).
- **Task/session**: Brutal-overhaul session — W-049–W-053.

### 2026-08-28 — Claim session continues after a failed Window
- **Change**: `readClaimSession.held` is per-Window intents + payout. `executeClaims` redeems each Window independently; `failed` is how many did not finish. Receipt payout/windows count only successes. All-fail rethrows. `claimReceiptCopy` appends "N Window(s) could not be claimed."
- **Reasoning**: PRD #32 Claim all. One reverted redeem used to abort the rest, so a bad row hid later winnings.
- **Rejected alternative(s)**: Swallowing all-fail into an empty receipt (RevertCopy would never fire). Continuing remaining intents inside a failed void (the Window already reverted).
- **Task/session**: Loop tick 31 — W-048.

### 2026-08-28 — Claim session Windows + payout
- **Change**: `readClaimSession` returns unique Windows, intents, and expected collateral (Settle preview math: winner fee-adjusted, void at half). `planClaimSession` is that intent list. `executeClaims` takes the session and returns `{ count, windows, payout, txHash }`. `claimSessionCopy` / `claimReceiptCopy` name Windows and tUSDC. `totePrimary` claim kind is `{ windows, payout }`.
- **Reasoning**: Preview was an intent count, so a void looked like two Claims and the toast said "outcome balance(s)". PRD #29/#32 is Windows of winnings, in collateral.
- **Rejected alternative(s)**: Keeping the tote as "Claim winnings" and only fixing the toast. Fetching `getMarketFees` per scanned row (40 RPC reads on a 60s poll; testnet fee is 0).
- **Task/session**: Loop tick 30 — W-047.

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
