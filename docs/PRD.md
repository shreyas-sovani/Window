# PRD — Window

Status: `needs-triage`
Owner: Window product
Network: Somnia Shannon (50312) for the judged prototype
Sources: dreamDEX + Somnia GitBook MCP, CONTEXT.md, docs/PLAN.md

## Problem Statement

I have a view on the next 15 minutes of BTC or ETH, but dreamDEX Event Contracts look like an exchange. I do not want to manage an order book. I want to Call Up or Down against the Window's opening Line, know what I can lose, and get paid without hunting settled markets — because winnings do not appear in the live list and do not auto-redeem.

## Solution

Window is a one-screen Call terminal. I pick BTC or ETH and a cadence, see the live Line, implied odds, countdown, and volume, stake tUSDC on Up or Down with an IOC take, can exit while Trading, and Claim everything that is Finalized in one action. Settlement is explained with the public oracle receipt. I never sign a transaction until the app has switched me to Shannon and approved collateral.

## User Stories

1. As a first-time visitor, I want the live BTC 15m Window on the homepage, so that I understand the product without connecting a wallet.
2. As a visitor, I want the Line, countdown, implied Up %, and volume visible, so that I can decide without opening dreamDEX.
3. As a visitor, I want Up and Down shown as two sides of one Call, so that I am not asked to pick YES tokens or tick sizes.
4. As a visitor, I want to switch asset (BTC/ETH) and cadence (15m/1h), so that I can Call the Window I care about.
5. As a visitor, I want Windows that are not Trading labelled Locked/Resolved/Voided, so that I do not click a dead market.
6. As a visitor, I want a Window with too little time left to disable new Calls, so that my order does not lock mid-flight.
7. As a visitor, I want typed `asset` and `intervalSec` labels, not parsed question text, so that copy changes in the protocol do not break the UI.
8. As a visitor, I want volume from the market row, so that I can see activity the official app does not yet show.
9. As a disconnected user, I want the primary action to say Connect wallet, so that I know what to do next.
10. As a connected user on the wrong chain, I want Switch to Shannon, so that I do not send a tx that fails or hits the wrong venue.
11. As a Shannon user with no STT, I want a faucet link to testnet.somnia.network, so that I can pay gas.
12. As a Shannon user with no tUSDC, I want Mint test collateral, so that I can Call without leaving the app (`trader.faucet`, cap 10,000).
13. As a Shannon user with tUSDC and no allowance, I want Approve tUSDC as the only primary action, so that I cannot Call before the pool can pull funds.
14. As a ready user, I want to enter a stake in tUSDC, so that I think in dollars not contracts.
15. As a ready user, I want to see contracts, max loss, and payout if I am right before I sign, so that the 0.60 → 100 contracts example is explicit.
16. As a ready user, I want Call Up and Call Down as separate pending buttons, so that I cannot double-submit or mix labels.
17. As a ready user, I want the Call to be IOC, so that leftover size does not rest with my collateral escrowed.
18. As a ready user, I want the app to skip the order if lot size rounds to zero, so that I do not send an empty order.
19. As a ready user, I want prices on the tick grid, so that the pool does not revert InvalidPrice.
20. As a ready user, I want a balance check before sign, so that I do not burn gas on ERC20InsufficientBalance loops.
21. As a ready user, I want on-chain status re-checked immediately before the Call, so that a just-Locked Window is refused.
22. As a user in a pending Call, I want the button disabled until the receipt, so that I cannot click twice.
23. As a user whose wallet rejects, I want a human error and the button unlocked, so that I can try again.
24. As a user whose Call reverts, I want RevertCopy not a selector, so that I know whether it was Locked, size, or funds.
25. As a user with a fill, I want my Call shown as side, contracts, avg price, and max remaining loss, so that I know where I stand.
26. As a user with a Call while Trading, I want Exit at the live price (IOC sell), so that I can leave early.
27. As a user with open orders, I want them listed and cancellable, so that escrow is never invisible.
28. As a user after lock, I want a waiting state, so that I am not offered a new Call on a Locked Window.
29. As a user after resolve, I want Claim as the primary action, so that I do not miss winnings.
30. As a winner, I want redeem of the winning outcome only, so that I do not spend gas redeeming a loser that pays 0.
31. As a holder on a Voided Window, I want both sides redeemed at 0.5, so that I recover collateral.
32. As a user with many rolled Windows, I want Claim all to scan Finalized markets, so that `loadMarkets()` skipping them cannot hide funds.
33. As a user, I want Claim to key by marketId, so that recycled pools do not mix positions.
34. As a user, I want an oracle receipt link for the settled Window, so that I can audit the Line vs close.
35. As a user, I want series history for the same asset and cadence, so that I see how recent Windows settled.
36. As a user, I want my series P&L across Claims, so that rolling 15m markets feel like one product.
37. As a user, I want explorer links for my address and tx hashes on Shannon explorer, so that I can prove the Call on-chain.
38. As a user, I want truncated address with copy, so that I can confirm the connected account.
39. As a user, I want amounts in human tUSDC, never raw 6-decimal integers.
40. As a user, I want venue-filtered markets only, so that I do not Call a different venue in the same indexer.
41. As a returning user, I want the successor Window after expiry, so that I can Call the next interval without refresh hacks.
42. As a developer, I want env-based indexer/RPC with documented defaults, so that I can point at Shannon without code edits.
43. As a judge, I want a README with the problem, Event Contract usage, testnet steps, and demo path, so that I can run the prototype.
44. As a judge, I want a working Shannon prototype, so that the submission is not a mock.
45. As a power user, I want an advanced drawer with the book, so that I can see depth without making the homepage a blotter.
46. As a power user, I want post-only quoting out of the default path, so that resting is a deliberate choice.
47. As an agent engineer (stretch), I want an operator session key that can place/cancel but not withdraw, so that a roll-bot cannot steal funds.
48. As a user on a crashed tab, I want order expiry set, so that a stale order ages off.
49. As a user, I want no infinite ERC-20 approval, so that allowance matches what I intend to Call.
50. As a user, I want empty, error, and no-liquidity states with a next action, so that a thin testnet book is not a blank screen.
51. As a user, I want live updates without a refresh, so that odds and countdown stay true.
52. As a maintainer, I want domain logic testable without the SDK, so that tick/claim bugs are caught offline.

