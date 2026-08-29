# AGENTS.md — src/ui

## Ownership
Window consumer UI.

## Purpose
Tote-board homepage split: `WalletBar`, `CallBoard`, `Pulse`, and `PnlStrip` on `#/app`. `#/` is `Landing`, `#/docs` is `Docs`. `App` owns wallet writes, queries, Stake quote refetch, venue fee cache, and fill/position P&L refetch.

## What This Controls
If pending states or WalletGate are wrong, users double-submit or Call on the wrong chain. If Call session is bypassed, a just-Locked Window can still be sent. If the board is bypassed, implied odds and the gate can disagree. If `parseRoute` matches prefixes, `#/apps` mounts wagmi and the SDK on a non-terminal hash. If ErrorBoundary has no Retry, a render crash forces a full refresh.

## Connections
- Depends on: `src/domain/*` (`readBoard`, `readBookDepth`, `readSeriesRecord`, `settlePreview`, `pnlCopy` / `sessionTape` / `seriesPnlCopy`, `totePrimary`, `claimReceiptCopy`, `boardNotice`, `crashNotice`, `pulseReady`), `src/exchange/somnia.ts`, `src/ui/useLiveOdds.ts`, `src/ui/format.ts`, `src/ui/router.ts`, `src/chain/*`, wagmi, react-query, `@somnia-chain/markets-sdk/react`
- Depended on by: `src/main.tsx`
- External systems touched: injected wallet, Shannon, SDK live tail

## Current State
MVP UI. Odds prefer `useLiveBinaryOrderBookByMarket` (recycle-safe) and fall back to 4s poll. Call size prefers `quoteStake` when the live book can fill; otherwise the top-of-book plan. Book drawer is collapsed Up depth from the same watch. History strip shows Series record copy above chips. Live holdings show Settle preview with cached venue settlement fee. Connected wallets show Wallet P&L in the mast and a collapsed PnlStrip tape. A locking Window stays on the board (clock kicker Locking, phase copy, Calls disabled, Exit still shown). A just-expired Locked/Settling row stays until the successor lists (clock kicker Locked/Settling, countdown 00:00). Cadence on the tote and tape uses `cadenceLabel`; the wait primary repeats Window phase copy. tUSDC approve is exactly the stake (`approveAmount`); a zero stake does not send a 10k fallback. When Claim session preview `windows` is > 0, the amber primary is `claimSessionCopy` (Windows · tUSDC); the ghost Claim row is hidden so there is one Claim control. Call / Exit / Rest / cancel / approve / Claim / faucet toasts link Shannon explorer when a tx hash is known (`explorerTx` + `shorten`). Book drawer Rest Up/Down (post-only) shows only when WalletGate can Call. History strip shows Series P&L above the Series record. Series history chips with `oracleQuestionId` open the public oracle graph. Chips show the Line when `historyLine` has an opening price. One Board notice replaces stacked empty/error/thin-book banners. Pulse drawer uses `pulseReady` (series history bars count) and paper-ledger CSS; the public tape query keys by `marketId`. Hash routes: `#/` landing, `#/docs` docs, `#/app` terminal (`parseRoute` matches those paths, not prefixes). The tote clock prints `24h 00:00` when more than an hour remains (same hour unit as `cadenceLabel`). ErrorBoundary uses `crashNotice` and a Retry button that remounts children — it does not dump a stack. `shorten` leaves hashes under 12 characters whole (empty is `—`).

## Decision Log

### 2026-08-29 — Onboarding redesign (W-069–W-074)
- **Change**: Series nav split into asset + cadence **ToggleGroups** (aria-pressed pills; cadence pills dim when `chipStatus` is `waiting`, selected pair wears an `auto` badge when `autoSeries` picked it; single scrollable row on mobile). **WalletBar** rebuilt as an account control — balance/P&L summary above a compact address **DropdownMenu** trigger (copy / explorer / disconnect; Escape + outside-click; menu/menuitem roles) — trading actions never in the menu. CallBoard's utility-row primary is replaced by a spacious **onboarding panel** (`nextStep`: connect→switch→gas→mint→approve→wait; title + explanation + one `btn primary onboard-action`; gas opens the STT faucet, mint runs the faucet write, approve/connect/switch go through `onPrimary` under the write mutex). The **approve action also renders beside the stake preview** in the ticket. Claim due renders a distinct green **rewards section** (Windows · tUSDC + Claim). Utilities row keeps only linklike Mint/Claim/STT/Oracle. New kit primitives in-repo: `DropdownMenu`, `ToggleGroup`, `Tooltip`; `Button` now merges `className`.
- **Reasoning**: The audit target was real — after entering a stake, Call Up/Down sat disabled while Approve lived in a utility row. The guided panel makes the next action the biggest thing on screen while Call stays visible-with-reason. shadcn CLI was inspected and rejected: no Tailwind/radix/components.json in the project, and a CLI install would fork the paper-ledger CSS-variable tokens into a second theming system mid-flight with a concurrent agent editing the same files — in-repo primitives with the same variant/composition API carry the UX wins without the migration.
- **Rejected alternative(s)**: Full `npx shadcn add` migration (reason above). Hiding Call buttons during onboarding (user must always see the goal). Putting Claim into the onboarding chain (blocks the next trade; PRD wants successor Trading immediately). `radiogroup` semantics for toggles (these are independent filters, not exclusive radios).
- **Task/session**: Onboarding redesign session — W-069–W-074.

