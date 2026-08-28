# Window — 90-second demo script

Setup before hitting record: wallet on Shannon with STT gas + a little tUSDC already minted (faucet works live too, but have a fallback wallet). Board open on BTC 15m.

## The script

**0:00 — The pitch (on the board).** "Window is the consumer Up/Down terminal for dreamDEX Event Contracts on Somnia. One screen: the Line, live odds, a stake, two buttons. No order tables, no leverage language — a Call."

**0:10 — The read model.** Point at Line / Locks in / Implied Up. "Odds come from the SDK's live order book over WebSocket, with a polled top-of-book fallback. Countdown turns red inside the last minute — that's the lock." Hover the book drawer: "Real depth, human units, spread in the middle."

**0:25 — The Call.** Type stake 10. "Sizing runs through a live stake quote — 10 tUSDC becomes this many contracts at the protective limit. IOC only: it takes what's there and cancels the rest. Nothing rests." Press **Call Up**. Sign. Point at the toast, then the position banner with the settle preview: "If Up wins, if Down wins, if Void — priced before I commit, venue-fee aware."

**0:45 — The tape + P&L.** Scroll to P&L. "The fill lands in a signed tape — explorer-linked — and the open position marks to book with avg-cost unrealized P&L. That's the SDK's portfolio and PnL engines, surfaced."

**0:55 — Series history.** Point at the chips: "Every finalized Window, Up/Down/Void, with the running record. Voided markets redeem both sides at par — the claim session knows that."

**1:05 — Claim.** If a finalized position exists: press **Claim finalized**. "Winnings never auto-pay. Window scans finalized markets the indexer hides from loadMarkets, redeems winners fee-adjusted, voids at half. One button."

**1:15 — Close.** "Zero custom contracts. Every trade is the dreamDEX SDK on Somnia Shannon. Domain layer is pure TypeScript, 123 tests, adapters swappable — there's a deterministic fake exchange the whole suite runs against. docs/SDK-FEEDBACK.md is our eight-item report back to the dreamDEX team."

## Fallbacks

- No live BTC 15m Window: switch chips to whatever cadence is live (two venues roll 60s/5m and 15m+ independently).
- Last ~90s of a 15m Window: board stays on **Locking** — new Calls closed, Exit still there.
- Just after lock, before the next Window lists: board stays on **Locked** / **Settling** (countdown 00:00) instead of going blank.
- Book empty: the Call still sizes at 50% mid — say so, it's by design.
- Indexer hiccup: status dot goes to "Syncing…", polls retry; refresh fixes worst case.
