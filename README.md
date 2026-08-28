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

## Demo path (judges)

1. `cp .env.example .env && npm install && npm test && npm run dev`
2. Open the printed localhost URL (often `http://localhost:5174/` if 5173 is taken).
3. Injected wallet (MetaMask / Rabby): add Shannon — chain `50312`, RPC `https://api.infra.testnet.somnia.network`, symbol `STT`, explorer `https://shannon-explorer.somnia.network`.
4. Gas: [testnet.somnia.network](https://testnet.somnia.network/).
5. Connect → Switch to Shannon → **Mint tUSDC** (`trader.faucet`, cap 10,000) → Approve the stake → **Call Up** or **Call Down**.
6. Watch the fill land in the **P&L tape**, the position mark to book, then the Window lock.
7. After expiry, **Claim finalized**. Oracle receipt is the public Line-vs-close trail.

Expect two Shannon venues: 60s/5m vs 15m+. Cadence chips include 5m through 24h. Indexer `intervalSec` can be a few seconds off (e.g. 3598 for 1h); Window snaps it to the canonical cadence.

## What's in the box

| Capability | Detail |
|---|---|
| Live Window board | Line (opening price), countdown with lock urgency, implied Up/Down from the live book, on-chain volume + trade count |
| Two-sided Call slip | Stake in tUSDC → contract sizing via live-book stake quotes; IOC take with protective limit |
| Wallet gate | Connect → Switch to Shannon → Approve tUSDC → Call, each state on one primary button |
| Series history + record | Last 12 finalized Windows per cadence with Up/Down/Void chips and running tally |
| Settle preview | If-Up / If-Down / If-Void payout of the live position, venue fee aware |
| Wallet P&L | Realized + unrealized per open position (avg-cost, marked to book) and a signed fill tape — all explorer-linked |
| Book drawer | Collapsed Up-depth ladder with size bars and spread |
| Claim session | Scans finalized Windows, redeems winners (fee-adjusted) and voids (both sides at par) |
| Open tickets | IOC should leave none — if one rests, cancel frees the escrow |

## Architecture

```
src/
├── domain/        SDK-free pure logic — fully unit-tested (Vitest, 123 tests)
│   ├── pick-window, window-board     read models for the live series
│   ├── call-ticket, call-session      sizing (tick/lot grids), Call/Exit intents
│   ├── claim-plan, claim-session      what redeems, and how
│   ├── pnl                           tape + position P&L folds
│   ├── lifecycle, series              callability headroom, cadence snapping
│   └── settle-preview, wallet-gate, revert-copy, grid, implied, book-depth
├── exchange/      the only SDK-touching layer (ADR-0002/0003)
│   ├── port.ts                       ExchangePort: WindowFeed + VenueWriter
│   ├── somnia.ts                     live adapter — markets-sdk on Shannon
│   ├── fake.ts                       deterministic in-memory adapter for tests
│   └── live-book.ts                  SDK live book → BookTop/depth
├── chain/         Shannon constants, wagmi/viem config
└── ui/            App orchestration, CallBoard, PnlStrip, BookDrawer, WalletBar
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
