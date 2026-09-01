# Window Duel — 2–5 minute judge demo

Product sentence: **Make a Call, challenge another wallet, and prove who won from two fills plus the finalized Window.**

## Preflight — do this before judging

- Deploy the reviewed commit to a public HTTPS URL.
- Prepare two Shannon wallets in separate browser profiles. Both need STT and tUSDC.
- Open the landing page in both profiles at least 15 seconds before the demo so the SDK market registry is warm; a cold direct terminal/challenge entry can take 10–15 seconds on Shannon.
- Complete one earlier duel and record its finalized `marketId`, challenger fill tx, and opponent fill tx.
- Build the replay URL: `#/docs?m=<marketId>&a=<firstTx>&b=<secondTx>`.
- Pick a live Window with enough headroom and an executable quote. Venues roll independently; use the best-badged cadence rather than assuming 15m.
- Keep Shannon explorer tabs for both proof transactions ready.

The repository intentionally does not contain invented proof values. Until the three real identifiers above exist, the submission has a live-evidence blocker.

## Primary flow — about 2:30

### 0:00 — Hook

Start at `#/` over the two-fill hero.

> Crypto calls live in group chats, but screenshots are weak evidence and informal bets need trust. Window turns a real dreamDEX fill into a wallet challenge. Two opposite fills, one market, and the chain proves who won.

Open the live Window.

### 0:20 — Show the consumer abstraction

Point to the question, Line, depleting lock ring, odds, stake presets, Risk → Win, and Book health.

> DreamDEX is the execution venue. Window removes outcome-token symbols, tick grids, and claim hunting. No executable side means no Call; we never invent a 50% price.

The single next-action card should already be cleared in preflight. If not, let it demonstrate connect → Shannon → gas → tUSDC → bounded approval.

### 0:45 — Wallet A creates the challenge

Choose a stake and Call Up or Down. Sign once.

> Submission is not success. Window polls the wallet tape and only builds this receipt after the fill appears. An indexer outage and a confirmed no-fill are different states.

Open the receipt's challenge strip and copy the real `#/app?d=…` URL.

### 1:15 — Wallet B accepts

Open the link in profile B.

> The URL is only a locator. Window reads the exact market and challenger transaction back from the public tape. The recipient gets one next action and only the opposite side.

Set an unequal stake to make the independent-book-take model visible. Use the single CTA; complete any prerequisite it names, then Call the opposite side. Sign.

> These wallets are social opponents, not exchange counterparties. There is no pretend matched pot: both Calls are independent IOC takes against dreamDEX.

After the fill verifies, point out that the URL now contains `&a=<acceptTx>` and the **Share verified duel** strip appears. Copy this completed proof link.

> A busy public book may contain other opposite fills. Window never calls those “the opponent.” The completed URL names Wallet B's exact verified transaction, so anyone opening it sees the same two proofs.

When the pool tape refreshes, show the open duel with both wallets, sides, odds, stakes, and explorer links.

### 1:55 — The proof moment

Open the prepared replay link in one browser and click **Reconstruct the duel**.

> A judge supplies only the market and two transaction hashes. There is no outcome selector. Window requires a finalized market, exact market ownership on every fill row, two different wallets, and opposite sides. Then it names the winner from settlement.

Open both explorer links. If time permits, alter one hash and show the fail-closed refusal, then restore it.

### 2:25 — Close

> Zero custom contracts, zero custody, zero backend referee. This is a consumer and social distribution layer over dreamDEX Event Contracts on Somnia: one invitation can create a second real take, and every result is independently inspectable. The integration produced nine concrete SDK feedback items and 319 deterministic tests.

Show `docs/JUDGING.md` only if a judge asks for the evidence map.

## Live-settlement extension — up to 5 minutes

If a short live Window finalizes during the demo, return to either challenge URL and show the settled result directly, then Claim or trigger the caller's Rematch on the successor. Do not wait silently for settlement; the prepared replay is the deterministic proof beat.

## Honest fallbacks

- **No callable Window:** use the `best` cadence. Explain that two venues roll independently.
- **Locking:** choose another series. New Calls intentionally close during headroom; Exit remains available until lock.
- **Empty side:** show its disabled reason and choose a liquid Window. Do not claim a fill.
- **Wallet A opens its own challenge:** the CTA says to use another wallet and stays disabled.
- **Broken/tampered link:** show the refusal. Chain data outranks URL fields.
- **Unrelated opposite fill:** the original challenge remains pending. Only the accepting wallet's exact verified transaction can complete the proof URL.
- **Indexer unavailable after a tx:** show the explorer transaction and the “could not verify yet” state. Do not call it unfilled.
- **Live duel misses settlement:** finish with the prepared finalized replay, which reads the result itself.
