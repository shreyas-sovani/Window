# Window Duel — 90-second demo script

The product sentence: **Challenge another wallet on the same DreamDEX Window. Two opposite Calls, two verified fills, one Line, one on-chain winner.**

Setup before hitting record: two wallets on Shannon (Wallet A = challenger, Wallet B = opponent), each with STT gas and a little tUSDC (faucet works live, but keep a funded fallback). Browser profile 1 for Wallet A, profile 2 (or a second browser) for Wallet B. Start at `#/` on BTC 15m.

## The script (90 seconds)

**0:00 — The pitch (landing, then the board).** From the landing: "Window Duel. You Call a side, you challenge another wallet on the same Window — two opposite Calls, two verified fills, one on-chain winner." Click **Open the terminal**. "One screen: the Line, live odds, a stake, two buttons. Social opponents, never exchange counterparties — each Call is its own IOC take."

**0:10 — The Call (Wallet A).** Tap preset **10**. "Sizing runs through a live stake quote. IOC only — takes what's there, cancels the rest, nothing rests." Press **Call Up**. Sign. "The receipt only exists because the fill verified on-chain — filled contracts, average odds, escrow, all read back from my tape. A signed-but-unfilled Call gets no receipt, no challenge, nothing."

**0:25 — The challenge.** Open **Receipts** → **Challenge a wallet**. "The link carries marketId, my wallet, side, stake, and the fill's tx hash — a hint, not a proof. Send it to Wallet B." Paste/send it (Signal, keybase, whatever is on camera).

**0:35 — The accept (Wallet B, second browser).** Open the link. "The terminal pins that exact Window, locks the opponent to the opposite side, and states the deal: one invite attempts a second IOC take — it does not promise the fill." Enter stake **15** (unequal stakes are allowed and shown). Press **Call DOWN to accept**. Sign. "The duel opens only now — when Wallet B's fill verifies. Not on tx submit."

**0:50 — The result.** Back to either browser once the Window locks and settles: the duel panel names the winner by wallet and side — or **Void — a draw** — from the chain's settlement plus the two verified fills, never from the URL. Both explorer txs are linked. "One lonely fill after expiry is an expired challenge, not a win."

**1:05 — The rematch.** "The Rematch bar offers the same Call on the successor Window — same series, same side, one press, wallet signs." Fire it if time allows.

**1:15 — Close.** "Zero custom contracts. Both trades went through the dreamDEX SDK on Somnia Shannon as independent book takes — opponents never filled against each other and no pot was matched. Ecosystem note: one invite attempts two IOC takes on one canonical Window; volume is measured fills, not links sent. 298 tests, including a full-UI integration run against a deterministic fake exchange."

## Replay fallback (if the live two-wallet take cannot finish on camera)

`#/docs` → **Judge replay**: paste the marketId, the two tx hashes, and the finalized outcome (Up/Down/Void). The indexer's fill tape must agree — a hash that is not a fill on that market fails closed and nothing is reconstructed. A judge with one browser and no second wallet still finishes the story this way.

**DEMO HOLE (fill before recording):** no real Shannon duel hashes are pinned in this repo yet. Run one live duel first (even on 60s/5m cadence), then paste its marketId + both tx hashes into the replay tool — or share them as `#/docs?m=…&a=…&b=…&o=up`. Do not invent fills.

## The live two-wallet path (if 15m cannot finish on camera)

Use the shortest live cadence (60s or 5m — two venues roll independently). The full loop — Call → challenge link → accept → settle → result — still lands inside one Window. If even that is too tight, show: Wallet A's verified Call + challenge CTA live, the Wallet B accept live, then the **replay** for the settled result of an earlier duel.

## Fallbacks

- No live BTC 15m Window: switch chips to whatever cadence is live (two venues roll 60s/5m and 15m+ independently).
- Last ~90s of a Window: board stays on **Locking** — new Calls closed, Exit still there. Do not accept a challenge in Locking; the accept is refused as not-Trading.
- Book empty: the ticket says odds are not tradable and the Call buttons stay off with their reason — Window never invents a price. An accept with nothing to cross fails honestly; say so, it's by design.
- Wallet B opens the link with Wallet A connected: refused — the same wallet cannot accept its own challenge.
- Broken or tampered link: refused ("no challenge in this link") — URL fields are never treated as proof.
- Indexer hiccup: status dot goes to "Syncing…", polls retry; refresh fixes worst case.
- Cold load straight to `#/app` can take ~10–15s (SDK registry hydration). Start on the landing page — it warms the store, so the terminal opens with data in seconds.
