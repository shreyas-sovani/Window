# AGENTS.md — src

## Ownership
Window application source.

## Purpose
Vite React app: domain, chain, exchange adapter, UI.

## What This Controls
Entry is `main.tsx`. Domain must stay SDK-free.

## Connections
- Depends on: npm deps in package.json
- Depended on by: Vite
- External systems touched: Shannon, dreamDEX indexer

## Current State
P0 UI + domain tests + fake ExchangeAdapter. See subdirectory AGENTS.md files.

## Decision Log

### 2026-08-28 — ErrorBoundary + vendor chunking
- **Change**: `main.tsx` wraps `App` in `ErrorBoundary` (renders a recovery banner, never a blank root). `vite.config.ts` adds `manualChunks` for react/wagmi+viem/markets-sdk.
- **Reasoning**: One crash in a provider child used to blank the whole terminal during a demo; 965 kB single bundle became three cacheable chunks (largest 383 kB).
- **Rejected alternative(s)**: Error boundaries per section (overkill — the board is one screen). Route-based code splitting (no routes).
- **Task/session**: Hackathon hardening session.

### 2026-08-28 — SomniaMarketsProvider at the root
- **Change**: `main.tsx` wraps `App` with `SomniaMarketsProvider` using `getExchange().client`.
- **Reasoning**: SDK React watches require the provider; Call odds should not poll-only.
- **Rejected alternative(s)**: Instantiating a second SomniaMarkets in the UI (two tails, two sockets).
- **Task/session**: Live book watches.

### 2026-08-28 — Vite not Scaffold-ETH 2
- **Change**: Vite + wagmi + markets-sdk. No Foundry.
- **Reasoning**: ADR-0001 zero contracts; SE2's forge path is unused weight.
- **Rejected alternative(s)**: Next.js SSR (fights wallet dApps); forge suite from leftover root conventions.
- **Task/session**: Initial Window build.

## Known Gotchas
`npm run build` typechecks `src` excluding `*.test.ts`. Tests: `npm test`.
