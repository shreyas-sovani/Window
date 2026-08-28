# AGENTS.md — docs

## Ownership
Plan, PRD, backlog, ADRs, hackathon brief.

## Purpose
Product and architecture source of truth besides CONTEXT.md.

## What This Controls
Agents that skip this will rebuild a CLOB clone or add Solidity.

## Connections
- Depends on: GitBook MCP + published dreamDEX/Somnia docs
- Depended on by: entire repo
- External systems touched: none

## Current State
PRD is `needs-triage` locally (no hosted tracker). Series P&L and Board notice are done (W-035, W-036). SDK-FEEDBACK has 8 items. Default Call stays IOC.

## Decision Log

### 2026-08-28 — Series P&L + Board notice (W-035, W-036)
- **Change**: BACKLOG W-035 and W-036 done. CONTEXT gained Series P&L and Board notice.
- **Reasoning**: PRD #36 (rolling 15m as one product) and #50 (empty/error with a next action).
- **Rejected alternative(s)**: Mixing Series P&L into Series record. Leaving stacked banners.
- **Task/session**: 15m prod loop ticks 16–17.

### 2026-08-28 — Rest quote (W-034)
- **Change**: BACKLOG W-034 done. CONTEXT gained Rest quote. SDK-FEEDBACK item 8 notes Rest still cannot set unified expiry.
- **Reasoning**: PRD #46. Resting is a power-user Book drawer action; Call Up/Down remain IOC takes.
- **Rejected alternative(s)**: Post-only on the default Call path. `trader.placeOrder` just to set expiry (ADR-0002).
- **Task/session**: 15m prod loop tick 15.

### 2026-08-28 — Explorer proof (W-033)
- **Change**: BACKLOG W-033 done. CONTEXT gained Explorer proof.
- **Reasoning**: PRD #37 — prove the Call on Shannon explorer from the toast, not only after the fill indexer updates.
- **Rejected alternative(s)**: Domain knowing the explorer host.
- **Task/session**: 15m prod loop tick 14.

### 2026-08-28 — Claim primary (W-032)
- **Change**: BACKLOG W-032 done. CONTEXT gained Claim primary.
- **Reasoning**: PRD #29 vs #41 — successor Trading must not hide Claim.
- **Rejected alternative(s)**: Holding the board on the resolved Window until Claim.
- **Task/session**: 15m prod loop tick 13.

### 2026-08-28 — Bounded approve (W-031)
- **Change**: BACKLOG W-031 done. CONTEXT gained Stake allowance. SDK-FEEDBACK item 8: unified `createOrder` has no `expireTimestampNs`.
- **Reasoning**: PRD #49. Domain `expireTimestampNs` cannot be passed through the unified helper; IOC default path does not rest, so that is documented rather than faked.
- **Rejected alternative(s)**: Calling `trader.placeOrder` just to set expiry (ADR-0002 keeps unified IOC `createOrder`). Approving 10k "once".
- **Task/session**: 15m prod loop tick 12.

### 2026-08-28 — Cadence labels (W-030)
- **Change**: BACKLOG W-030 done. CONTEXT Cadence now requires `cadenceLabel`. Wait primary uses Window phase copy.
- **Reasoning**: Tote and tape were inventing "Nm" from raw seconds. Wait-gate copy lagged the board phase.
- **Rejected alternative(s)**: A days unit for 86400 (product chips say 24h).
- **Task/session**: 15m prod loop tick 11.

### 2026-08-28 — Locked wait row (W-029)
- **Change**: BACKLOG W-029 done. CONTEXT Window phase now falls back to a just-expired Locked/Settling row for one cadence. Adapter merges `listPastBinaryMarkets` Locked/Settling because `loadMarkets` drops inactive binaries.
- **Reasoning**: After expiry the tote went blank until the next Window listed.
- **Rejected alternative(s)**: `listLiveBinaryMarkets` only (that query is `expiry > now`). Showing Finalized as live.
- **Task/session**: 15m prod loop tick 10.

### 2026-08-28 — Window phase (W-028)
- **Change**: BACKLOG W-028 done. CONTEXT gained Window phase. `pickWindow` keeps unexpired Trading rows through lock headroom; Call session still refuses new Calls.
- **Reasoning**: Last ~90s of a 15m Window hid Exit and holdings behind "None live".
- **Rejected alternative(s)**: A second picker. Showing Finalized rows on the live board.
- **Task/session**: 15m prod loop tick 9.

### 2026-08-28 — README rewrite + DEMO script
- **Change**: README leads with an ASCII board hero, judge demo path including the P&L tape, capability table, and architecture map. New `docs/DEMO.md`: 90-second walkthrough with timings + fallbacks.
- **Reasoning**: Presentation & Demo is 15% of judging; the repo is the submission artifact. The old README had the quickstart but no capability map or script.
- **Rejected alternative(s)**: Screenshots (need a live session; ASCII hero is deterministic). A video script before the demo path was stable.
- **Task/session**: Hackathon hardening session.

