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

## Demo mode — the indexer-independent recording path

If the Shannon indexer is lagging (it has trailed chain head by minutes-to-hours), record the flow beats in **demo mode** instead of stalling on camera:

- Enter it from the terminal's **Switch to demo mode** link, the landing's **Try demo mode**, or `#/app?demo=1`. Every screen carries the **Demo mode — simulated market, not Shannon** badge; duel views read **DEMO ·**.
- The market is derived from the wall clock, so every browser sees the same one. Every cadence chip has a live Window; each is compressed and callable for roughly its first two thirds:

| Chip | Window | Callable for | Invite stays open |
|---|---|---|---|
| 5m | 2:30 | 2:00 | 30s after your fill |
| 15m | 4:30 | 3:00 | 90s after your fill |
| 1h · 4h · 24h | 6:00 | 4:00 | 2:00 after your fill |

- Record the duel on **15m or 1h** — the 5m chip settles fastest but its invite closes in 30 seconds. The strip prints **Invite closes in m:ss** while it is live; a link shared after that is honestly refused, so glance at it before you paste.
- The book is real depth, not a quote: six levels a side, a 1-point spread, ~2,700 tUSDC executable per side. Big Calls pay a worse average than small ones, the Book cell grades **Strong**, and the drawer lists the ladder. Anonymous market colour keeps landing on the public tape while you talk.
- The simulated wallet does not auto-connect: walk **connect → approve → Call** on camera (gas and mint are already satisfied in demo).
- Two ways to shoot the duel:
  1. **Two tabs (the real distribution path).** Challenge links are self-contained — `#/app?d=…&demo=1&s=…` carries the challenger's fill — so a second tab (or a phone) hydrates the duel from the URL alone, takes the other demo identity, and accepts. Its URL then publishes `&a=<acceptTx>` as the completed proof.
  2. **One browser.** Press **Demo opponent accepts** on the challenge strip: the second demo wallet takes the opposite side, the fill is verified on the demo tape like any other, and the same completed URL appears. Nothing accepts on a timer — you press it when the story needs it.
- Then wait out the Window: settlement is deterministic from the marketId, the result names a winner, and **only the winning wallet** is offered the Claim.
- The script below plays beat-for-beat — substitute "demo mode" where it says Shannon, and say so in the voiceover. Record the live replay (`#/docs?m&a&b`) from the real proof tuple as the evidence beat; demo mode is the flow beat, never the proof beat.

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

Open the receipt's challenge strip, name the opponent wallet (the link is then addressed — only that wallet can accept), and **Share** the real `#/app?d=…` URL into a chat (native share sheet, clipboard fallback). The minted link floors the accept at the challenger's stake and closes the invite after the Window's Call headroom from the fill — do not sit on the link.

### 1:15 — Wallet B accepts

Open the link in profile B.

> The URL is only a locator. Window reads the exact market and challenger transaction back from the public tape. The recipient gets one next action and only the opposite side.

Set a higher stake to make the independent-book-take model visible (equal-or-higher is accepted; lower is refused as an undershoot). Use the single CTA; complete any prerequisite it names, then Call the opposite side. Sign — the accept is a FOK take, so it fills whole or not at all.

> These wallets are social opponents, not exchange counterparties. There is no pretend matched pot: both Calls are independent IOC takes against dreamDEX.

After the fill verifies, point out that the URL now contains `&a=<acceptTx>` and the **Share verified duel** strip appears. Share this completed proof link.

> A busy public book may contain other opposite fills. Window never calls those “the opponent.” The completed URL names Wallet B's exact verified transaction, so anyone opening it sees the same two proofs.

When the pool tape refreshes, show the open duel with both wallets, sides, odds, stakes, and explorer links.

### 1:55 — The proof moment

Open the prepared replay link in one browser and click **Reconstruct the duel**.

> A judge supplies only the market and two transaction hashes. There is no outcome selector. Window requires a finalized market, exact market ownership on every fill row, two different wallets, and opposite sides. Then it names the winner from settlement.

Open both explorer links. If time permits, alter one hash and show the fail-closed refusal, then restore it.

### 2:25 — Close

> Zero custom contracts, zero custody, zero backend referee. This is a consumer and social distribution layer over dreamDEX Event Contracts on Somnia: one invitation can create a second real take, and every result is independently inspectable. The integration produced nine concrete SDK feedback items and 439 deterministic tests — `docs/VERIFICATION.md` maps every claim to its command.

Show `docs/JUDGING.md` only if a judge asks for the evidence map.

## Live-settlement extension — up to 5 minutes

If a short live Window finalizes during the demo, return to either challenge URL and show the settled result directly, then press Claim on the result, or press Rematch to re-challenge the same opponent on the successor Window (your side, their side, one new link). Do not wait silently for settlement; the prepared replay is the deterministic proof beat.

## Honest fallbacks

- **No callable Window:** use the `best` cadence. Explain that two venues roll independently.
- **Locking:** choose another series. New Calls intentionally close during headroom; Exit remains available until lock.
- **Empty side:** show its disabled reason and choose a liquid Window. Do not claim a fill.
- **Wallet A opens its own challenge:** the CTA says to use another wallet and stays disabled.
- **Broken/tampered link:** show the refusal. Chain data outranks URL fields.
- **Unrelated opposite fill:** the original challenge remains pending. Only the accepting wallet's exact verified transaction can complete the proof URL.
- **Indexer unavailable after a tx:** show the explorer transaction and the “could not verify yet” state. Do not call it unfilled.
- **Indexer lagging hard mid-recording:** switch to **demo mode** and finish the flow beats there, labeled.
- **Live duel misses settlement:** finish with the prepared finalized replay, which reads the result itself.
