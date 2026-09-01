# AGENTS.md — src/ui

## Ownership
Window consumer UI.

## Purpose
Tote-board homepage split: `WalletBar`, `CallBoard`, `Pulse`, and `PnlStrip` on `#/app`. `#/` is `Landing`, `#/docs` is `Docs`. `App` owns wallet writes, queries, Stake quote refetch, venue fee cache, and fill/position P&L refetch.

## What This Controls
If pending states or WalletGate are wrong, users double-submit or Call on the wrong chain. If Call session is bypassed, a just-Locked Window can still be sent. If the board is bypassed, implied odds and the gate can disagree. If `parseRoute` matches prefixes, `#/apps` mounts wagmi and the SDK on a non-terminal hash. If ErrorBoundary has no Retry, a render crash forces a full refresh. If docs replay routing drifts, the judge-facing CTA lands above the proof tool instead of at it.

## Connections
- Depends on: `src/domain/*` (`readBoard`, `readBookDepth`, `readSeriesRecord`, `settlePreview`, `pnlCopy` / `sessionTape` / `seriesPnlCopy`, `totePrimary`, `claimReceiptCopy`, `boardNotice`, `crashNotice`, `pulseReady`), `src/exchange/somnia.ts`, `src/ui/useLiveOdds.ts`, `src/ui/format.ts`, `src/ui/router.ts`, `src/chain/*`, wagmi, react-query, `@somnia-chain/markets-sdk/react`
- Depended on by: `src/main.tsx`
- External systems touched: injected wallet, Shannon, SDK live tail

## Current State
Winner-pass UI. `#/` leads with the group-chat problem and two-fill proof visual; its verification CTA opens the `#/docs` replay directly. `#/docs` contains current product truth, a replay TOC control, and a fail-closed replay with query prefill; `#/app` keeps the Window, ticket, one guided action, challenge/result, and Claim above one collapsed More drawer. Incoming challenges own the only accept CTA. A verified accept updates the URL with its exact tx and shows **Share verified duel**; without that tx, unrelated book activity cannot open the Duel. Odds use the recycle-safe live hook with a polled fallback. Wallet writes remain serialized, receipts require tape verification, proof-read errors are visible, and responsive/reduced-motion behavior is covered by the existing visual system. Scroll reveals fail open when IntersectionObserver is unavailable.

## Decision Log

### 2026-09-01 — Direct judge replay route and fail-open reveals
- **Change**: `Landing.tsx` sends **Verify a duel** to `#/docs?replay=1`; `Docs.tsx` scrolls that intent (and complete `m`/`a`/`b` proof links) to the replay tool and exposes **Judge replay** in the TOC; `kit.tsx` reveals content immediately when IntersectionObserver is unavailable.
- **Reasoning**: Verification is the judge-facing differentiator, so its CTA must not strand a user at the top of a long page. Reveal animation is decoration and must never make product evidence unavailable.
- **Rejected alternative(s)**: A second URL fragment cannot coexist cleanly with the app's hash router. A separate replay route adds navigation and maintenance for one embedded tool. Keeping hidden content when the animation API is missing makes progressive enhancement backwards.
- **Task/session**: Final docs/frontend release pass.

### 2026-09-01 — Winner pass: Duel-first story, exact completed link, and fail-closed demo UX
- **Change**: `Landing.tsx` and `styles.css` now lead with “Make the Call. Prove who won.”, a two-wallet/two-fill proof illustration, group-chat problem, and three-beat consumer flow. `App.tsx` uses Finalized `marketById` results and exact pool-tape legs; after an opposite Call verifies it publishes `&a=<acceptTx>` and renders a generic `ChallengeStrip` as **Share verified duel**. Incoming challenges have one prerequisite-aware CTA and hide duplicate ticket actions; own challenges stay disabled. `Replay.tsx` removed editable outcome, supports `?m=&a=&b=` prefill, and refuses incomplete/conflicting evidence. `router.ts` returns null for malformed percent-encoded params instead of crashing before refusal. `Docs.tsx`, title metadata, and integration tests match this story.
- **Reasoning**: The earlier terminal led with infrastructure and could falsely pair an unrelated opposite fill in a busy market. A judge now sees the problem, action, and independent proof quickly; every portable result names both exact transactions and reads settlement itself.
- **Rejected alternative(s)**: Chronological opponent inference; manual outcome input; duplicate accept/trade controls; fake demo data; a custom escrow or leaderboard; refactoring the large App during the scoring pass without user-visible value.
- **Task/session**: Adversarial winner-readiness build — W-075, W-077–W-083, W-085.