## Implementation Decisions

- Zero custom Solidity. Use dreamDEX Event Contracts as deployed.
- App stack: Vite, React 19, TypeScript, wagmi, viem, `@somnia-chain/markets-sdk` ≥ 0.28.1, Vitest.
- Shannon 50312 is the default network. Mainnet 5031 is config-gated, not the demo.
- Collateral scale is read from the token `decimals()`, not a network if-statement alone.
- **Grid**, **Lifecycle**, **CallTicket**, **Call session**, **ClaimPlan**, **WalletGate**, **RevertCopy**, **Cadence** are deep modules with small interfaces; tests hit those interfaces only.
- **ExchangeAdapter** is the sole SDK seam. A second adapter (fake) exists for tests — that is what makes the seam real.
- Consumer Call is unified `createOrder` with `timeInForce: "IOC"`. Receipt from `order.info`. Call session re-reads `getMarketOnchain` immediately before the write.
- Live odds prefer SDK `useLiveBinaryOrderBookByMarket` (keyed by `marketId` because pools recycle) and fall back to `fetchOrderBook`.
- Claims use `trader.redeem` with explicit `outcomeIdx`. Series history uses `listPastBinaryMarkets({ status: "Finalized" })`.
- WalletClient in the browser; never load `.env` private keys into the frontend.
- RPC primary: `https://api.infra.testnet.somnia.network/`. Fallback: `https://dream-rpc.somnia.network`.
- Indexer: `https://dev.smk.somnia.host/v1/graphql`. WS: `wss://api.infra.testnet.somnia.network/ws`.
- `venueId` is discovered from live binary rows, with an optional env override.
- License: MIT.
- No product analytics.

## Testing Decisions

A good test describes observable behavior through the module interface and still passes if internals are rewritten.

Test these modules: Grid, Lifecycle, CallTicket, Call session, Claim session, Window board, ClaimPlan, WalletGate, RevertCopy, Cadence, fake ExchangeAdapter.

Do not mock internal helpers. ExchangeAdapter tests use a fake adapter that returns fixtures, not a live indexer, in unit runs. Optional Shannon smoke is `scripts/list-windows.ts`, not the default `npm test`.

Prior art: none in this repo; this is the first suite.

## Out of Scope

Custom markets, spot HTTP trading, perps, mainnet judged demo, custodial balances, email/social login, mobile apps, points, copy-trading, session-key agent until Claim is production-grade.

## Further Notes

Hackathon: working Shannon prototype, public GitHub, optional SDK/docs feedback. Official Event Contracts UI: https://app.dreamdex.io/event-contracts. Volume is on-chain and missing from that UI — Window should show it.
