# AGENTS.md — src/ui

## Ownership
Window consumer UI.

## Purpose
Tote-board homepage split: `WalletBar` (account chrome + Wallet P&L one-liner), `CallBoard` (series, Line, ticket, Book drawer, Series record + history, tickets, Claim), and `PnlStrip` (collapsed fill tape + per-market open P&L). `App` owns wallet writes, queries, Stake quote refetch, venue fee cache, and fill/position P&L refetch.

## What This Controls
If pending states or WalletGate are wrong, users double-submit or Call on the wrong chain. If Call session is bypassed, a just-Locked Window can still be sent. If the board is bypassed, implied odds and the gate can disagree.

## Connections
- Depends on: `src/domain/*` (`readBoard`, `readBookDepth`, `readSeriesRecord`, `settlePreview`, `pnlCopy` / `sessionTape` / `seriesPnlCopy`, `totePrimary`, `boardNotice`), `src/exchange/somnia.ts`, `src/ui/useLiveOdds.ts`, `src/ui/format.ts`, `src/chain/*`, wagmi, react-query, `@somnia-chain/markets-sdk/react`
- Depended on by: `src/main.tsx`
- External systems touched: injected wallet, Shannon, SDK live tail

## Current State
MVP UI. Odds prefer `useLiveBinaryOrderBookByMarket` (recycle-safe) and fall back to 4s poll. Call size prefers `quoteStake` when the live book can fill; otherwise the top-of-book plan. Book drawer is collapsed Up depth from the same watch. History strip shows Series record copy above chips. Live holdings show Settle preview with cached venue settlement fee. Connected wallets show Wallet P&L in the mast and a collapsed PnlStrip tape. A locking Window stays on the board (clock kicker Locking, phase copy, Calls disabled, Exit still shown). A just-expired Locked/Settling row stays until the successor lists (clock kicker Locked/Settling, countdown 00:00). Cadence on the tote and tape uses `cadenceLabel`; the wait primary repeats Window phase copy. tUSDC approve is exactly the stake (`approveAmount`); a zero stake does not send a 10k fallback. When Claim session preview count is > 0, the amber primary is Claim winnings (`totePrimary`); the ghost Claim row is hidden so there is one Claim control. Call / Exit / approve toasts link Shannon explorer when a tx hash is known (`explorerTx` + `shorten`). Book drawer Rest Up/Down (post-only) shows only when WalletGate can Call. History strip shows Series P&L above the Series record. One Board notice replaces stacked empty/error/thin-book banners.

## Decision Log

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

### 2026-08-28 — Demo-hardening UX pass
- **Change**: Action banners + indexer load error moved to fixed bottom-right toasts (ok toasts auto-dismiss 5s, errors persist); board-level states (thin book, no-window, loading) stay inline. Mast gained an indexer status dot (`windowsQ.isSuccess`). Line/Implied show shimmer skeletons while booting; clock turns red + pulses under 60s to lock; odds/Line re-tick via `key`-change remount. `ErrorBoundary` in `main.tsx` keeps a render crash from blanking the terminal. `settlePreviewCopy` takes `feeBps` and appends venue-fee copy when > 0 (testnet fee is 0, so silent by design).
- **Reasoning**: Judging is 20% UX + 15% presentation — the tote-board identity stays; this pass adds feedback states (loading/live/urgent) it lacked. Toasts separate action results from ambient board status so a 5s success toast cannot erase a "no live Window" warning.
- **Rejected alternative(s)**: A toast library (weight; four call sites). Redesigning the palette (identity already distinctive). Auto-dismissing errors (user must see why a Call failed).
- **Task/session**: Hackathon hardening session.

### 2026-08-28 — App query hardening
- **Change**: All `queryFn`s throw a typed "No live Window" error instead of `liveHint!` non-null assertions; `callSide`/`exitSide` capture `live`/`holdings` into locals before `await` (stale-closure fix); Call/Exit chain `posQ.refetch().then(invalidate fills/pnl)`; Claim invalidates pnl. `format.ts` caches `Intl.NumberFormat` per digit-count.
- **Reasoning**: Non-null assertions lie when `enabled` races a refetch; a Window can roll mid-`await` and the old code would size the Exit against the successor.
- **Rejected alternative(s)**: `useQuery` select-based gating (no win). A React context for `live` (closure capture is simpler and testable by inspection).
- **Task/session**: Hackathon hardening session.

