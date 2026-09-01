# Backlog

Triage label vocabulary (local, no hosted tracker): `needs-triage` | `ready` | `in-progress` | `done` | `blocked` | `wont-do`.

| ID | Item | Module | Priority | Triage | Tests? |
|---|---|---|---|---|---|
| W-001 | Grid: tick/lot snap, skip zero lots | Grid | P0 | done | yes |
| W-002 | Lifecycle: Trading + scaled headroom | Lifecycle | P0 | done | yes |
| W-003 | CallTicket: stake → size, max loss, payout | CallTicket | P0 | done | yes |
| W-004 | ClaimPlan: Finalized / void / winner / skip loser | ClaimPlan | P0 | done | yes |
| W-005 | WalletGate: connect / switch / approve / ready | WalletGate | P0 | done | yes |
| W-006 | RevertCopy: human errors | RevertCopy | P0 | done | yes |
| W-007 | Vite app shell + Shannon chain config | chain | P0 | done | no |
| W-008 | ExchangeAdapter + fake adapter | ExchangeAdapter | P0 | done | yes |
| W-009 | Live Window card (Line, countdown, implied, volume) | ui | P0 | done | no |
| W-010 | Faucet tUSDC + approve + IOC Call Up/Down | ui | P0 | done | yes (Call session) |
| W-011 | Position + Exit + open tickets | ui | P1 | done | yes (Exit + fake) |
| W-012 | Claim all + oracle receipt | ui | P0 | done | yes (ClaimPlan + fake) |
| W-013 | Series history strip | ui | P1 | done | no |
| W-014 | Advanced book drawer | Book depth | P2 | done | yes |
| W-015 | Session-key roll agent | stretch | P3 | wont-do until P0 done | no |
| W-016 | README + demo script + AGENTS.md protocol | docs | P0 | done | no |
| W-017 | SDK/docs feedback note | docs | P1 | done | no |
| W-018 | Call session (prepare + Trading-gated execute) | Call session | P0 | done | yes |
| W-019 | Snap indexer intervalSec to canonical cadence | Cadence | P0 | done | yes |
| W-020 | Live book via SDK watches (marketId-keyed) | ui | P1 | done | no |
| W-021 | Claim session module (scan Finalized independently of App) | Claim session | P1 | done | yes |
| W-022 | Size Calls with quoteBinaryStake against live book | Call session | P2 | done | yes |
| W-023 | Split App: Window board read model + wallet chrome vs Call ticket | Window board | P1 | done | yes |
| W-024 | Series record tally on history strip | Series record | P1 | done | yes |
| W-025 | Settle preview on live holdings (Up / Down / Void payout) | Settle preview | P1 | done | yes |
| W-026 | Venue settlement fee on Settle preview | Settle preview | P1 | done | yes |
| W-027 | Wallet P&L from fills + open positions | Wallet P&L | P1 | done | yes |
| W-028 | Keep series Window on the board through lock headroom | Window phase | P1 | done | yes |
| W-029 | Show just-expired Locked/Settling until the successor lists | Window phase | P1 | done | yes |
| W-030 | Cadence labels + wait-gate copy from Window phase | Cadence | P2 | done | yes |
| W-031 | Bounded tUSDC approve (exact stake, no 10k fallback) | WalletGate | P1 | done | yes |
| W-032 | Claim as tote primary after resolve (even if successor is Trading) | Claim primary | P1 | done | yes |
| W-033 | Explorer proof on Call / Exit / approve toasts | Explorer proof | P1 | done | yes |
| W-034 | Post-only Rest quote in the Book drawer (not on Call) | Rest quote | P2 | done | yes |
| W-035 | Series P&L for the selected chip (asset + cadence) | Series P&L | P1 | done | yes |
| W-036 | Board notice: empty / error / thin-book with a next action | Board notice | P1 | done | yes |
| W-037 | Explorer proof on Claim (last redeem) and faucet toasts | Explorer proof | P1 | done | yes |
| W-038 | Oracle receipt links on series history chips | Oracle receipt | P1 | done | yes |
| W-039 | Line (opening price) on series history chips | Series history | P1 | done | yes |
| W-040 | Explorer proof on Open ticket cancel toasts | Explorer proof | P1 | done | yes |
| W-041 | Pulse ready when series history has bars; tape keyed by marketId | Pulse | P1 | done | yes |
| W-042 | Hash routes: exact path, not prefix (`#/apps` is not the terminal) | ui | P1 | done | yes |
| W-043 | Clock names hours on 1h+ Windows (`24h 00:00`, not `1440:00`) | Cadence | P2 | done | yes |
| W-044 | RevertCopy maps below-lot, not Trading, SignerRequired, on-chain revert | RevertCopy | P1 | done | yes |
| W-045 | Crash notice: Retry on render error, no stack dump | Board notice | P1 | done | yes |
| W-046 | shorten: short hashes stay whole (no `0xabc…xabc`) | Explorer proof | P2 | done | yes |
| W-047 | Claim session names Windows + expected tUSDC, not outcome-balance count | Claim session | P1 | done | yes |
| W-048 | Claim session continues after a failed redeem; all-fail rethrows | Claim session | P1 | done | yes |
| W-049 | No fabricated 50%: Call/Exit refuse without a real book price | Call session | P0 | done | yes |
| W-050 | Claim scans every venue, dedupes by marketId, names the 40-window bound | Claim session | P0 | done | yes |
| W-051 | Claim preview fee-aware per held Window (`SettledWindow.feeBps`) | Claim session | P1 | done | yes |
| W-052 | Opportunity-first auto-select (`autoSeries`: Line + headroom score) | Window board | P0 | done | yes |
| W-053 | Series tape P&L labeled fills-only (Claim payouts excluded, said so) | Series P&L | P1 | done | yes |
| W-054 | Rest expiry truth: pool bounds rest at market expiry; copy + SDK-FEEDBACK corrected | Rest quote | P1 | done | no |
| W-055 | App takes an injectable exchange; useNow/useBanner/usePulseSamples hooks | ui | P1 | done | yes |
| W-056 | Adapter parity contract test + full-UI integration test against the fake adapter | tests | P0 | done | yes |
| W-057 | Question-first board + Risk→Win on each ticket side | ui | P1 | done | no |
| W-058 | Liquidity-aware Call preview: est. fill, avg odds, unfilled, Use-max-fillable from top-5 depth | Liquidity | P1 | done | yes |
| W-059 | Shareable proof card: witnessed-call receipt, settled variant + oracle link, clipboard/Web Share | Proof card | P1 | done | yes |
| W-060 | Market-health indicator (spread + executable depth + time-to-lock) | Market health | P2 | done | yes |
| W-061 | Quick stake presets (5/10/25 tUSDC) | ui | P3 | done | no |
| W-062 | Chips ranked by live callability score (best badge) | Window board | P3 | done | yes |
| W-063 | Wallet-write mutex: synchronous ref lock across all nine writes; blocked callback names the held action | Write guard | P0 | done | yes |
| W-064 | Approve receipt failure/replacement handled: hash cleared, err banner, no stuck approving state | Wallet gate | P0 | done | no |
| W-065 | Chain+account revalidation on the approve path; per-button disabled reasons via title | Wallet gate | P1 | done | no |
| W-066 | RevertCopy stops leaking stacks/JSON internals (shortMessage/message/details, 240-char cap) | RevertCopy | P1 | done | yes |
| W-067 | prefers-reduced-motion disables all animation | ui | P2 | done | no |
| W-068 | Full write-lifecycle integration test: connect → double-fire + Enter spam → exactly one faucet write | tests | P0 | done | yes |
| W-069 | Onboarding domain: nextStep chain (connect→switch→gas→mint→approve→wait→call) with title/explanation/action copy | Onboarding | P0 | done | yes |
| W-070 | Guided onboarding panel replaces the utility-row primary; approve action beside the stake preview | ui | P0 | done | yes |
| W-071 | Rewards section elevates Claim (Windows · tUSDC) out of the utility row | ui | P1 | done | no |
| W-072 | Account dropdown (balance/P&L trigger, copy/explorer/disconnect) replaces the cramped wallet corner | ui | P1 | done | no |
| W-073 | Series nav split: asset + cadence ToggleGroups, waiting/auto states, mobile scroll row | ui | P1 | done | no |
| W-074 | shadcn-style kit primitives in-repo: DropdownMenu, ToggleGroup, Tooltip (+ Button className merge) | kit | P1 | done | yes |
| W-075 | Replay settlement comes from Finalized `marketById`; no editable outcome; exact market ownership required | Replay | P0 | done | yes |
| W-076 | Side-correct prices: buy Up at ask / Down at complement bid; sell Up at bid / Down at complement ask | Call session | P0 | done | yes |
| W-077 | Duel identity is address-normalized, fill-owned, viewer-independent, and never merges multiple opponents | Duel | P0 | done | yes |
| W-078 | Incoming challenge has one prerequisite-aware CTA; self-challenge is visibly disabled | ui | P0 | done | yes |
| W-079 | Bounded post-write fill confirmation; indexer unavailable is distinct from confirmed no-fill | Filled Call | P0 | done | yes |
| W-080 | Account-aware fake, no fabricated quote, full port parity, injectable live-odds hook | tests | P0 | done | yes |
| W-081 | Scientific/sub-precision/unsafe stake input cannot crash sizing or render | CallTicket | P0 | done | yes |
| W-082 | Duel-first landing, current PRD, judge evidence map, 2–5 minute proof-first demo | product/docs | P0 | done | no |
| W-083 | Public deployment, finalized Shannon proof tuple, and recording | submission | P0 | blocked | live human action |
| W-084 | CI, license, clean build, dependency/advisory disclosure | release | P1 | done | yes |
| W-085 | Completed Duel URL names the exact verified accept tx; unrelated public fills never imply social intent | Duel | P0 | done | yes |
| W-086 | Empty-book notice refuses execution instead of promising a fabricated 50% price | Board notice | P0 | done | yes |

PRD: docs/PRD.md. Plan: docs/PLAN.md. Glossary: CONTEXT.md.
