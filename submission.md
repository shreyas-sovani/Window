<!-- DORA HACKS — Describe your BUIDL. Paste this body into the form. -->
<!-- 1) Drop the 480×480 logo in the block below (toolbar → image, or ![](logo.png)). -->
<!-- Replace REPLACE_WITH_LIVE_URL before you publish. YouTube is already live. -->

<p align="center">

<img src="docs/brand/logo.png" alt="Window Duel" width="168" />

</p>

# Window Duel

**Make a Call. Challenge another wallet. Prove who won.**

Two opposite fills. One Window. The chain names the winner.

This is not another trading terminal. This is the missing consumer and social layer for dreamDEX Event Contracts on Somnia Shannon — the product that turns a group-chat call into a second real take on a live market, with **zero custom contracts, zero custody, and zero backend referee**.

**Demo video:** https://www.youtube.com/watch?v=AxVN8ameNo0

**Live deployment:** REPLACE_WITH_LIVE_URL

**Repository:** https://github.com/shreyas-sovani/Window

---

## Why this is exactly what this brief asked for

dreamDEX already has the book. Somnia already has the chain. What neither has is a reason for a normal person to bring a second person into the market.

That is the entire product.

Crypto already runs short-horizon BTC and ETH calls in Telegram, Discord, and group chats. Today those calls die as screenshots. Informal bets need a trusted friend or a custodial pot. The exchange UI asks *price, size, tick, lot, outcome token, claim scan*. The person with ten dollars and a view walks away.

**Window Duel sits in the hole between those two worlds.** One Up/Down decision. One shareable challenge. One independently inspectable result. The venue gets a second fill it would never have seen. The chat gets proof instead of a JPEG.

That market is not crowded. It is empty. The CLOB is built. The social layer is not. We built the social layer.

---

## The super use case

A wallet Calls Up on a live Window. The fill is verified. That fill becomes a link you drop into a chat.

The recipient does not trust you. They do not trust us. They open the link and see **your exact transaction** on the public tape. They get one next action: the opposite side, whole or nothing. When the Window finalizes, two fills plus the market result name a winner. Only the winner Claims.

That loop is the superpower:

- **Distribution.** One invitation is an attempt at a second real IOC take on the same Window. Volume is fills, not links sent.
- **Legibility.** Outcome tokens, tick grids, and claim hunting disappear. The user sees a question, a Line, a countdown, Risk → Win.
- **Proof.** Anyone can reconstruct the duel from a marketId and two hashes. There is no outcome picker. Settlement is read, not chosen.

This is how Event Contracts leave the exchange and enter the chat — without a new trust surface.

---

## What no competitor is doing

Rebuild the CLOB and you have added nothing. Ship a custom escrow pot and you have added a contract the brief did not need. Ship a screenshot and you have added zero proof.

| Everyone else | Window Duel |
|---|---|
| Exchange UI: trade the book | Consumer UI: Call Up or Down |
| Prediction market: new contracts, new custody | **Zero Solidity of ours.** dreamDEX is the venue |
| P2P bet: matched pot, trusted middle | **Independent takes.** Social opponents, not counterparties |
| Chat call: screenshot | **Portable proof.** Two named txs + finalized market |
| “The app decided who won” | **The tape decides.** URL is a locator. Tamper it and the chain wins |

We do not match a pot. We do not invent a 50% price. We do not guess the opponent from whoever traded the other side. We do not mint a challenge until a fill is witnessed. We do not let an undershoot pose as an accept. We do not let you pick the winner.

That is not polish. That is the product other teams will not ship because it is harder than a demo that lies.

---

## How robust this is

This is not a weekend wrapper around a happy path.

- **448 deterministic tests**, fully offline. CI from a clean install. Critical advisories rejected.
- **One domain, three adapters.** Live Shannon, in-memory fake for CI, labeled demo universe for recording. The rules cannot import the SDK. Divergence is structurally illegal.
- **Fail-closed by design.** Malformed link: refused. Wrong wallet on an addressed challenge: refused. Fill that is not the named tx: refused. Same wallet both sides: refused. Same-side fills: refused. Empty book: no Call. Partial accept: FOK, whole or nothing. Floor edited downward in the URL: the tape floor still binds.
- **Chain over indexer.** The Call’s own transaction receipt is decoded on the spot (ERC-20 net collateral + ERC-6901 outcome legs). Receipts do not wait for a lagging indexer. Hung reads deadline out. A confirmed no-fill and an unavailable tape are different states. Neither becomes a fake win.
- **Adversarial on purpose.** Invite TTL. Named opponent. Stake floor. Verifying state while proofs load — never a refusal we have no evidence for. Winner-only Claim. Successor rematch of the same opponent.
- **Nine evidence-backed SDK findings** from actually integrating Event Contracts, not from reading the docs. Field report, not a tourism visit.

If it can lie, it is a bug. If it cannot be proven, it is not a duel.

---

## How innovative this is

The innovation is not “we drew buttons on a book.”

The innovation is **composing public market fills into a social object** that is still fully on-chain:

1. A verified fill mints a versioned locator (`#/app?d=…`), not a certificate.
2. The accept is a **fill-or-kill** take on the opposite side of the same `marketId`.
3. The completed URL names **both** transactions. Public chronology is never treated as consent.
4. A judge supplies only a marketId and two hashes. Window reconstructs wallets, sides, sizes, and the winner from settlement. **No outcome input exists.**

That is a new primitive for this venue: the **wallet challenge**, as native to a group chat as a link, as serious as a fill.

We also refused the fake innovation: a custom duel contract, a custodial pot, a points farm, a bot that signs without a human. Those would have been easier. They would have been a different, worse product.

---

## Architecture

Two humans. One market. Three adapters. Zero of our contracts.

```
   WALLET A                         THE WINDOW                        WALLET B
   Call UP  ── IOC ──►         dreamDEX Event Contract        ◄── FOK ──  Call DOWN
                                 one marketId · one Line
        │                                                                  │
        └──── share #/app?d= locator (never a proof) ──────────────────────┘
                                      │
                         two verified fills + finalized market
                                      │
                                 WINNER Claims


   ui  (#/  #/docs  #/app)     renders. owns no rules.
    │
    ▼
   domain                      SDK-free. 448 tests. the law.
    │
    ▼
   ExchangePort                one seam
    ├─ somnia                  live Shannon
    ├─ fake                    CI
    └─ demo                    labeled recording
    │
    ▼
   Somnia Shannon 50312        BinaryMarketsModule + pools
                               no contract of ours
```

The same duel logic that runs against Shannon is the logic that runs in CI and in the demo you will watch. That is how you know the recording is the product, not a slide.

---

## Watch it. Run it. Break it.

**Demo video:** https://www.youtube.com/watch?v=AxVN8ameNo0

**Live deployment:** REPLACE_WITH_LIVE_URL

Clone https://github.com/shreyas-sovani/Window

`npm install && npm test` — 448 tests, no chain required.

`npm run dev` then `#/app?demo=1` — Connect, Approve, Call Up, accept from the second wallet, wait the Window, Claim as the winner.

Open `#/docs` and try to fake a result. You cannot. Settlement is not an input.

The recording is labeled demo mode when the live book has no depth. That is the same honesty as the product: **no executable side, no Call.** We will not invent Shannon hashes to look busier than we are. Judges who want the real proof tuple will find it in the repo when it exists — or they will find the absence, named, instead of a lie.

---

## The line

Zero custom contracts. Zero custody. Zero referee.

One invitation. A second take. A winner the chain can name.

That is Window Duel. That is what this ecosystem did not have. That is what we shipped.