### 2026-08-28 — Wallet P&L UI
- **Change**: App queries `listFills` / `listPositionPnl` every 15s when an address is connected. `WalletBar` shows `pnlCopy`. `PnlStrip` is a collapsed drawer (like Book drawer) with per-market open P&L and explorer-linked tape. Call/Exit/Claim invalidate those query keys.
- **Reasoning**: Series record is Up/Down/Void counts, not money. Wallet P&L is wallet-scoped, so it must not live on the Call ticket (that would look like this Window's tape).
- **Rejected alternative(s)**: Rendering the all-fills tape on `CallBoard`. Domain calling `computeOpenPositionsPnL` (ADR-0003; that fold still groups fills by pool).
- **Task/session**: Loop tick 8 — W-027.

### 2026-08-28 — Venue fee on Settle preview
- **Change**: App queries `settlementFeeBps` keyed by marketId with 5-minute staleTime and passes `feeBps` into CallBoard / `settlePreview`.
- **Reasoning**: Fees are frozen at creation — no 4s poll. Loading/error leaves fee undefined so preview stays 0 until the row lands.
- **Rejected alternative(s)**: `useMarketFees` in the banner (no fake adapter). Refetching fees with the book.
- **Task/session**: Loop tick 7 — W-026.

### 2026-08-28 — Settle preview on the Call banner
- **Change**: CallBoard shows `settlePreviewCopy` under "Your call this Window" when holdings are non-zero.
- **Reasoning**: Contracts alone do not say what Claim pays (Void is half, winner may skim a fee).
- **Rejected alternative(s)**: Fetching venue `settlementFeeBps` this tick (preview stays 0 bps until that adapter work).
- **Task/session**: Loop tick 6 — W-025.

### 2026-08-28 — Series record on the strip
- **Change**: CallBoard renders `seriesRecordCopy(readSeriesRecord(history))` above the chips.
- **Reasoning**: Rolling 15m Windows need a scoreboard (PRD #36) without inventing tUSDC P&L from missing fills.
- **Rejected alternative(s)**: Computing the tally in JSX. Fetching `getUserFills` this tick (adapter work, different product).
- **Task/session**: Loop tick 5 — W-024.

### 2026-08-28 — Book drawer UI
- **Change**: `useLiveOdds` returns `{ book, depth }` from one marketId watch. `BookDrawer` is a collapsed `<details>` ladder under the Call ticket.
- **Reasoning**: Two hooks would double-subscribe. A drawer keeps the homepage a Call slip (PRD #45) instead of a blotter.
- **Rejected alternative(s)**: Always-open depth. A second `useLiveBinaryOrderBookByMarket` call. Showing Down as a separate book.
- **Task/session**: Loop tick 4 — W-014.

### 2026-08-28 — Stake quote queries
- **Change**: App computes `quoteStakeRaw` before `readBoard` and refetches Up/Down quotes every 4s. Passes a quote object only when the query has data; null/loading falls back to the book plan.
- **Reasoning**: Stake raw must not be circular with the board. A cold `quoteBinaryStake` (no watch snapshot yet) must not disable Call.
- **Rejected alternative(s)**: Waiting on quote success before enabling the ticket. Passing `null` through as `prepareQuotedCall` skip (that is below-lot, not "use the book").
- **Task/session**: Loop tick 3 — W-022.

### 2026-08-28 — WalletBar vs CallBoard
- **Change**: Split `App.tsx` into `WalletBar` and `CallBoard`. App feeds `readBoard` and keeps wagmi/query mutations.
- **Reasoning**: One UI module owned both chrome and the ticket. Board flags (`thinBook`, `shortCollateral`) now have a test seam.
- **Rejected alternative(s)**: A React hook that still mixed wallet pending flags into domain (untestable without wagmi).
- **Task/session**: Loop tick 2.

### 2026-08-28 — Call session + live book + history
- **Change**: App prepares Calls through `prepareCall`/`executeCall`. Open tickets via `fetchOpenOrders`/`cancelOrder`. Series history via `listPastBinaryMarkets`. `SomniaMarketsProvider` in `main.tsx`.
- **Reasoning**: SDK README: React hooks subscribe to the live store; `getLiveBinaryOrderBookByMarket` must be used when holding a marketId.
- **Rejected alternative(s)**: Sizing only from a single ask with no watch (stale odds). Keying the live book on pool (successor Window leaks).
- **Task/session**: Prod iteration after ExchangePort seam.

### 2026-08-28 — Call slip, not CLOB
- **Change**: Split Up/Down ticket, four-state primary action, IOC only.
- **Reasoning**: Product brief; gotcha #4 leftover limit rests with escrow.
- **Rejected alternative(s)**: Full order-book homepage (clones dreamDEX).
- **Task/session**: Initial Window build.

## Known Gotchas
Each onchain button has its own busy flag. Approve uses two-phase pending (hash wait + 4s cooldown). Never import `.env` keys here. Do not pin venue from the first BTC row — 15m+ live on a second venue.