### 2026-08-29 — Transaction-safety pass (W-063–W-068)
- **Change**: New `write-guard.ts` — `useWriteGuard` is the wallet-write mutex for all nine writes (connect/switch/approve/faucet/Call×2/Exit×2/Rest×2/cancel/Claim). The lock is a **ref flipped synchronously on entry**, so double-click, click+Enter, and rerendered-control activations in the same tick are ignored before async starts; state mirrors for rendering; release only in `finally` (receipt, rejection, replacement, revert all land there); nothing auto-retries. Blocked second actions get "One wallet action at a time — {held} is still running." `onPrimary` revalidates chain+address before the approve write; `approveWait.isError` clears the hash and posts "failed or was replaced" (no stuck approving); `mintCollateral` replaces the two faucet busy-juggling call sites. Call/Down buttons carry `title` reasons when disabled. `prefers-reduced-motion` kills all animation. Integration test: connect via mock → click+click+Enter on Mint tUSDC → `faucetCalls === 1` + success banner.
- **Reasoning**: `disabled` props alone race React commit; the entry-guard must be synchronous to beat same-tick re-activation. The unhandled approve error path left a silent half-state (hash held, no feedback) — the closest thing to a false-success vector found in the audit.
- **Rejected alternative(s)**: Debounce (fires late writes anyway). Queueing blocked actions (surprise txs later — worse than a notice). Disabling via context across components (the ref already serializes; buttons stay honest). Re-fetching the stake quote immediately pre-write (the protective limit already bounds drift; a fresh quote can still go stale before sign).
- **Task/session**: Adversarial safety audit — W-063–W-068.

### 2026-08-29 — Fill preview in the ticket + ReceiptStrip
- **Change**: CallBoard computes `fillEstimate` per side from the same `depth` the Book drawer uses; each ticket side shows `fillCopy` (est. fill, avg odds, unfilled remainder) with a `Use max N tUSDC` linklike action that floors the ceiling to 2dp into the stake input. New `ReceiptStrip` drawer: App records a `CallReceipt` per successful Call (capped 8, session-only), rows join `historyQ` by `marketId` to flip OPEN → UP/DOWN/VOID and swap Share → Share settled receipt (oracle link when the indexer has the question id). `shareText` prefers `navigator.share`, falls back to clipboard, flashes the outcome.
- **Reasoning**: Sizing without executability hid thin books until sign-time; "Use max" makes the ceiling a one-tap decision. Receipts turn every trade into shareable dreamDEX proof with no backend — and only witnessed Calls appear, so a receipt can never overstate history.
- **Rejected alternative(s)**: Preview from the SDK stake quote (single number, watch-dependent). Persisting receipts to localStorage (would imply history we did not witness). A share-image generator (canvas weight; text receipts share everywhere).
- **Task/session**: Product-innovation pass — W-058/W-059.

