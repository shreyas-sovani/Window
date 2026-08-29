# Window

```
┌──────────────────────────────────────────────────────────────┐
│  W I N D O W          12,450.20 tUSDC   P&L +1.25 tUSDC      │
│  Call the next interval.        ● Indexer live               │
├──────────────────────────────────────────────────────────────┤
│  Line · open    │   Locks in   │  Implied Up                 │
│  67,214.50      │     09:41    │  61.3%                      │
├──────────────────────────────────────────────────────────────┤
│   [ BTC 5m ] [ BTC 15m ] [ BTC 1h ] [ ETH 5m ] [ ETH 15m ]   │
│                                                              │
│   ┌──────── Up ────────┐   ┌─────── Down ──────┐             │
│   │ close ≥ Line       │   │ close < Line      │             │
│   │       61.3%        │   │       38.7%       │             │
│   │    [ Call Up ]     │   │   [ Call Down ]   │             │
│   └────────────────────┘   └───────────────────┘             │
│                                                              │
│  P&L · trade tape      +1.25 open · −6.00 realized           │
│    BTC 15m · Call Up 10.00 @ 60.5%                 −6.00     │
└──────────────────────────────────────────────────────────────┘
```

Consumer Up/Down terminal for [dreamDEX Event Contracts](https://docs.dreamdex.io/developers/event-contracts) on **Somnia Shannon** (chain 50312).

Call BTC or ETH for the live Window. The Line is the open. Default path is an IOC take — nothing rests, no surprises at settlement. Claim finalized Windows yourself; winnings do not auto-pay. Zero custom contracts. Everything runs through `@somnia-chain/markets-sdk` ≥ 0.28.1 (the HTTP API is spot-only — Event Contracts have no REST surface).

Three pages, hash-routed — no server config needed:

- `#/` — landing: the pitch, one screen, three steps
- `#/docs` — docs: quickstart to settlement, one page
- `#/app` — the terminal

## Demo path (judges)

1. `cp .env.example .env && npm install && npm test && npm run dev`
2. Open the printed localhost URL — skim the landing, then **Open the terminal** (or go straight to `#/app`).
3. Injected wallet (MetaMask / Rabby): add Shannon — chain `50312`, RPC `https://api.infra.testnet.somnia.network`, symbol `STT`, explorer `https://shannon-explorer.somnia.network`.
4. Gas: [testnet.somnia.network](https://testnet.somnia.network/).
5. Connect → Switch to Shannon → **Mint tUSDC** (`trader.faucet`, cap 10,000) → Approve the stake → **Call Up** or **Call Down**.
6. Watch the fill land in the **P&L tape**, the position mark to book, and **Pulse** draw the price/implied sparklines + public tape.
7. After expiry, **Claim finalized**. Oracle receipt is the public Line-vs-close trail.

Expect two Shannon venues: 60s/5m vs 15m+. Cadence chips include 5m through 24h. Indexer `intervalSec` can be a few seconds off (e.g. 3598 for 1h); Window snaps it to the canonical cadence.

## What's in the box

| Capability | Detail |
|---|---|
| Question-first board | "Will BTC close above 67,214.5?" — the Line on its dashed price axis, the lock countdown as a **depleting ring**, implied odds, volume, trades |
| Market health | One grade per Window from spread, walked executable depth, and time-to-lock — a cold depth watch grades the spread and says "top of book", never claims depth it cannot see |
| Opportunity-first selection | When the selected series has no live Trading Window, the terminal auto-jumps to the best one (real Line + safe headroom); the most callable cadence wears a `best` badge |
| Roll companion | After your Window locks, one press repeats the same Call on its successor — same side, same stake. The wallet still signs; nothing repeats on its own |
| Honest execution | Calls size from live stake quotes or the top of book — **no book, no Call**; never an invented 50% price. Explicit Risk → Win on each side |
| Liquidity preview | Estimated fill, average execution odds, and unfilled remainder from the visible book — with one-tap **Use max fillable** (an estimate, never a promise) |
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
├── domain/        SDK-free pure logic — fully unit-tested (Vitest, 219 tests)
│   ├── pick-window, window-board     read models for the live series
│   ├── call-ticket, call-session      sizing (tick/lot grids), Call/Exit intents
│   ├── claim-plan, claim-session      what redeems, and how
│   ├── pnl                           tape + position P&L folds
│   ├── lifecycle, series              callability headroom, cadence snapping
│   ├── market-health, liquidity       book grade + fill estimates from walked depth
│   ├── auto-series, roll, onboarding  best-series jump, roll companion, nextStep chain
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

## Why this exists

dreamDEX already has a CLOB UI. Window is the missing Call: stake in tUSDC, implied odds, countdown, volume (on-chain, not in the official app yet), series history, oracle receipt, wallet P&L, and a Claim that uses `listBinaryMarkets({ status: "Finalized" })` because `loadMarkets()` hides settled markets.

## Docs used

- https://docs.dreamdex.io/developers/event-contracts
- https://docs.dreamdex.io/developers/event-contracts/recipes
- https://docs.dreamdex.io/developers/event-contracts/gotchas
- https://docs.dreamdex.io/developers/event-contracts/contracts-and-addresses
- https://docs.somnia.network/developer/network-info
- GitBook MCP: `https://docs.dreamdex.io/~gitbook/mcp`, `https://docs.somnia.network/~gitbook/mcp`
