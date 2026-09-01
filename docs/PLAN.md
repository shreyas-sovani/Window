# Plan — Window Duel

Original plan: 2026-08-28. Winner-readiness truth pass: 2026-09-01.

> **Status: code-ready; submission evidence pending.** The solo terminal below is the original build plan, retained as history. Duel is now the product: a verified Call → shareable challenge → one gated opposite Call → two-fill result from the finalized market. Current scope and truth live in `docs/PRD.md`, `docs/JUDGING.md`, `docs/BACKLOG.md`, and the nearest `AGENTS.md` files.

## Winner-readiness plan

1. **Trust boundary — done:** replay reads Finalized settlement; exact market-owned tape rows, distinct wallets, opposite sides, and consistent tx rows are mandatory.
2. **Execution correctness — done:** side-aware buy/exit prices, required NO symbol, safe stake parsing, bounded fill confirmation, and unavailable-vs-unfilled states.
3. **Challenge UX — done:** exactly one prerequisite-aware accept action; a verified accept publishes its exact tx in a shareable completed-proof URL, so unrelated public fills never become opponents.
4. **Judge narrative — done:** Duel-first landing, current PRD, criterion/evidence map, deterministic 2–5 minute script, and real-proof URL prefill.
5. **Release gate — done:** clean test/build/CI, license, dependency disclosure, responsive visual pass.
6. **External evidence — blocked on human/live state:** finalized Shannon proof tuple, public deployment URL, and recording. These cannot be manufactured from repository code.

Rejected winner-pass additions: a last-minute custom escrow contract (contradicts the zero-contract trust story and adds audit risk), a points leaderboard without real users (fake traction), and an autonomous roll bot without a binary operator API (cannot be shipped honestly).

## Goal

Ship a Shannon-testnet prototype that lets a user **Call** the live BTC/ETH **Window** (Up or Down), see implied odds and the **Line**, exit while **Trading**, and **Claim** after **Finalized**. Zero custom contracts.

## CROPS gate

| Pillar | Default | Compromise | Escape |
|---|---|---|---|
| C | Protocol is permissionless; anyone can trade via SDK or app.dreamdex.io | Hosted frontend + hosted indexer (`dev.smk.somnia.host`) can go down | Official dreamDEX app, Shannon explorer, self-run UI against public RPC |
| O/F | MIT, public GitHub, reproducible `npm install && npm test && npm run dev` | Indexer and oracle hub are protocol-hosted | SDK can read chain logs; ABIs ship in the package |
| P | No accounts, analytics, or email | Every Call is public on the CLOB | User uses a fresh EOA |
| S | No custody, no admin in this app, wallet signs | Session-key agent (stretch) can place/cancel only | Revoke operator; funds never leave the owner's wallet via an operator |

**Onchain litmus:** orders, escrow, outcome balances, resolution, Claim. **Offchain:** layout, copy, series history charts, WalletGate sequencing.

**Contract count:** 0. Event Contracts already exist (`BinaryMarketsModule` `0x3ecC694Cef705358864a646142ac17A90E29e388` on both 5031 and 50312).

## Chain (Somnia docs)

| | Mainnet | Shannon testnet |
|---|---|---|
| Chain ID | 5031 | 50312 |
| RPC | https://api.infra.mainnet.somnia.network/ | https://api.infra.testnet.somnia.network/ |
| WS | wss://api.infra.mainnet.somnia.network/ws | wss://api.infra.testnet.somnia.network/ws |
| Explorer | https://explorer.somnia.network | https://shannon-explorer.somnia.network/ |
| Gas | SOMI | STT |
| Faucet | — | https://testnet.somnia.network/ |

Judged demo is **Shannon**. Fallback HTTP RPC seen in Somnia dApp tutorials: `https://dream-rpc.somnia.network`.

## Event Contract SDK (dreamDEX docs)

- Package: `@somnia-chain/markets-sdk` **≥ 0.28.0** (tick snap). Below 0.23.0 reads break.
- HTTP API is **spot-only**. Do not use `api.dreamdex.io` for Event Contracts.
- Testnet constructor (npm README, confirmed in prior session): indexer `https://dev.smk.somnia.host/v1/graphql`, chain `somniaShannon`, WS `wss://api.infra.testnet.somnia.network/ws`, `SOMNIA_TESTNET_ADDRESSES`.
- Testnet collateral: **tUSDC** `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E`, 6 decimals, `exchange.trader.faucet()` cap 10_000.
- Mainnet collateral: **USDso** 18 decimals. Never copy a 6-decimal constant to mainnet.
- Writes: gate `getMarketOnchain` status `=== 1`. Unified `createOrder` receipt is on `order.info`. Consumer path is **IOC**.
- Claims: `listBinaryMarkets({ venueId, status: "Finalized" })` then `trader.redeem`. Void → both outcomes; resolved → winner only; skip zero balance and losers.

## Deep modules (build first, TDD)

1. **Grid** — snap price to tick, size to lot; reject zero lots.
2. **Lifecycle** — is the Window callable (Trading + expiry headroom scaled to `intervalSec`)?
3. **CallTicket** — stake + implied price → contract count, max loss, payout-if-right.
4. **ClaimPlan** — from on-chain resolved/voided + balances → list of redeems (no gas on losers).
5. **WalletGate** — disconnected → wrong network → needs collateral approve → ready.
6. **RevertCopy** — decoded revert / wallet reject → one human sentence.
7. **ExchangeAdapter** — the only module that talks to `SomniaMarkets`. Domain modules stay SDK-free.

## UI

Signature: a two-sided **Call** slip (Up | Down) with a countdown to lock, the **Line**, live index if available, implied %, and stake in tUSDC. *(Shipped as the light "paper ledger" theme — same composition.)* Advanced book is a drawer.

Four-state onchain button per frontend-ux: Connect / Switch to Shannon / Approve tUSDC / Call Up|Down. Per-action pending until **receipt**.

## Out of this plan

Custom Solidity, mainnet funds in the judged demo, HTTP spot API, social graph, session-key agent (stretch after Claim works).

## Build order

1. Domain tests → implementation (vertical slices).
2. Vite app + wagmi Shannon + ExchangeAdapter (read-only Window card).
3. Faucet + approve + IOC Call.
4. Exit + open-order visibility.
5. Claim-all + oracle link + volume + series strip.
6. Polish, README, SDK feedback note, AGENTS.md per directory.

## Iteration

After each slice: `npm test`, architecture deletion-test on new modules, fix. No sleep-loop until the app boots; then keep tightening UX and tests until the demo path is deterministic on Shannon.