### 2026-08-28 — Injectable terminal + question-first board
- **Change**: `App` takes `{ exchange = somniaExchange }` — every query and write goes through the prop. New `hooks.ts` (`useNow`, `useBanner`, `usePulseSamples`). Claim queries/execute dropped venue scoping (multi-venue). New effect: when the selected series has no Trading Window, `autoSeries` retargets the chip (one attempt per target via `autoTried` ref). CallBoard board section is now one question — "Will {asset} close above {Line}?" — with the lock clock, then implied/volume/trades meta; the stake input moved inside the ticket (`ticket-stake`) and each side shows explicit `Risk X → Win Y tUSDC · N contracts`. `App.integration.test.tsx` renders the full terminal against `createFakeExchange` under happy-dom + a wagmi `mock` connector (Line, odds, chip, disabled Call gate, indexer-live dot).
- **Reasoning**: The adapter seam existed but App hard-bound the live one, so the UI had no deterministic test. The board answered "what are the numbers?" before "what am I deciding?" — the question is the product. Risk→Win at the button is the sentence a consumer signs.
- **Rejected alternative(s)**: Extracting a `useTerminalQueries` mega-hook (a params-object abstraction, not a module). Rendering App against mocked wagmi internals (fake adapter through the real App is the honest path). Keeping the three-number board row (Line/clock/implied competed instead of composing).
- **Task/session**: Brutal-overhaul session — W-052, W-055–W-057.

### 2026-08-28 — Claim session Windows + tUSDC
- **Change**: App keys Claim primary on `previewClaimSession().windows` and `payout`. Toast uses `claimReceiptCopy`. Tote label is `totePrimaryCopy` → `claimSessionCopy` (not "Claim winnings").
- **Reasoning**: Intent count called a void two Claims. Judges need Windows of collateral, not "outcome balances".
- **Rejected alternative(s)**: Leaving the ghost "Claim finalized" as the only copy. Showing raw `count` on the button.
- **Task/session**: Loop tick 30 — W-047.

### 2026-08-28 — shorten short hashes
- **Change**: `shorten` returns the input when length < 12, `—` when empty. Full addresses still `0x1234…5678`.
- **Reasoning**: PRD #38. Fake `"0xfake"` and a truncated toast hash were rendering as `0xabc…xabc`.
- **Rejected alternative(s)**: Always slicing (doubles short strings). Hiding short hashes entirely.
- **Task/session**: Loop tick 29 — W-046.

### 2026-08-28 — Crash notice Retry
- **Change**: `ErrorBoundary` renders `crashNotice` plus a Retry button that `setState({ error: null })`. Copy is first line only.
- **Reasoning**: PRD #50. Board notice already has Retry for indexer errors; a render crash only said "Refresh".
- **Rejected alternative(s)**: Dumping `error.stack`. A full `location.reload()` (drops in-memory Pulse samples for no reason).
- **Task/session**: Loop tick 28 — W-045.

### 2026-08-28 — Clock hours on 1h+ Windows
- **Change**: `countdown` prints `Nh MM:SS` when remaining ≥ 3600s. Sub-hour stays `MM:SS`. Clock type size stepped down so `24h 00:00` fits.
- **Reasoning**: Cadence labels already say 24h; the clock still printed 1440:00. That reads as a bug on the 4h/24h chips.
- **Rejected alternative(s)**: `H:MM:SS` (looks like wall-clock time). Always showing hours (noisy on 5m/15m).
- **Task/session**: Loop tick 26 — W-043.

### 2026-08-28 — Hash routes exact path
- **Change**: `parseRoute` matches `/app` and `/docs` (plus a trailing slash), not `startsWith("#/app")`. `#/apps` is landing. Query strings stripped. Tests in `router.test.ts`.
- **Reasoning**: The terminal is `#/app`. A prefix match would mount wagmi + SDK on any hash that begins `#/app`.
- **Rejected alternative(s)**: react-router. Treating `#/documentation` as the bug (that string does not start with `#/docs`).
- **Task/session**: Loop tick 25 — W-042.

### 2026-08-28 — Pulse ready + marketId tape
- **Change**: Pulse empty-state uses `pulseReady`. `["mtape", marketId]` not pool.
- **Reasoning**: Series history bars were hidden until two spark samples. Pools recycle.
- **Rejected alternative(s)**: Showing "Collecting ticks…" until the price watch lands. Keying tape by pool.
- **Task/session**: Loop ticks 23–24 — W-041.

