<!-- PASTE FROM "# Window Duel" DOWN. Do not paste this comment.

Put https://www.youtube.com/watch?v=AxVN8ameNo0 in the DoraHacks Demo video field
(not again in the body). Upload docs/brand/logo.png with the image toolbar if the
hotlink does not render. Live app is https://window7.vercel.app/
-->

# Window Duel

![Window Duel](https://raw.githubusercontent.com/shreyas-sovani/Window/master/docs/brand/logo.png)

**Make a Call. Challenge a wallet. Prove who won.**

Two opposite fills. One Window. **The chain names the winner.**

The consumer + social layer for dreamDEX Event Contracts on Somnia Shannon.

No backend referee. No custody. **Not one line of custom Solidity.**

![448 tests](https://img.shields.io/badge/tests-448%20passing-2ea44f)
![build](https://img.shields.io/badge/build-green-2ea44f)
![zero contracts](https://img.shields.io/badge/custom%20contracts-zero-d9480f)
![no custody](https://img.shields.io/badge/custody-none-d9480f)
![Shannon](https://img.shields.io/badge/Somnia%20Shannon-50312-6f42c1)
![MIT](https://img.shields.io/badge/license-MIT-black)

| | |
|---|---|
| 🚀 Live app | https://window7.vercel.app/ |
| 📦 Repo | https://github.com/shreyas-sovani/Window |

---

## 📺 Demo

[![Window Duel — 3 minute demo](https://img.youtube.com/vi/AxVN8ameNo0/maxresdefault.jpg)](https://www.youtube.com/watch?v=AxVN8ameNo0)

Labeled **demo mode** — the full two-wallet loop on a simulated market.

Shannon had no executable depth. Empty book = no Call. We do not invent a 50% price.

---

## 🎯 What you get

A verified Up/Down fill becomes a **link you drop in a chat**.

Another wallet opens it. Takes the opposite side of the **same Window**.

When the Window settles, two public fills + the finalized market name the winner.

> 🛡️ **The trust boundary.** The URL is a locator, never evidence. Tamper any field — the tape wins. A submitted-but-unfilled tx earns no receipt, no challenge, no victory screen.

---

## 📡 Field report — 9 SDK findings

This is not a wrapper tour. Shipping Window Duel on `@somnia-chain/markets-sdk` produced **nine evidence-backed gaps** in the Event Contract surface. They are why a consumer app on this venue is hard — and why this repo is useful to the ecosystem, not just a UI.

| # | What we hit | Why it matters |
|---|---|---|
| 1 | `getOutcomeBalance` docs still show positional args | The typed API is an object. Copy-paste from recipes does not compile. |
| 2 | Indexer `intervalSec` can be 3598 on a 1h Window | Cadence filters miss live markets unless you snap to canonical intervals. |
| 3 | Recipes use a fixed 300s headroom | That kills entire 5-minute series. Headroom has to scale with the Window. |
| 4 | Two venues on one Shannon indexer | Pin venue from the first BTC row and 15m+ markets disappear. |
| 5 | `quoteBinaryStake` reads a cold watch cache | Quote before the first book snapshot and the ticket dies. Need a polled top-of-book fallback. |
| 6 | `getMarketFees` unit docs disagree with the client | “bpsTimes1k” vs standard bps. Wrong unit silently mis-prices Claims. |
| 7 | PnL folds fills by pool, not `marketId` | Recycled pools leak cost basis across successor Windows. |
| 8 | Unified `createOrder` cannot set a shorter TTL | Rests die at market expiry (good) but a shorter invite TTL still needs a raw trader call. |
| 9 | No binary `placeOrderFor` / session-key path | The pool has the ABI. The SDK and Bot Kit do not. A roll bot is not shippable without dropping under the SDK. |

Item 9 killed a feature we wanted. The rematch / roll companion keeps a human in the loop instead of faking a bot.

---

## 🏗️ Architecture

Two humans. One market. Three adapters. **Zero of our contracts.**

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

Same rules on Shannon, in CI, and in the recording. `domain/` cannot import the SDK. Divergence is illegal.

---

## ⚡ Judge it in five minutes

Live: https://window7.vercel.app/

No wallet. No funds. No gas.

| # | Do this | You just proved |
|---|---|---|
| 1 | Open https://window7.vercel.app/#/app?demo=1 | Labeled demo mode, real product, third adapter |
| 2 | Connect → Approve → **Call Up** → **Demo opponent accepts** | Full loop: fill → challenge → accept → settle → winner-only Claim |
| 3 | Open the minted link in a second tab | Self-contained locator. One action: the opposite side |
| 4 | Edit the payload. Reload | **Fail-closed.** Tape outranks the URL |
| 5 | Open `#/docs` and try to pick a winner | You can't. Settlement is read, not chosen |

---

## 🔥 Why this wins the brief

**📈 Volume the venue cannot create.** The CLOB asks *price and size*. We ask *up or down?* One invite = an attempt at a second real take on the same Window.

**🧭 Honest where products lie.** No book → no Call. No invented 50%. No receipt until the tape witnesses the fill. Verifying ≠ refused.

**🔒 Zero new trust.** Zero contracts. Zero custody. Zero server. Social opponents — not counterparties. A judge can verify a duel without this app.

---

## ⚔️ What no competitor is doing

| Everyone else | Window Duel |
|---|---|
| Exchange UI: trade the book | Consumer UI: Call Up or Down |
| Prediction market: new contracts, new custody | **Zero Solidity of ours.** dreamDEX is the venue |
| P2P bet: matched pot, trusted middle | **Independent takes.** Social opponents, not counterparties |
| Chat call: screenshot | **Portable proof.** Two named txs + finalized market |
| “The app decided who won” | **The tape decides.** URL is a locator |

The CLOB is built. The social layer is not. We built the social layer.

---

## ⚔️ The duel

| Step | Move | Honest rule |
|---|---|---|
| Call | Stake. `Risk X → Win Y`. Live book | No book, no Call |
| Verify | Decode the tx receipt on the spot | Chain first. Indexer is backup |
| Challenge | Mint `#/app?d=…` — named, floored, short-lived | Only a witnessed fill mints a link |
| Accept | Opposite side. **FOK** | Whole stake or nothing |
| Resolve | URL grows `&a=<acceptTx>` | Unrelated opposite fills never count |
| Claim | Winner only. Rematch on the successor | Void = draw. Loser is not paid |

---

## 🧪 Demo mode

https://window7.vercel.app/#/app?demo=1 — the real product on its third adapter. Badged on every screen.

- Every cadence chip has a live Window (2.5–6 min), from the wall clock.
- Real six-level ladder. ~2,700 tUSDC a side. Big Calls pay a worse average.
- Links carry fills (`&s=…`). A second tab is enough. Or **Demo opponent accepts**.
- Settlement is deterministic per `marketId`. Only the winner Claims.

Never presented as chain evidence.

---

## ▶️ Run it live

https://window7.vercel.app/

1. Wallet → chain `50312` · RPC `https://api.infra.testnet.somnia.network`
2. Gas from the Somnia testnet faucet · tUSDC from in-app **Mint tUSDC**
3. Connect → Switch → Mint → Approve the exact stake → **Call**
4. Share the link. Opposite wallet accepts. Claim after finalize

Thin book? FOK refuses. Stake small, or use demo mode.

---

## 🛡️ Honest limits

We would rather write these than have a judge find them.

| | |
|---|---|
| Proof tuple | No invented Shannon hashes. Live `marketId` + two txs still pending |
| Recording | The video above is labeled demo mode |
| Thin books | FOK accept refused when the other side cannot cover. We name it |
| Audit | 25 transitive wagmi findings (2 high, 23 moderate). No criticals |
| Users | Runnable. Nobody outside the team has used it |

**⚡ zero contracts · zero custody · zero referee ⚡**
