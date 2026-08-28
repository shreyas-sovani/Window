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
PRD is `needs-triage` locally (no hosted tracker). Shorten-without-doubling is done (W-046). Crash notice Retry is done (W-045). SDK-FEEDBACK has 8 items. Default Call stays IOC.

## Decision Log

### 2026-08-28 — Shorten short hashes (W-046)
- **Change**: BACKLOG W-046 done. CONTEXT Explorer proof: `shorten` does not double hashes under 12 chars.
- **Reasoning**: PRD #38. Toast and WalletBar share `shorten`; fake `0xfake` was garbled.
- **Rejected alternative(s)**: A second formatter for tx hashes.
- **Task/session**: 15m prod loop tick 29.

### 2026-08-28 — Crash notice (W-045)
- **Change**: BACKLOG W-045 done. CONTEXT gained Crash notice. ErrorBoundary Retry remounts; no stack dump.
- **Reasoning**: PRD #50. Indexer errors already had Retry; a render crash did not.
- **Rejected alternative(s)**: `location.reload()` as the only recovery.
- **Task/session**: 15m prod loop tick 28.

### 2026-08-28 — RevertCopy Call-path (W-044)
- **Change**: BACKLOG W-044 done. CONTEXT gained RevertCopy. Maps `below-lot`, not Trading, SignerRequired, on-chain revert.
- **Reasoning**: PRD #24. Prepare skips already had copy; the write catch did not, so a below-lot IOC looked like a gas failure.
- **Rejected alternative(s)**: Dumping the raw `below-lot` string. Importing `callSkipCopy` into RevertCopy.
- **Task/session**: 15m prod loop tick 27.

### 2026-08-28 — Clock hours (W-043)
- **Change**: BACKLOG W-043 done. CONTEXT Cadence now requires the tote clock to use hours, not `1440:00`.
- **Reasoning**: Same unit bug as W-030, on the largest element of the board.
- **Rejected alternative(s)**: Leaving MM:SS-only because 15m is the demo chip.
- **Task/session**: 15m prod loop tick 26.

### 2026-08-28 — Hash routes (W-042)
- **Change**: BACKLOG W-042 done. CONTEXT product line names landing / docs / terminal hash routes. DEMO starts at `#/` then Open the terminal.
- **Reasoning**: Prefix `startsWith("#/app")` would treat `#/apps` as the terminal and mount wallet providers.
- **Rejected alternative(s)**: Leaving router untested because only three hashes exist in the nav.
- **Task/session**: 15m prod loop tick 25.

### 2026-08-28 — Pulse ready (W-041)
- **Change**: BACKLOG W-041 done. CONTEXT gained Pulse. Last-window bars count as ready; tape query keys by marketId.
- **Reasoning**: Collecting ticks hid Series history. Pools recycle.
- **Rejected alternative(s)**: Waiting for two spark samples. Keying the public tape by pool.
- **Task/session**: 15m prod loop ticks 23–24.

### 2026-08-28 — Cancel explorer proof (W-040)
- **Change**: BACKLOG W-040 done. CONTEXT Explorer proof now includes Open ticket cancel.
- **Reasoning**: PRD #37 — prove every wallet write. Rest quote made cancel a real path, not a leftover-IOC rarity.
- **Rejected alternative(s)**: Waiting for the P&L tape (cancels are not fills).
- **Task/session**: 15m prod loop tick 22.

### 2026-08-28 — History Line (W-039)
- **Change**: BACKLOG W-039 done. CONTEXT Series history now requires the Line on chips when known.
- **Reasoning**: PRD #35 — settled Windows include the Line, not only Up/Down/Void.
- **Rejected alternative(s)**: Inventing a Line from question text.
- **Task/session**: 15m prod loop tick 21.

### 2026-08-28 — History oracle receipts (W-038)
- **Change**: BACKLOG W-038 done. CONTEXT Oracle receipt now includes series history chips.
- **Reasoning**: PRD #34 — audit Line vs close on the Window that actually settled.
- **Rejected alternative(s)**: Only the live Window ghost link (often the successor).
- **Task/session**: 15m prod loop tick 20.

### 2026-08-28 — Claim/faucet explorer proof (W-037)
- **Change**: BACKLOG W-037 done. CONTEXT Explorer proof now includes Claim (last redeem) and faucet.
- **Reasoning**: PRD #37 — prove every wallet write, not only Calls.
- **Rejected alternative(s)**: Waiting for the P&L tape (redeems are not fills).
- **Task/session**: 15m prod loop ticks 18–19.

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

## Earlier history (condensed)
Plan then PRD and ADRs first. Call session + fake adapter made ExchangePort a real seam (W-008–W-013 / W-018–W-020). Later ticks: Claim session, Window board, Stake quote, Book drawer, Series record, Settle preview, venue fee, Wallet P&L, README/DEMO, Window phase, Locked wait row, cadence labels (W-021–W-030).

## Known Gotchas
`docs/info.txt` is the hackathon flyer, not the product spec.