### 2026-08-28 — Three pages + Pulse
- **Change**: New `Landing.tsx` (`#/`): full-bleed hero — serif headline "Up or down. On-chain. Every 15 minutes.", one sentence, two CTAs, dominant SVG line-drawing of the terminal (drawn price path, Line label, clock, outcome bars) with stroke-dash draw animation; sections below are one-job text blocks with IntersectionObserver reveals, no cards. New `Docs.tsx` (`#/docs`): sticky TOC (scrollIntoView buttons — hash anchors would fight the router), text-led sections. New `kit.tsx`: shadcn-minimal Button/Badge/Reveal. New `router.ts` (see src/AGENTS.md). New `Pulse.tsx` drawer in the app: BTC/ETH price sparkline (SDK `watchPrice`/`getLivePrice`, 2s read), implied-Up sparkline (samples from the board, 1/s, capped 120), last-12 outcome bars from series history, and a public tape from `listMarketFills` (aggressor-colored, explorer-linked). App resets both sample buffers on series change.
- **Reasoning**: Judging loves a real product site + visible market data. Charts are pure SVG from `domain/chart.ts` folds — no chart library, no new deps. Docs TOC uses buttons because `#anchor` hrefs would route back to landing under the hash router.
- **Rejected alternative(s)**: react-router (dep + static-host config). A chart library (weight; two sparklines + bars don't need it). Hash-anchor TOC (router conflict). New class names in App/CallBoard (concurrent-loop merge risk).
- **Task/session**: Three-page redesign session.

### 2026-08-28 — Cancel explorer toast
- **Change**: `cancelTicket` sets banner `txHash` from `cancelOpenTicket`. Copy unchanged.
- **Reasoning**: Rest quote and leftover rests already listed Open tickets; the toast was the only write without Explorer proof.
- **Rejected alternative(s)**: Linking only after the fill tape (cancels are not fills). A second toast per cancel.
- **Task/session**: Loop tick 22 — W-040.

### 2026-08-28 — Line on history chips
- **Change**: Chip `<small>` is time · Line when `historyLine(row.openingPrice)` is set.
- **Reasoning**: PRD #35. Opening prices were already on the row from `getOpeningPrices`.
- **Rejected alternative(s)**: A second row of chips. Showing Line only on hover (demo is glanceable).
- **Task/session**: Loop tick 21 — W-039.

### 2026-08-28 — History chip oracle links
- **Change**: Settled chips with `oracleQuestionId` render as `oracleReceipt` anchors. Missing ids stay `<span>` (older indexer rows).
- **Reasoning**: PRD #34 is the settled Window, not only the live successor.
- **Rejected alternative(s)**: One oracle link for the whole strip (hides which Window). Opening the live Window's question for every chip.
- **Task/session**: Loop tick 20 — W-038.

### 2026-08-28 — Claim and faucet explorer toasts
- **Change**: `claimAll` sets `txHash` from `ClaimReceipt`. Faucet `onSuccess` uses `mintTestCollateral`'s hash.
- **Reasoning**: Call/Exit/approve already linked; Claim and mint did not.
- **Rejected alternative(s)**: A second toast per redeem.
- **Task/session**: Loop ticks 18–19 — W-037.

### 2026-08-28 — Light theme redesign ("paper ledger")
- **Change**: `styles.css` fully rewritten to a Claude-adjacent light theme: oat paper `#faf7f0`, white cards with soft shadows and 10–16px radii, ink text, clay accent `#c0563b` (replaces amber), viridian Up / crimson Down with soft tint fills. Typography: Lora serif for the wordmark, Line, Implied, and ticket odds; Schibsted Grotesk for UI; IBM Plex Mono stays for the clock, tape, and stake (tabular so the ticking clock cannot jitter). Series chips became pills; history chips became tinted mini-cards; the board + ticket are elevated white cards so the eye runs wordmark → clock (biggest element) → odds → Call buttons → tape. `index.html` swaps theme-color/favicon to the light palette and adds Lora. Every selector name kept — JSX untouched.
- **Reasoning**: Judging weights UX 20% + presentation 15%; the dark tote board read as engineering-first. Light editorial paper with one huge clay clock is minimal, eye-leading, and still distinctive. CSS-only rewrite means zero behavior risk to the W-028–W-036 feature surface (phases, claim primary, rest, notices all re-styled through their existing classes).
- **Rejected alternative(s)**: Styling JSX with new class names (concurrent-loop merge risk + churn). Keeping dark mode via `prefers-color-scheme` (doubles surface, no judge asks for it). Proportional serif digits for the clock (width jitter every second).
- **Task/session**: Light-theme redesign session.

### 2026-08-28 — Series P&L + Board notice
- **Change**: CallBoard `seriesPnl` on the history strip. App uses `boardNotice` for one banner; Retry refetches Windows; Mint tUSDC runs the faucet. Dropped stacked thin-book / loading / none-live banners.
- **Reasoning**: Selected-chip money belongs next to Series record, not in the wallet mast. Notices need a button, not three paragraphs.
- **Rejected alternative(s)**: Putting series P&L in WalletBar (that line is wallet-wide). Keeping load errors in the toast stack as well as the notice.
- **Task/session**: Loop ticks 16–17 — W-035, W-036.

### 2026-08-28 — Rest quote in the Book drawer
- **Change**: `BookDrawer` Rest Up/Down when `canRest`. App `prepareRest` / `executeRest`. Toast + open-ticket refetch. Call Up/Down stay IOC.
- **Reasoning**: PRD #46 "out of the default path". The drawer is already the power-user surface; Open tickets list the rest.
- **Rejected alternative(s)**: A toggle on the Call ticket. Resting when the Window is locking (`canCall` is false).
- **Task/session**: Loop tick 15 — W-034.

### 2026-08-28 — Explorer proof on toasts
- **Change**: Banner may carry `txHash`. Call/Exit set it from `executeCall`/`executeExit`. Approve success uses the wagmi hash. Toast renders `explorerTx` + `shorten`.
- **Reasoning**: Address and fill tape already linked; the write toast did not. Indexer fills lag the receipt.
- **Rejected alternative(s)**: Only linking from PnlStrip. Baking the explorer host into the toast string.
- **Task/session**: Loop tick 14 — W-033.

### 2026-08-28 — Claim as tote primary
- **Change**: App polls `previewClaimSession` (60s). Primary chrome uses `totePrimary` / `totePrimaryCopy`. Claim due → amber `primary` button, duplicate ghost Claim hidden. `onPrimary` runs Claim all.
- **Reasoning**: After resolve the successor is often already Trading; Call Up/Down were the only loud buttons.
- **Rejected alternative(s)**: Disabling Call while Claim is due (PRD #41 wants the next Window). Polling the 40-row scan every 8s (too heavy).
- **Task/session**: Loop tick 13 — W-032.

### 2026-08-28 — Exact-stake approve
- **Change**: Approve writes `approveAmount(board.stakeRaw)` and errors if that is 0 instead of falling back to 10_000 tUSDC.
- **Reasoning**: Allowance should match this Call. The fallback was a landmine even if the gate usually implies stake > 0.
- **Rejected alternative(s)**: Keeping the 10k fallback "for convenience".
- **Task/session**: Loop tick 12 — W-031.

### 2026-08-28 — Cadence label + wait copy
- **Change**: CallBoard Window meta uses `cadenceLabel`. App passes `board.phase` into `gateLabel`. PnlStrip tape/positions use the same label.
- **Reasoning**: 24h series looked like 1440m. After lock the primary still said "Window not callable" even though phase copy existed.
- **Rejected alternative(s)**: Hardcoding chip labels in the meta line (those are BTC/ETH + cadence, not the live row's snapped interval).
- **Task/session**: Loop tick 11 — W-030.

### 2026-08-28 — Locked waiting state
- **Change**: Clock kicker also names Settling. Phase copy already covered Locked/Settling; the feed change is what makes those rows appear after expiry.
- **Reasoning**: PRD #28 waiting state. Successor still takes the board once listed.
- **Rejected alternative(s)**: A second waiting screen. Keeping the expired row after the successor is live.
- **Task/session**: Loop tick 10 — W-029.

### 2026-08-28 — Window phase on the tote
- **Change**: CallBoard clock kicker is Locks in / Locking / Locked from `board.phase`. Window meta appends `windowPhaseCopy`. Urgency styling also fires on Locking/Locked, not only the last 60s.
- **Reasoning**: The board read model already had `too-close`; the tote still said "None live" because `pickWindow` required headroom.
- **Rejected alternative(s)**: A separate waiting screen. Leaving Calls enabled until on-chain Locked (race with headroom).
- **Task/session**: Loop tick 9 — W-028.

## Earlier history (condensed)
Homepage is a Call slip (`WalletBar` + `CallBoard`), not a CLOB. App prepares Calls via `prepareCall`/`executeCall`; one marketId watch feeds Book drawer depth. Stake quote queries sit before `readBoard` so a cold watch does not disable Call. History strip got Series record, then Settle preview + cached venue fee, then Wallet P&L (`PnlStrip`). Demo-hardening: toasts vs inline board state, indexer dot, shimmer Line/Implied, ErrorBoundary. QueryFns throw instead of `liveHint!`; Call/Exit capture `live` before await.

## Known Gotchas
Each onchain button has its own busy flag. Approve uses two-phase pending (hash wait + 4s cooldown). Never import `.env` keys here. Do not pin venue from the first BTC row — 15m+ live on a second venue.
