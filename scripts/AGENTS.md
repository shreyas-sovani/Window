# AGENTS.md — scripts

## Ownership
Offline smoke scripts against Shannon indexer.

## Purpose
`list-windows.ts` prints live Event Contract symbols without a wallet.

## What This Controls
If this cannot load markets, the UI will not either.

## Connections
- Depends on: `@somnia-chain/markets-sdk`
- Depended on by: humans / agents diagnosing indexer
- External systems touched: Shannon indexer

## Current State
Working. `npx tsx scripts/list-windows.ts` should exit after the print.

## Decision Log

### 2026-08-28 — Close timeout
- **Change**: Race `ex.close()` at 3s, then `process.exit(0)`.
- **Reasoning**: Shannon WS kept the process alive after a successful list (~6 min hang).
- **Rejected alternative(s)**: Skipping close entirely (leaves sockets if close actually returns).
- **Task/session**: Follow-up on hung indexer smoke.

### 2026-08-28 — Indexer smoke
- **Change**: Added list-windows.ts
- **Reasoning**: Catch venue/cadence mix before the UI looks empty
- **Rejected alternative(s)**: Only discovering markets in the browser
- **Task/session**: Diagnose empty Window list

## Known Gotchas
Testnet currently has 60s/5m on one venue and 15m+ on another. Do not pin venue from an unrelated cadence. `ex.close()` can hang on the Shannon WS; the script races it then exits.
