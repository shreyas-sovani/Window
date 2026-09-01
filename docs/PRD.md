# PRD — Window Duel

Status: `built; live-evidence pending`
Owner: Window product
Network: Somnia Shannon (50312)
Last truth pass: 2026-09-01

## Product in one sentence

Turn a filled dreamDEX Event Contract Call into a shareable wallet challenge: two opposite fills on one Window, one public Line, and a winner reconstructed from the fill tape and finalized market.

## Problem

DreamDEX exposes real short-duration binary markets, but its exchange-shaped experience asks a consumer to think like a market maker. A trader with a ten-tUSDC opinion wants three things instead: a legible Up/Down decision, a reason to bring another person into the market, and proof of who won without trusting Window as referee.

The social layer is the larger opportunity. Crypto calls already happen in chats, but screenshots are weak evidence and informal bets require custody or trust. Window turns the existing market itself into the neutral settlement layer.

## Target user

The primary user is a crypto-native retail trader who shares short-horizon BTC/ETH calls with friends or a group chat. They have an injected wallet, can use a testnet faucet, and understand signing a transaction, but should not need to understand outcome-token symbols, tick grids, CLOB order types, or claim scans.

Secondary users are hackathon judges and ecosystem developers evaluating whether dreamDEX Event Contracts can support consumer products beyond its native exchange UI.

## Value proposition

- **Consumer legibility:** one Line, countdown, stake, and Up/Down decision.
- **Social distribution:** every verified fill can become a challenge link; the recipient sees the proof and one gated next action.
- **Trust-minimized result:** URL data is only a locator. Fill ownership, side, size, transactions, and settlement are read back from Shannon/indexer data; contradictions fail closed.
- **No new trust surface:** no Window account, custody, backend referee, analytics identity, or custom contract.
- **Ecosystem value:** one social invitation can create a second independent IOC take and therefore real dreamDEX volume.

## Product truth and boundaries

A duel is a social composition over two independent dreamDEX book takes. Opponents are not each other's exchange counterparties, stakes may differ, and there is no matched pot. The accepting wallet's exact tape-verified transaction completes the proof URL; Window never guesses social intent from another wallet's chronological activity on a public market. A link cannot promise liquidity or a fill.

Window may call this a duel or challenge, but must never imply peer-to-peer escrow, a guaranteed opponent, or a matched wager. A submitted transaction is not a receipt. One fill is not a duel. An unresolved Window has no winner. A Void is a draw.

## Core journey

1. The visitor sees the best currently callable BTC/ETH Window with its Line, depleting lock ring, live odds, market-health signal, and bounded Risk → Win quote.
2. The single onboarding action advances through connect → Shannon → gas → tUSDC → bounded approval → Call.
3. The wallet sends an IOC take. Window re-reads the wallet tape with bounded retries. Only a verified fill creates a receipt and challenge URL.
4. Another wallet opens the URL. The exact Window and challenger fill are re-verified. One CTA advances prerequisites and then offers only the opposite Call.
5. After the opposite Call verifies, Window appends its exact transaction as `&a=…` and exposes a shareable verified-duel URL. Only that named transaction can complete the duel; unrelated opposite fills are ignored.
6. The open duel shows both wallets, both transaction proofs, sides, odds, and unequal stakes.
7. A finalized market result settles the view. The winner's filled side must match settlement. Claims remain explicit and fee-aware.
8. A judge can reconstruct a completed duel from `marketId + two tx hashes`; settlement is read from the finalized market and every mismatch refuses reconstruction.

## Acceptance criteria

- The product purpose is understandable from the landing hero without opening docs.
- A disconnected challenge recipient sees exactly one next action, never an enabled trade button that silently does nothing.
- Up buys use the YES ask; Down buys use `1 - YES bid`; Up exits use the YES bid; Down exits use `1 - YES ask`. Missing required liquidity disables only that side.
- Wallet identity comparisons are case-insensitive and self-accept is determined from the verified fill owner, not the current viewer.
- A challenge without `&a=` stays pending even if unrelated wallets trade the opposite side; an invalid named accept transaction is refused.
- Replay rejects non-finalized markets, missing market ownership, unknown wallets/sides, same-wallet or same-side legs, and inconsistent transaction rows.
- Indexer failure and confirmed no-fill are different user states; neither creates a receipt or challenge.
- Stake input outside token precision or safe numeric bounds disables execution without throwing.
- Default tests are deterministic and do not hit the live indexer. Optional Shannon smoke checks remain separate.
- The judged submission includes a deployed URL, a short recording, and one real two-wallet Shannon proof tuple. Until supplied, those are explicit external blockers—not fabricated evidence.

## Implementation decisions

- Vite, React 19, TypeScript, wagmi, viem, and `@somnia-chain/markets-sdk` ≥ 0.28.1.
- Zero custom Solidity (ADR-0001). Event Contracts use the SDK only; the HTTP API is spot-only (ADR-0002).
- Pure `src/domain` logic stays SDK-free behind `ExchangePort` (ADR-0003).
- Market state is keyed by `marketId`; pool addresses may recycle.
- Calls and exits are IOC with protective limits. Post-only Rest stays an advanced action.
- The browser wallet signs every write. No private key enters the bundle.
- `LiveWindow.result` is adapter-owned settlement data. Replay users never choose an outcome.
- No product analytics. No claim of traction without measured evidence.

## Non-goals

Custom markets, proprietary settlement, a peer-to-peer escrow pot, guaranteed matching, custodial balances, social accounts, points/leaderboards without real users, copy trading, mainnet funds in the judged demo, or an automatic roll bot without an SDK-supported binary operator path.

## Judge-facing evidence

See `docs/JUDGING.md` for the criterion-to-evidence map and `docs/DEMO.md` for the 2–5 minute flow. Source-of-truth implementation details live in the nearest `AGENTS.md` and must be checked against code.