### 2026-08-31 — UX pass: challenge strip, Duel-first layout, More drawer, simpler ticket
- **Change**: New `ChallengeStrip.tsx` (`ChallengeStrip` + `ChallengeGate`) — after this session's verified fill the live `#/app?d=…` renders as a real `<a href>` (open / long-press / browser-share) with a secondary Copy that writes exactly `${origin}${path}#/app?d=…` and flashes "Link copied". `ReceiptStrip` lost its challenge CTA and `address`/`now` props (receipts list only). `App` render order is now: mast (USP sentence + one short opponents line) → `Duel` (when `?d=`; first body block, before chips) → `CallBoard` (chips, question/ring/Implied meta, Rematch, ticket, one-action onboarding) → challenge strip → Claim (when due) → **one collapsed `More` drawer** (Market: volume/trades/health + BookDrawer/Rest; Position: holdings + settle preview + Exit; resting orders; series history; Receipts; Pulse; PnlStrip; utilities) → toasts/notice → one-line footer. `CallBoard` rewritten around that: `subordinate` demotes the question to h2 when the Duel stage owns the h1, `onlySide` hides the same-side Call on an incoming challenge (the Duel stage's `Call {opposite} to accept challenge`, `autoFocus`, is the one primary), and the ticket keeps only stake + presets + Risk→Win + Calls — fill-estimate essays, "Use max", the executable-preview line, and risk-line fallback copy are gone (disabled reasons live on `title` only). Duel stage headings are h1 (`Challenge` / `Duel` / `Result`) with one short "Opponents are not counterparties" line on the challenge view; the dual-note essay and "solo Call still works" small-print are deleted. Footer is one line. CSS: `.challenge-strip`, `.duel-h`, `.usp`/`.usp-note`, `.drawer.more`, `.more-section` on existing tokens.
- **Reasoning**: A judge could not find the USP — the challenge link was clipboard-only inside a collapsed Receipts drawer, and the incoming duel mounted below history/book/onboarding chrome. The strip is now the URL itself (real anchor; copy is secondary and copies only the URL), the challenged wallet sees the challenge first with exactly one accept control, and the default screen is USP + Window + two Calls with everything else in one drawer.
- **Rejected alternative(s)**: Keeping the CTA in Receipts (collapsed = invisible); sharing a composed paragraph (clipboard must be the bare URL); keeping both Call buttons on an incoming challenge (same-side must not look acceptable); deleting Book/Pulse/P&L/Exit (spec: demote, not gut — they moved to More).
- **Task/session**: Window Duel UX-only pass — items 1–9.


### 2026-08-31 — Duel surfaces: tape-verified receipts, incoming challenge, judge replay, Rematch rename
- **Change**: `App.tsx` — `callSide` reads the wallet tape back after every IOC (`filledCall`) and builds the receipt, lastCall, and banner from verified numbers only; zero/unknown fill → honest error copy, no receipt, no roll, no challenge. Open tickets query the whole wallet order book and filter with `windowTickets` (Down rests visible). Duel wiring: `useHashParam("d")` + `decodeChallengeLink` hint, one-shot pin effect retargets asset/cadence to the challenged Window, `duelStatusQ` (onchainStatus) + `duelTapeQ` (`fillsByPool`) feed `readDuel`; accept button = the guarded `callSide(opposite)`; panel renders above PnlStrip. `router.ts` gains `hashParam` + `useHashParam` (query after hash, hashchange-live). `ReceiptStrip.tsx` gains the per-receipt **Challenge a wallet** CTA (only with a connected wallet, a fill hash, and an unexpired Window; copies/shares `#/app?d=…`). New `Duel.tsx` (challenge/open/settled/void/expired/invalid render, opponents-≠-counterparties sentence, both explorer txs, Line, unequal stakes) and `Replay.tsx` (judge replay form: marketId + two txs + pinned outcome → `replayDuel`, fail-closed copy) mounted in `Docs.tsx` under "Judge replay" with the DEMO-hole note. `CallBoard.tsx` roll kicker → Rematch; ticket preview copy is side-symmetric. Landing hero/docs title/footer/wordmark lead with the duel sentence; solo Call stays.
- **Reasoning**: Every success state must come from a verified fill or settlement, so the App's post-write path is tape-read-first and the duel state is derived (memo) from chain reads — it flips open only when the acceptor's fill lands on the pool tape, never on tx submit. The pin effect is once-per-marketId so it cannot fight `autoSeries` or user chip switches. Duel proofs read the pool tape, not the wallet tape, because the real adapter's portfolio fills carry no marketId (see src/exchange/AGENTS.md 2026-08-31).
- **Rejected alternative(s)**: Optimistic open-on-submit (spec forbids); hiding the solo Call buttons under a challenge link (solo must keep working); a second toast/badge system for duels (the Duel panel is the one surface); seeding duel state from the URL payload (hint only — chain wins).
- **Task/session**: Window Duel identity pass — items 1–3, 6–9, 11–12 UI.

