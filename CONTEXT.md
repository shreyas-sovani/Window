# CONTEXT — Window

Domain glossary for this repo. Use these names in code, tests, PRDs, and AGENTS.md. Do not invent synonyms.

## Product

**Window** is a consumer Up/Down terminal for dreamDEX Event Contracts on Somnia. Three hash routes: landing (`#/`), docs (`#/docs`), terminal (`#/app`). The terminal is one live price window, not a CLOB blotter.

## Domain

- **Event Contract** — a binary Up/Down market on an asset (today BTC or ETH) over a fixed **Window**. Settled in venue collateral (testnet **tUSDC**, mainnet **USDso**).
- **Window** — one trading interval (5m, 15m, 1h, 4h, or 24h on Shannon today). Identified by `marketId` (bytes32) or outcome **symbol**, never by pool address.
- **Line** — the Window's opening price. Up wins if the close is at or above the Line; Down wins if it is below.
- **Call** — the user's stake on Up or Down. Default execution is an IOC take so leftover size does not rest with escrow locked.
- **Up / Down** — the two outcomes. Prices are Up probabilities in (0, 1). Down price is always `1 − Up`.
- **Complete set** — 1 collateral ⇄ 1 Up + 1 Down (`mintCompleteSet` / `mergeCompleteSet`). Needed to sell inventory; not needed to quote both sides (mint-a-pair crossing).
- **Claim** — redeem outcome tokens after the Window is **Finalized**. Winnings do not auto-pay. `loadMarkets()` cannot find settled Windows.
- **Venue** — a deployment namespace. Multiple venues share one indexer; always filter by `venueId` from a live market row.
- **Trading / Locked / Resolved / Voided** — on-chain lifecycle. Only **Trading (status 1)** accepts orders. Indexer status lags; gate writes on `getMarketOnchain`.
- **Void** — no reliable settlement price; both sides redeem at 0.5. There is no inferred winner.
- **Lot / Tick** — size and price grids on the pool. Sub-lot size floors to zero; skip the order. Derive decimals from collateral, never hardcode 6 vs 18.
- **Oracle receipt** — public resolution trail at `https://prd.oracle.somnia.host/questions/{oracleQuestionId}?view=graph`. Live Window keeps a ghost link; series history chips link the same graph when `PastWindow.oracleQuestionId` is present (indexer may omit it on older rows).
- **Call session** — prepare a Call or Exit from the live Window + book, then re-check on-chain Trading immediately before the IOC write.
- **Claim session** — scan Finalized Windows, apply ClaimPlan (void both sides, winner only, skip zero), then redeem. Newest-expired first; cap the scan so a long tail cannot hide recent winnings. Preview is unique Windows plus expected collateral (`readClaimSession`: winner fee-adjusted, void at half), not raw redeem intents. Copy names Windows and tUSDC (`claimSessionCopy` / `claimReceiptCopy`). A failed redeem does not abort the rest (`executeClaims` continues per Window; `failed` is how many did not finish). All-fail rethrows so RevertCopy can speak. Adapters skip per-market fee fetches on the 40-row scan — payout uses `feeBps` 0 unless passed (testnet venue fee is 0).
- **Window board** — the read model for the live series: live Window, implied Up, Call plans, WalletGate, thin-book and short-collateral flags. Prefers a **Stake quote** when the live book can fill the stake; otherwise sizes from the top of book. Wallet chrome and the Call ticket render it; they do not re-derive it.
- **Stake quote** — live-book size of a collateral stake: raw quantity, protective limit in the traded outcome's own terms, and escrow (max loss). Missing or below-lot quotes fall back to a single-ask Call plan so a cold watch does not disable Call.
- **Book drawer** — collapsed Up-book depth (bids/asks in human contracts). Down price is always `1 − Up`; do not render a four-sided blotter on the homepage.
- **Open ticket** — a resting order still on the book. The default Call is IOC so these should be rare; list and cancel them so escrow is never invisible.
- **Series history** — recently Finalized Windows for the same asset and cadence, including the Line (opening price when the indexer has it) and Up/Down/Void result. Chips with `oracleQuestionId` open the oracle graph. Missing Line is omitted, never invented.
- **Series record** — tally of those Finalized results (Up / Down / Void) plus which expiry settled last. This is the series scoreboard, not wallet money.
- **Wallet P&L** — avg-cost realized/unrealized from this wallet's fills and open positions, in collateral. Adapter maps SDK `getPortfolio` trades and `getOpenPositionsWithPnL`; domain only signs cashflow and formats copy. Not the Series record.
- **Settle preview** — collateral this Call pays if the live Window resolves Up, Down, or Void, from current outcome balances. Winner pays `amount × (10_000 − feeBps) / 10_000`; Void pays half on each side. `feeBps` comes from the venue fee row frozen at market creation (`getMarketFees`); missing plumbing is 0.
- **Cadence** — series length (60s / 5m / 15m / 1h / 4h / 24h). Indexer `intervalSec` is derived from expiry − start and can be a few seconds off; snap to the canonical cadence before matching. Display with `cadenceLabel` (never `intervalSec / 60` + `"m"`, which prints 24h as 1440m). The tote clock uses the same hour unit when more than an hour remains (`24h 00:00`, not `1440:00`).
- **Window phase** — what the tote shows for the current series row: Trading, Locking (inside expiry headroom — Calls closed, Exit still possible), Locked, Settling, Resolved, Voided. `pickWindow` keeps an unexpired Trading row through Locking, then falls back to a just-expired Locked/Settling row until the successor lists (not longer than one cadence). Call session still refuses new Calls.
- **Claim primary** — when the Claim session has at least one Window (`windows > 0`), the tote's primary chrome is Claim (`totePrimary` + `claimSessionCopy`: Windows · expected tUSDC), even if the successor Window is already Trading. Connect and switch still precede Claim. tUSDC approve is not required to redeem. Call Up/Down stay available as secondary when the successor is callable.
- **Stake allowance** — ERC-20 `approve` for this Call is exactly the stake (`approveAmount`). Zero stake does not approve. Never max-uint and never a 10_000 tUSDC fallback.
- **Explorer proof** — Shannon explorer URL for a write (`explorerTx`) or the connected address (`explorerAddress`). Call, Exit, Rest, cancel (Open ticket), approve, Claim (last redeem), and faucet toasts carry the hash. `shorten` truncates 12+ char hashes; shorter values (and empty) stay as-is or `—`, never doubled. WalletBar and the P&L tape already link address and fills. Not the Oracle receipt.
- **Rest quote** — post-only bid sized like a Call but priced at the bid (`restLimit`: Up = bid, Down = 1 − ask). Lives in the Book drawer. Default Call stays IOC. A crossed book is `would-take`; a missing bid is `no-rest`. Escrow stays until fill or cancel (Open ticket).
- **Series P&L** — Wallet P&L filtered to the selected series (asset + cadence, snapped). Lives on the history strip. Not the Series record (that is Up/Down/Void tally, not money).
- **Board notice** — one empty / error / thin-book / short-collateral message with a next action (Retry, Switch series, Mint tUSDC). Load errors beat missing Windows; short collateral beats a thin book.
- **Crash notice** — render-error fallback (`crashNotice`) with Retry. First line of the message only; never a stack. Positions stay on-chain. Not Board notice (that is indexer/wallet empty states).
- **RevertCopy** — human sentence for a failed write. Maps pool selectors and Call-path throws (`below-lot`, not Trading, SignerRequired, on-chain revert). Never dump a selector.
- **Pulse** — live read of the selected series: underlying price spark, implied Up spark, last-window outcome bars, and the public tape (explorer-linked). Ready as soon as any of those has data (`pulseReady`) — series history bars are enough; do not hide them behind "Collecting ticks…". Tape query keys by `marketId`, never pool. Not Wallet P&L (that tape is this wallet's fills).

## Non-domain (do not mix in)

- Spot CLOB HTTP API (`api.dreamdex.io`) has **no** Event Contract endpoints.
- Pool address is a recycled binding, not an identity.
- Question text is not a stable parser target; use `asset` and `intervalSec`.

## Sources of truth

- dreamDEX Event Contracts: https://docs.dreamdex.io/developers/event-contracts
- Somnia networks: https://docs.somnia.network/developer/network-info
- SDK: `@somnia-chain/markets-sdk` ≥ 0.28.0 (pin ≥ 0.28.1)
