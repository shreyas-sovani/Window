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
PRD is `needs-triage` locally (no hosted tracker). SDK-FEEDBACK has 9 items (new: operator/session-key gap for Event Contracts). W-060/W-061/W-062 done; Roll companion shipped. Default Call stays IOC.

## Decision Log

### 2026-08-30 — Enhancement pass docs (W-060–W-062, Roll, SDK-FEEDBACK #9, restyle)
- **Change**: BACKLOG W-060/W-061/W-062 marked done (market health, presets, best-badge ranking). SDK-FEEDBACK gained item 9 — the operator/session-key model is unreachable for Event Contracts through the SDK (`placeBinaryOrderFor` ships in `tradeAbi` but `Trader` exposes no binary place-for path; Bot Kit session keys are spot-only) — and every "eight-item" reference (README, DEMO, Docs.tsx) became nine. DEMO.md: the stale "empty book sizes at 50% mid" fallback replaced with the honest refusal; read-model beat now names the ring + Book cell; 165 → 219 tests; cold-load fallback added. CONTEXT gained Market health + Roll entries. README: capability rows for health/roll/ring/best-badge/presets, gate row now the full nextStep chain, arch tree current, ecosystem section says why no roll *bot*.
- **Reasoning**: DEMO.md:26 was the repo's only hard falsehood (killed by W-049 two passes ago); counts drift silently so they were refreshed after the final `npm test` run. Item 9 is the brief's "judging bait" — a field report of exactly where the published surface stops, with the on-chain evidence.
- **Rejected alternative(s)**: Wiring `signRedeemAuth`/`redeemFor` sponsored-claim UI for more surface (needs a second wallet to demo; risk over honesty). Re-badging the roll companion as "Bot Kit integration" (it is not — the kit has no EC operator mode).
- **Task/session**: Hackathon enhancement pass.

### 2026-08-29 — Onboarding pass (W-069–W-074)
- **Change**: BACKLOG W-069–W-074 added and done. CONTEXT gained Onboarding step + Chip status entries. No README/PRD change — the onboarding journey is covered by the CONTEXT entries and the terminal itself.
- **Reasoning**: Same doc rule as before: glossary truth lands in CONTEXT; feature rows in README only when a judge-facing capability changes name (this is a UX re-hierarchy of existing capabilities).
- **Rejected alternative(s)**: A new PRD section for the journey (duplicates nextStep copy).
- **Task/session**: Onboarding redesign session.

### 2026-08-29 — Innovation pass (W-058–W-062)
- **Change**: BACKLOG W-058/W-059 done (liquidity preview, proof cards); W-060 market-health indicator, W-061 stake presets, W-062 callability-ranked chips filed `ready` with priorities, not built. CONTEXT gained Liquidity preview + Proof card entries. README capability rows updated.
- **Reasoning**: Two-feature cap from the brief; the three `ready` items are small follow-ups with clear specs so a later session can pick them up without re-deriving.
- **Rejected alternative(s)**: Building all five (scope risk before demo). Filing the follow-ups without priority labels.
- **Task/session**: Product-innovation pass.

### 2026-08-28 — Honesty pass on product claims (W-049–W-057)
- **Change**: BACKLOG W-049–W-057 added and done. SDK-FEEDBACK item 8 rewritten: binary orders are pool-bounded by market expiry (default = market expiry, `OrderExpiryBeyondMarket` rejects beyond it), so a post-only Rest cannot outlive its Window — the earlier "cannot age off" claim was wrong; the remaining gap is only setting a *shorter* TTL. README gained "Why the ecosystem needs this" (recurring Windows → repeat volume; honest odds → trust; SDK-only composability) and the capability table now states no-book/no-Call, multi-venue deduped fee-aware Claim, Rest expiry, and fills-only Series tape P&L. DEMO close cites 165 tests incl. the UI integration run.
- **Reasoning**: Judges should be able to verify every claim in the repo; two claims (Rest aging, Series P&L completeness) did not survive contact with the SDK types and were corrected in code first, docs second.
- **Rejected alternative(s)**: Deleting SDK-FEEDBACK item 8 (the corrected nuance is itself useful feedback). Marketing the ecosystem section without the honesty fixes landing first.
- **Task/session**: Brutal-overhaul session.

### 2026-08-28 — Doc sweep: PLAN status banner
- **Change**: PLAN.md opens with a "Status: built" note pointing at BACKLOG/AGENTS/CONTEXT, and its UI section notes the shipped light theme + three routes. No other PLAN edits — it stays the original plan, as history.
- **Reasoning**: PLAN described the pre-build intent (dark tote-board, single page); readers were landing on it with no signal that every item shipped differently-later-better.
- **Rejected alternative(s)**: Rewriting PLAN to describe the present (duplicates BACKLOG + AGENTS; destroys the historical record). Deleting PLAN (root AGENTS.md and PRD reference it).
- **Task/session**: Doc cleanup sweep.

### 2026-08-28 — Claim session continue-after-fail (W-048)
- **Change**: BACKLOG W-048 done. CONTEXT Claim session: a failed redeem does not abort later Windows; all-fail rethrows.
- **Reasoning**: PRD #32 Claim all. One reverted row was hiding the rest of the scan.
- **Rejected alternative(s)**: Returning an empty receipt on total failure (no RevertCopy).
- **Task/session**: 15m prod loop tick 31.

### 2026-08-28 — Claim session Windows + tUSDC (W-047)
- **Change**: BACKLOG W-047 done. CONTEXT Claim session / Claim primary: preview is unique Windows + expected collateral, copy names tUSDC. DEMO Claim beat uses that button.
- **Reasoning**: PRD #29/#32. Intent count and "outcome balance(s)" were exchange jargon on the tote.
- **Rejected alternative(s)**: Keeping "Claim winnings" as the only primary copy.
- **Task/session**: 15m prod loop tick 30.

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