### 2026-08-31 — Finalized-window duels, viewer-agnostic result, duel/replay styles
- **Change**: `App.tsx` — when the challenged market is not in `listLiveWindows` (Finalized rows leave it), `duelMarketQ` resolves it via `marketById` so an expired/settled challenge link renders its real state instead of "not on this chain"; settlement now reads a duel-scoped history query keyed by the challenged Window's own asset/cadence/venue (not the selected series); the acceptor fill falls back to "any other wallet on the opposite side" (`tapeDuelFill` `notTaker`) so the result view renders for any viewer, connected or not; the DuelWindow passed to `readDuel` maps `openingPrice` → `line` (the panel printed "Line —" otherwise). `Duel.tsx` `dule-line` typo → `duel-line`; `styles.css` adds `.duel*` and `.replay*` blocks on the existing token set.
- **Reasoning**: Three bugs found while verifying the done-criteria: challenge links outlive their Window's presence in the live list; settlement keyed to the selected series misses pinned-but-unselected markets; and a result view that required the acceptor to be the connected wallet was not a judge's view.
- **Rejected alternative(s)**: Rendering expired/settled states from the URL payload (hint only); keying settlement off the selected series with a pin-effect race; restricting the result view to connected participants.
- **Task/session**: Window Duel close-out verification pass.


### 2026-08-30 — Instrument restyle + health/hot/roll/presets wiring
- **Change**: styles.css token values swapped in place (names unchanged): cool bone `#f3f4f0` ground over a faint graph-paper grid, signal orange `--clay #d9480f`, `--serif` deleted (Lora dropped from the Google Fonts link; headings Schibsted, numerals IBM Plex Mono). CallBoard gains **LockRing** — the countdown as an SVG ring whose stroke-dashoffset arc is `(expiry − now) / intervalSec`, red + pulse when urgent. Question is mono with the Line number on a dashed price-axis underline. New UI: Book meta cell (`marketHealth` grade + `healthDetail`), stake presets 5/10/25, cadence `best` badge (`hottestCadence`, kit ToggleGroup `hot` state), **roll banner** (`rollPrompt`; `onRoll` → the guarded `callSide`, gated side-aware on the plan for `lastCall.side`; "Not now" dismisses per-marketId). Landing + Docs call `warmExchange()` on mount. Dead CSS removed (~60 lines: `.line-row`, `.big`, `.clock .big`, `.series`, `.stake`, `.actions .primary`).
- **Reasoning**: The paper-ledger palette was one of three generic AI palettes; the identity now could only be this market (interval ring, Line-on-axis, tabular instrument numerals). The ring is the one deliberate aesthetic risk. Roll banner exists because a real session-key roll bot is not shippable through the SDK (SDK-FEEDBACK #9) — this is the honest consumer subset: one press, wallet signs.
- **Rejected alternative(s)**: Dark-plus-acid-green or another broadsheet (named off-brief in the hackathon pass). Ring in kit.tsx (single consumer, board-specific). Gating roll on `upPlan.ok` (offered a Down roll the ticket would reject). New token names (would churn every selector for zero behavior).
- **Task/session**: Hackathon enhancement pass — W-060/W-061/W-062/Roll/restyle.

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
