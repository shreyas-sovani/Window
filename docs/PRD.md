# PRD — Window Duel

Status: `built; live-evidence pending`
Owner: Window product
Network: Somnia Shannon (50312)
Last truth pass: 2026-09-06

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
3. The wallet sends an IOC take. Window re-reads the wallet tape with bounded retries. Only a verified fill creates a receipt and challenge URL; naming an opponent addresses the link, and no link is minted while the opposite side has no executable depth.
4. Another wallet opens the URL. The exact Window and challenger fill are re-verified. One CTA advances prerequisites and then offers only the opposite Call as a FOK take (whole stake or nothing); an addressed link only lets the named wallet accept, a fill below the challenge floor is refused as an undershoot, and the invite closes after Call headroom from the challenger fill (a later fill is not an accept).
5. After the opposite Call verifies, Window appends its exact transaction as `&a=…` and exposes a shareable verified-duel URL. Only that named transaction can complete the duel; unrelated opposite fills are ignored.
6. The open duel shows both wallets, both transaction proofs, sides, odds, and unequal stakes.
7. A finalized market result settles the view. The winner's filled side must match settlement. Claims remain explicit and fee-aware.
8. A judge can reconstruct a completed duel from `marketId + two tx hashes`; settlement is read from the finalized market and every mismatch refuses reconstruction.

## Acceptance criteria

- The product purpose is understandable from the landing hero without opening docs.
- A disconnected challenge recipient sees exactly one next action, never an enabled trade button that silently does nothing.
- Up buys use the YES ask; Down buys use `1 - YES bid`; Up exits use the YES bid; Down exits use `1 - YES ask`. Missing required liquidity disables only that side.
- Wallet identity comparisons are case-insensitive and self-accept is determined from the verified fill owner, not the current viewer.
- A challenge without `&a=` stays pending even if unrelated wallets trade the opposite side; an invalid named accept transaction is refused. A wrong wallet cannot accept an addressed challenge, a below-floor fill is not an accept, and the settled/void result drives Claim and the successor rematch for the owed participant.
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

## Demo mode (labeled simulation, never evidence)

**Problem it solves.** The Shannon indexer has trailed chain head by minutes-to-hours across live sessions, stalling fill verification and demo-recordings through no fault of the app. A submission recording must not depend on third-party indexer health.

**What it is.** A frontend switch — **"Switch to demo mode"** (also `#/app?demo=1`) — that runs the *entire real product* against a third adapter on the same `ExchangePort` (`demo.ts` over `demo-universe.ts`, built on the deterministic fake the test suite runs), driven by a market derived from the wall clock:

- Every selectable cadence has a live Window (2.5–6 minutes each, callable for two thirds of that) on a genuine six-level two-sided ladder — ~2,700 tUSDC executable per side — so Calls, exits, quotes, health, odds, and a walked average all behave. Anonymous colour arrives on the pool tape as the Window runs; settlement is deterministic per `marketId`; claims are account-scoped.
- Challenge links are self-contained (`&demo=1&s=…` carries the fills), so a second tab or a phone joins the duel from the URL alone — the real two-wallet distribution path, with no server.
- **Demo opponent accepts** is an explicit control, not a timer: the second demo identity takes the opposite side on request, its fill is verified on the demo tape like any other, and the completed proof URL still names its exact transaction. That is what lets the full lifecycle (challenge → open → settle → winner → Claim → Rematch) record in one browser.
- A simulated wallet (wagmi `mock` connector) so the connect/approve gates demonstrate honestly without a real wallet; gas and collateral are granted locally because the reads would query a simulated address.

**Honesty rules (non-negotiable):**

1. Every screen in demo mode carries a persistent **Demo mode — simulated market, not Shannon** badge; receipts, duel views, and banners render a DEMO mark.
2. Demo challenge links carry an explicit demo marker (`#/app?demo=1&d=…`) and only resolve in demo mode; they never masquerade as Shannon proofs.
3. Demo data never touches the indexer, the chain, or the real adapter; leaving demo mode returns to Shannon unchanged.
4. `docs/VERIFICATION.md` and the submission text say plainly which evidence is the labeled demo and which is the real Shannon proof tuple. Demo mode is a recording aid, not a substitute for the live prototype.

**Why this is not "fake demo data."** The earlier rejection (W-077 era) targeted unlabeled seeded UI posing as live. Demo mode is the opposite: the real product unmodified, on its real second adapter, explicitly labeled as simulation — the same distinction the test suite has always drawn.

## Judge-facing evidence

See `docs/JUDGING.md` for the criterion-to-evidence map and `docs/DEMO.md` for the 2–5 minute flow. Source-of-truth implementation details live in the nearest `AGENTS.md` and must be checked against code.
