# AGENTS.md — src/chain

## Ownership
Somnia Shannon network constants and wagmi config.

## Purpose
Single place for chain id 50312, RPCs, explorer, tUSDC, faucet URL.

## What This Controls
Wrong RPC/chain → users send txs nowhere or to mainnet.

## Connections
- Depends on: viem `defineChain`, wagmi, `docs.somnia.network` network-info, dreamDEX contracts-and-addresses
- Depended on by: `src/main.tsx`, `src/ui/App.tsx`, `src/ui/WalletBar.tsx`, `src/ui/PnlStrip.tsx`, `src/ui/CallBoard.tsx`
- External systems touched: Shannon RPC, Shannon explorer

## Current State
Working defaults. Env overrides via `VITE_*` — a var that is absent OR blank/whitespace falls back to the Shannon default (`envUrl`); only a trimmed non-empty value wins.

## Decision Log

### 2026-09-07 — envUrl: blank env vars fall back, not pass through
- **Change**: `shannon.ts` gains `envUrl(raw, fallback)` (+ tests: absent/blank/whitespace → fallback, trimmed override wins). `chain.ts` (WS) and `wagmi.ts` (RPC + fallback RPC) route their `VITE_*` reads through it; `src/exchange/somnia.ts` does the same for `VITE_INDEXER_URL`/`VITE_WS_RPC_URL`.
- **Reasoning**: Live Vercel deploy crashed `#/app` with `@somnia-chain/markets-sdk: createClient — needs indexerUrl` on every reload. `??` only catches null/undefined, so a hoster-injected empty-string `VITE_INDEXER_URL` reached the SDK as `""` and createClient threw. `#/` and `#/docs` survived because their warm-up swallows; the terminal's provider/query path surfaced it as the board load-error notice.
- **Rejected alternative(s)**: `||` inline at each site (six copies of one rule, no test); deleting the env var in Vercel only (next blank var re-trips it).
- **Task/session**: Vercel deploy bug — BACKLOG W-106.

### 2026-08-28 — Oracle receipt URL tested
- **Change**: `shannon.test.ts` locks `oracleReceipt` to `prd.oracle.somnia.host/questions/{id}?view=graph`.
- **Reasoning**: Easy to drop `?view=graph` or point at a non-public host. PRD #34 is that graph.
- **Rejected alternative(s)**: Building URLs in CallBoard.
- **Task/session**: Loop tick 20 — W-038.

### 2026-08-28 — Explorer proof helpers tested
- **Change**: `shannon.test.ts` locks `explorerTx` / `explorerAddress` to `shannon-explorer.somnia.network`.
- **Reasoning**: Easy to point at mainnet `explorer.somnia.network` by accident. PRD #37 is Shannon.
- **Rejected alternative(s)**: Building URLs in App (duplicates chain ownership).
- **Task/session**: Loop tick 14 — W-033.

### 2026-08-28 — Shannon defaults from published docs
- **Change**: Primary RPC `api.infra.testnet.somnia.network`, fallback `dream-rpc.somnia.network`.
- **Reasoning**: Official network-info lists the infra URL; Somnia dApp tutorials also cite dream-rpc.
- **Rejected alternative(s)**: Mainnet-only config (hackathon requires testnet prototype).
- **Task/session**: Initial Window build.

## Known Gotchas
tUSDC is 6 decimals; mainnet USDso is 18. Do not copy a scale constant across networks.
