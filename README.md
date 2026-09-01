# Window

**Make a Call. Challenge another wallet. Prove who won.**

Window Duel is the consumer and social layer for [dreamDEX Event Contracts](https://docs.dreamdex.io/developers/event-contracts) on **Somnia Shannon** (chain 50312). A verified Up/Down fill becomes a challenge link. Another wallet takes the opposite side of the exact same Window. Two public fill proofs plus the finalized market reconstruct the winner—without a backend referee, custody, trusted outcome input, or custom contract.

This is not a peer-to-peer escrow product. The wallets are social opponents, never exchange counterparties; each Call is an independent IOC take against dreamDEX, stakes may differ, and an invite cannot guarantee liquidity. The product fails closed instead of smoothing over those constraints.

The default terminal reduces the exchange to one Line, a depleting lock ring, live odds, bounded Risk → Win, and one next action. Advanced book, exits, tape P&L, oracle receipts, multi-venue claims, and rematch live behind that loop.

Three pages, hash-routed — no server config needed:

- `#/` — landing: the pitch, one screen, three steps
- `#/docs` — docs plus fail-closed judge replay (`?m=…&a=…&b=…` prefills proof)
- `#/app` — the terminal

Judge brief: [`docs/JUDGING.md`](docs/JUDGING.md). Demo: [`docs/DEMO.md`](docs/DEMO.md). Product truth: [`docs/PRD.md`](docs/PRD.md).

## Local run

1. `cp .env.example .env && npm install && npm test && npm run dev`
2. Open the printed localhost URL — skim the landing, then **Open a live Window** (or go straight to `#/app`).
3. Injected wallet (MetaMask / Rabby): add Shannon — chain `50312`, RPC `https://api.infra.testnet.somnia.network`, symbol `STT`, explorer `https://shannon-explorer.somnia.network`.
4. Gas: [testnet.somnia.network](https://testnet.somnia.network/).
5. Connect → Switch to Shannon → **Mint tUSDC** (`trader.faucet`, cap 10,000) → Approve the stake → **Call Up** or **Call Down**.
6. A receipt and challenge link appear only after the wallet tape verifies the fill. Open the link with another wallet and follow its single CTA to take the opposite side.
7. After the accepting fill verifies, Window appends its exact tx as `&a=…` and exposes **Share verified duel**. Unrelated opposite fills on the public market never count as acceptance.
8. Use the finalized replay URL to show both proofs and chain-derived winner deterministically; after expiry, **Claim finalized**.

Expect two Shannon venues: 60s/5m vs 15m+. Cadence chips include 5m through 24h. Indexer `intervalSec` can be a few seconds off (e.g. 3598 for 1h); Window snaps it to the canonical cadence.

## What's in the box

| Capability | Detail |
|---|---|
| Wallet challenge | A tape-verified Call becomes `#/app?d=…`; the recipient sees one prerequisite-aware CTA, and a verified accept produces a completed URL naming both exact transactions |
| Deterministic judge replay | `marketId + two tx hashes` reconstruct both legs and reads settlement from the Finalized market; missing or contradictory evidence refuses |
| Question-first board | "Will BTC close above 67,214.5?" — the Line on its dashed price axis, the lock countdown as a **depleting ring**, implied odds, volume, trades |
| Market health | One grade per Window from spread, walked executable depth, and time-to-lock — a cold depth watch grades the spread and says "top of book", never claims depth it cannot see |
| Opportunity-first selection | When the selected series has no live Trading Window, the terminal auto-jumps to the best one (real Line + safe headroom); the most callable cadence wears a `best` badge |
| Roll companion | After your Window locks, one press repeats the same Call on its successor — same side, same stake. The wallet still signs; nothing repeats on its own |
| Honest execution | Calls size from live stake quotes or the top of book — **no book, no Call**; never an invented 50% price. Explicit Risk → Win on each side |
| Proof cards | Every witnessed Call becomes a plain-text receipt — settled variant adds result + oracle link — shareable via clipboard or Web Share, no backend |
| Two-sided Call slip | Stake in tUSDC with 5/10/25 presets → IOC take with protective limit; leftovers cancel, nothing rests |
| Wallet gate | Connect → Switch → gas → Mint → Approve exactly the stake → Call, guided one step at a time (`nextStep`) |
| Series history + record | Last 12 finalized Windows per cadence with Up/Down/Void chips, running tally, oracle receipts, and Lines |
| Series tape P&L | Signed per-series P&L from fills — labeled fills-only, because Claim payouts are not fills |
| Settle preview | If-Up / If-Down / If-Void payout of the live position, venue fee aware |
| Wallet P&L | Realized + unrealized per open position (avg-cost, marked to book) and a signed fill tape — all explorer-linked |
| Pulse | Underlying price + implied-odds sparklines, last-12 outcome bars, and the pool's public fill tape — pure SVG, no chart lib |
| Book drawer | Collapsed Up-depth ladder; post-only Rest that **expires at Window lock** (pool-enforced) |
| Claim session | Scans the 40 most recent finalized Windows **across every venue**, deduped by market, fee-aware per Window; preview is Windows · expected tUSDC; a failed redeem does not abort the rest |
| Open tickets | IOC should leave none — if one rests, cancel frees the escrow |

## Why the ecosystem needs this

dreamDEX Event Contracts roll a fresh market every few minutes, but the exchange UI is a CLOB — it asks "at what price and size?", not "up or down?". That gap is lost volume: the natural trader for a 15-minute binary is a consumer with a view and ten tUSDC, not a market maker.

Window is the demand side that ecosystem is missing:

- **Recurring Windows → repeat usage.** Every interval is a new decision on one screen. The Claim primary, the Roll companion (one press repeats the last Call on the successor), and the auto-selected best Window pull the user back into the next trade the moment the last one settles — compounding taker flow into every venue the indexer serves. A hot-key roll *bot* is deliberately not shipped: the SDK has no operator path for binary placement (SDK-FEEDBACK #9), so Window keeps the human in the loop instead of faking one.
- **Honest odds grow trust, not churn.** No executable book means no Call — Window refuses to fake a price, and every fill, approve, claim, and window carries a Shannon explorer link. On-chain proof is one click from every number on the screen.
- **Composability, zero contracts.** The whole product is the `@somnia-chain/markets-sdk` surface exercised end-to-end — portfolio reads, live books, stake quotes, post-only rests, multi-venue claims, the price feed — with no deployed bytecode of our own (ADR-0001). Anything dreamDEX ships next (builder fees, new venues, new cadences) composes into this terminal for free, and `docs/SDK-FEEDBACK.md` is the nine-item field report that came out of exercising it.

## Architecture

```
src/
├── domain/        SDK-free pure logic — unit-tested with the broader 319-test Vitest suite
│   ├── pick-window, window-board     read models for the live series
│   ├── call-ticket, call-session      sizing (tick/lot grids), Call/Exit intents
│   ├── claim-plan, claim-session      what redeems, and how
│   ├── pnl                           tape + position P&L folds
│   ├── lifecycle, series              callability headroom, cadence snapping
│   ├── market-health, liquidity       book grade + fill estimates from walked depth
│   ├── auto-series, roll, onboarding  best-series jump, roll companion, nextStep chain
│   ├── duel, challenge-link, replay    social state + chain-shaped proof verification
│   └── settle-preview, wallet-gate, revert-copy, grid, implied, book-depth,
│       rest-quote, proof-card, series-record, board-notice, tote-primary, chart
├── exchange/      the only SDK-touching layer (ADR-0002/0003)
│   ├── port.ts                       ExchangePort: WindowFeed + VenueWriter
│   ├── somnia.ts                     live adapter — markets-sdk on Shannon, warm-started
│   ├── fake.ts                       deterministic in-memory adapter for tests
│   └── live-book.ts                  SDK live book → BookTop/depth
├── chain/         Shannon constants, wagmi/viem config
└── ui/            App orchestration, CallBoard (lock ring, health, roll), kit primitives
```

Decisions live in `docs/adr/`: zero custom contracts (0001), SDK over HTTP API (0002), domain stays SDK-free (0003). Glossary: `CONTEXT.md`. Plan / PRD / backlog: `docs/`. Demo script: `docs/DEMO.md`. SDK notes: `docs/SDK-FEEDBACK.md`.

## Release and dependency status

`npm test` and `npm run build` are the release gate; GitHub Actions runs both from a clean install and rejects critical production advisories. As of 2026-09-01, `npm audit --omit=dev` reports 25 transitive production findings (2 high, 23 moderate) through wagmi's connector tree, including nested WalletConnect `ws` and Coinbase CDP `axios`. There are no critical findings. npm's complete remediation requires the breaking wagmi 3 upgrade, so it was not forced into the judged build; this remains an explicit post-demo migration, not a claim of zero vulnerabilities.

## Why this exists

dreamDEX already has a CLOB UI, so another exchange skin would be weak differentiation. Window adds the missing consumer Call and the social proof loop: share one verified take, invite an opposite take, and resolve the result from public evidence. The supporting terminal also exposes on-chain volume, series history, oracle receipts, wallet P&L, and a Finalized-market Claim path that the live registry alone cannot provide.

## Docs used

- https://docs.dreamdex.io/developers/event-contracts
- https://docs.dreamdex.io/developers/event-contracts/recipes
- https://docs.dreamdex.io/developers/event-contracts/gotchas
- https://docs.dreamdex.io/developers/event-contracts/contracts-and-addresses
- https://docs.somnia.network/developer/network-info
- GitBook MCP: `https://docs.dreamdex.io/~gitbook/mcp`, `https://docs.somnia.network/~gitbook/mcp`
