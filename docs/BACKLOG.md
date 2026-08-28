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

PRD: docs/PRD.md. Plan: docs/PLAN.md. Glossary: CONTEXT.md.