### 2026-08-28 — Wallet P&L (W-027)
- **Change**: BACKLOG W-027 done. CONTEXT gained Wallet P&L. SDK-FEEDBACK item 7 notes pool-grouped fills in `computeOpenPositionsPnL`.
- **Reasoning**: PRD #36 wants series P&L; Series record is counts, money needs the fill tape. Domain stays SDK-free.
- **Rejected alternative(s)**: Treating Series record as tUSDC P&L. Calling `fetchMyTrades` from the browser without a signer.
- **Task/session**: 15m prod loop tick 8.

### 2026-08-28 — Venue settlement fee (W-026)
- **Change**: BACKLOG W-026 done. `parseSettlementFeeBps` maps indexer decimal strings; missing plumbing is 0. ExchangePort `settlementFeeBps(marketId)` on Somnia (`getMarketFees`) and fake.
- **Reasoning**: Fees are frozen at market creation (standard bps, 1 = 0.01%). Domain stays SDK-free. App caches 5 minutes.
- **Rejected alternative(s)**: `useMarketFees` in CallBoard (skips the fake adapter). Treating `bpsTimes1k` from the client d.ts comment (markets.ts + `estPayoutFor` use standard bps over 10_000).
- **Task/session**: 15m prod loop tick 7.

### 2026-08-28 — Settle preview (W-025)
- **Change**: BACKLOG W-025 done. CONTEXT gained Settle preview. Winner/void math matches SDK `estPayoutFor` without importing the SDK.
- **Reasoning**: Live holdings showed contracts but not what Claim would pay. Domain stays SDK-free; fee defaults to 0 bps until venue fees are fetched.
- **Rejected alternative(s)**: Fill-based wallet P&L this tick (needs `getUserFills`). Importing `estPayoutFor` into domain (ADR-0003).
- **Task/session**: 15m prod loop tick 6.

### 2026-08-28 — Series record (W-024)
- **Change**: BACKLOG W-024 done. CONTEXT gained Series record. `readSeriesRecord` tallies Finalized Up/Down/Void; last is newest expiry.
- **Reasoning**: History chips had no tested read model (W-013). A series scoreboard is not wallet P&L — that needs fills.
- **Rejected alternative(s)**: Calling SDK `computePositionPnL` from domain (ADR-0003). Showing a tUSDC P&L without fills (would be invented).
- **Task/session**: 15m prod loop tick 5.

### 2026-08-28 — Book drawer (W-014)
- **Change**: BACKLOG W-014 done. CONTEXT gained Book drawer.
- **Reasoning**: Loop tick added collapsed Up-book depth behind `readBookDepth` so the homepage is still a Call slip, not a CLOB.
- **Rejected alternative(s)**: Rendering the SDK's four-sided book (NO is 1 − Up; that would clone dreamDEX). Putting depth only in JSX (no locality).
- **Task/session**: 15m prod loop tick 4.

### 2026-08-28 — Stake quote (W-022)
- **Change**: BACKLOG W-022 done. CONTEXT gained Stake quote.
- **Reasoning**: Loop tick sized Calls from the live book (`quoteBinaryStake`) instead of a single ask, behind `prepareQuotedCall` so domain stays SDK-free.
- **Rejected alternative(s)**: Feeding SDK `trader.placeOrder` MARKET from the quote (ADR-0002 still uses unified IOC `createOrder` with human contracts/price).
- **Task/session**: 15m prod loop tick 3.

### 2026-08-28 — Window board (W-023)
- **Change**: BACKLOG W-023 done. CONTEXT gained Window board.
- **Reasoning**: Loop tick split wallet chrome from the Call ticket behind `readBoard`.
- **Rejected alternative(s)**: JSX-only split with no tested read model.
- **Task/session**: 15m prod loop tick 2.

### 2026-08-28 — Claim session (W-021)
- **Change**: BACKLOG W-021 done. CONTEXT gained Claim session.
- **Reasoning**: Loop tick deepened the Finalized scan out of the Somnia adapter.
- **Rejected alternative(s)**: Splitting App.tsx this tick (Claim had the worse locality).
- **Task/session**: 15m prod loop.

### 2026-08-28 — Call session + fake adapter landed
- **Change**: BACKLOG W-008–W-013 / W-018–W-020 marked done. CONTEXT gained Call session, Open ticket, Series history, Cadence.
- **Reasoning**: Architecture pass made ExchangePort a real seam (two adapters) and moved write rules out of App.
- **Rejected alternative(s)**: Keeping Call/Exit logic in App.tsx (no test locality).
- **Task/session**: Prod iteration.

### 2026-08-28 — Plan then PRD
- **Change**: PLAN, PRD, BACKLOG, ADR-0001/0002/0003.
- **Reasoning**: User asked /plan then /to-prd before build.
- **Rejected alternative(s)**: Scaffolding before a written CROPS/onchain split.
- **Task/session**: Initial Window build.

## Known Gotchas
`docs/info.txt` is the hackathon flyer, not the product spec.
