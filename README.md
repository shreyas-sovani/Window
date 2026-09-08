# Window Duel

**Make a Call. Challenge another wallet. Prove who won — from public chain data alone.**

Window Duel is the consumer and social layer for [dreamDEX Event Contracts](https://docs.dreamdex.io/developers/event-contracts) on **Somnia Shannon** (chain 50312).

A verified Up/Down fill becomes a link you can drop into any group chat. Another wallet opens it, sees your fill proven on-chain, and takes the opposite side of the *exact same Window*. When the Window settles, two public fill proofs plus the finalized market name the winner — with **no backend referee, no custody, no trusted outcome input, and not one line of custom Solidity**.

Every link you share is a second real order on the venue.

> **The trust boundary, stated once:** the URL is a locator, never evidence. Sides, stakes, opponents and winners are read from the pool's public fill tape and the finalized market. Tamper with any field in the link and the chain wins. A submitted-but-unfilled transaction earns no receipt, no challenge, and no victory screen.

---

## Judge it in five minutes

No wallet, no funds, no gas required for steps 1 and 2.

| # | What to do | What it proves |
|---|---|---|
| 1 | `npm install && npm test` | 448 deterministic tests, fully offline — no indexer, no chain, no network |
| 2 | `npm run dev`, open `#/app?demo=1`, then Connect → Approve → **Call Up** → **Demo opponent accepts** | The entire product loop — deep book, verified fill, challenge link, opposite accept, then settlement and a winner-only Claim when that Window closes on its own clock (2.5–6 min) — on a labeled simulation, in one browser |
| 3 | Copy the challenge link the strip mints, open it in a second tab | The link is **self-contained**: the second tab derives the same market from its own clock, hydrates the fill from the URL, verifies it, and offers exactly one action — the opposite side |
| 4 | Edit any character of the link's payload and reload | It fails closed: a malformed payload is refused outright, and a re-encoded one is overridden by the tape — side and stake come from the verified fill, and a floor edited *downward* still cannot admit an undersized accept |
| 5 | Open `#/docs?replay=1` and try to fake a result | The replay tool takes a `marketId` and two tx hashes and reads settlement itself. There is no outcome input. Same wallet on both ends, same-side fills, non-finalized markets, or a hash that is not a fill on that market: **refused** |

Full criterion-to-evidence map: [`docs/JUDGING.md`](docs/JUDGING.md).
Every claim with the command that reproduces it: [`docs/VERIFICATION.md`](docs/VERIFICATION.md).
Recording script: [`docs/DEMO.md`](docs/DEMO.md).

---

## Why this wins on the brief

**It creates volume the venue cannot create for itself.** dreamDEX rolls a fresh binary market every few minutes, but its UI is a CLOB — it asks "what price and size?", not "up or down?". The natural trader for a 15-minute binary is a consumer with a view and ten tUSDC. Window Duel is that demand side, and its social loop is multiplicative: one invitation is an attempt at a *second real IOC take* on the same Window. Volume is measured in fills, never in links sent.

**It is honest in the places where products usually lie.** No executable book means no Call — there is no invented 50% price anywhere in the codebase. A receipt exists only after the fill is witnessed on a tape. An accept that undershoots the challenge floor is refused. A challenge link that cannot fill is not minted. When a read is in flight the UI says *verifying*, never a refusal it has no evidence for. When the pool refuses a write, the banner names the pool's own error instead of guessing.

**It has zero custody and zero new trust.** No custom contracts ([ADR-0001](docs/adr/0001-zero-custom-contracts.md)), no escrow pot, no server. Opponents are social, never each other's counterparty: each side is its own independent take against dreamDEX, and stakes may differ above the floor. Nothing about a duel requires trusting this app — which is exactly why a judge can verify one without it.

**It is a field report on the SDK, not just a consumer of it.** The whole product is `@somnia-chain/markets-sdk` exercised end to end — live books, stake quotes, portfolio and pool tapes, post-only rests, multi-venue claims, the price feed, transaction-receipt decoding — and [`docs/SDK-FEEDBACK.md`](docs/SDK-FEEDBACK.md) is the nine-item, evidence-backed report that came out of it, including the one gap that killed a feature we wanted (no binary operator path, so the roll companion keeps a human in the loop rather than faking a bot).

---

## The duel, precisely

1. **Call.** Pick BTC or ETH, a cadence (5m–24h), a stake. The ticket shows explicit `Risk X → Win Y` and sizes from a live stake quote against the real book.
2. **Verify.** The Call's own transaction receipt is decoded on the spot (ERC-20 net collateral plus ERC-6901 outcome legs), so the receipt appears in seconds and does not wait on the indexer. If the receipt is unavailable, the pool tape and portfolio reads keep reconciling — a real fill is never lost to indexer lag.
3. **Challenge.** The verified fill mints `#/app?d=…`, optionally addressed to one wallet, floored at your own stake, and short-lived by design (the strip counts the invite down). Shared through the native share sheet, clipboard fallback.
4. **Accept.** The recipient gets one prerequisite-aware CTA and a **fill-or-kill** take on the opposite side — whole or nothing, so a partial undershoot cannot pose as an accept. If the visible ladder cannot cover it, the accept is disabled with the fillable amount, before gas is spent.
5. **Resolve.** After the accepting fill verifies, the URL grows `&a=<acceptTx>` and becomes portable proof. Settlement comes from the finalized market; the winner — and only the winner — is offered the Claim, then a one-press **Rematch** re-challenges the same opponent on the successor Window.

Unrelated opposite fills on a public market never complete a duel. Public chronology is not social consent.

---

## Demo mode — the recording path that does not depend on anyone's uptime

Shannon's indexer has trailed chain head by minutes to hours during this build, and testnet books are thin. So the product ships a labeled simulation of itself: **`#/app?demo=1`**, badged on every screen, `DEMO ·` on every duel view.

It is not seeded UI. It is the real product, unmodified, on its second adapter:

- Every cadence chip has a live Window derived from the wall clock — 2.5 to 6 minutes each, callable for two thirds of that — so every browser sees the same market with no server.
- A genuine six-level two-sided ladder, roughly **2,700 tUSDC of executable depth per side**: a 500 tUSDC Call fills whole and pays a worse average than a 10 tUSDC one, the Book cell grades **Strong**, and the drawer lists the levels.
- Anonymous market colour arrives on the public tape while you watch; settlement is deterministic per `marketId`; claims are account-scoped, so the loser is never offered the winner's payout.
- Challenge links are self-contained — `&demo=1&s=…` carries the fills — so a second tab, or a phone, joins the duel from the URL alone. Or press **Demo opponent accepts** and record both sides in one browser.

Demo mode is a flow aid and says so, everywhere. It is never presented as chain evidence.

---

## Run it

```bash
cp .env.example .env && npm install && npm test && npm run dev
```

Then either `#/app?demo=1` for the labeled simulation, or the live path on Shannon:

1. Injected wallet (MetaMask / Rabby) → add Shannon: chain `50312`, RPC `https://api.infra.testnet.somnia.network`, symbol `STT`, explorer `https://shannon-explorer.somnia.network`.
2. Gas from [testnet.somnia.network](https://testnet.somnia.network/); tUSDC from the in-app **Mint tUSDC** (`trader.faucet`, cap 10,000).
3. Connect → Switch → Mint → Approve exactly the stake → **Call Up** / **Call Down**, guided one step at a time.
4. Share the challenge link, take the opposite side from another wallet, then Claim after the Window finalizes.

Three pages, hash-routed, no server config: `#/` landing, `#/docs` docs plus the judge replay tool, `#/app` terminal. Expect two Shannon venues (60s/5m and 15m+); indexer `intervalSec` can be a few seconds off (3598 for 1h) and is snapped to the canonical cadence.

**On thin books:** an accept is fill-or-kill, so a large challenger stake can be unacceptable on a shallow venue. Stake small for a live two-wallet duel, or record in demo mode.

---

## What else is in the terminal

| Capability | Detail |
|---|---|
| Question-first board | "Will BTC close above 67,214.50?" — the Line on a dashed price axis, the lock countdown as a depleting ring, implied odds, volume, trades |
| Market health | One grade per Window from spread, walked executable depth, and time-to-lock — a cold depth watch grades the spread and says "top of book", never claiming depth it cannot see |
| Opportunity-first selection | No live Window on the selected series? The terminal jumps to the best one (real Line, safe headroom); the most callable cadence wears a `best` badge |
| Proof cards | Every witnessed Call becomes a plain-text receipt (settled variant adds result plus oracle link), shareable with no backend |
| Claim session | Scans the 40 most recent finalized Windows **across every venue**, deduped by market, fee-aware per Window; a failed redeem never aborts the rest |
| Pulse | Underlying price and implied-odds sparklines, last-12 outcome bars, and the pool's public fill tape — pure SVG, no chart library |
| Book drawer | Up-depth ladder plus a post-only Rest that expires at Window lock (pool-enforced) |
| Wallet P&L | Realized and unrealized per open position (avg-cost, marked to book) and a signed fill tape, all explorer-linked |
| Settle preview | If-Up / If-Down / If-Void payout of the live position, venue-fee aware |
| Series history | Last 12 finalized Windows per cadence with Up/Down/Void chips, running tally, oracle receipts, and Lines |
| Write safety | One wallet action at a time, enforced by a synchronous mutex — double-click, click-plus-Enter, and re-rendered controls all land exactly one transaction |

---

## Architecture

```
src/
├── domain/     SDK-free pure logic, unit-tested (the bulk of 448 tests)
│   ├── duel, challenge-link, replay      social state + chain-shaped proof verification
│   ├── receipt-fill, filled-call         the chain witness: a fill proven from its own receipt
│   ├── pick-window, window-board         read models for the live series
│   ├── call-ticket, call-session         tick/lot sizing, IOC and FOK intents
│   ├── claim-plan, claim-session         what redeems, and how
│   ├── market-health, liquidity          book grade and fill estimates from walked depth
│   ├── lifecycle, series                 callability headroom, cadence snapping
│   └── pnl, settle-preview, wallet-gate, revert-copy, onboarding, roll, auto-series, chart
├── exchange/   the only SDK-touching layer (ADR-0002 / ADR-0003)
│   ├── port.ts        ExchangePort — one seam, three adapters
│   ├── somnia.ts      live: markets-sdk on Shannon, warm-started, every read deadlined
│   ├── fake.ts        deterministic in-memory adapter for tests
│   └── demo.ts        the demo universe: same port, wall-clock market, deep ladder
├── chain/      Shannon constants, wagmi/viem config
└── ui/         App orchestration, terminal, landing, docs, judge replay
```

Decisions: [`docs/adr/`](docs/adr/) — zero custom contracts (0001), SDK over HTTP API (0002), domain stays SDK-free (0003). Glossary: [`CONTEXT.md`](CONTEXT.md). Product truth: [`docs/PRD.md`](docs/PRD.md). Ticket history: [`docs/BACKLOG.md`](docs/BACKLOG.md). Per-directory ownership, decisions and gotchas live in the nearest `AGENTS.md`.

---

## Honest limits

We would rather state these than have a judge find them.

- **Live proof artifacts are pending, not faked.** A finalized Shannon `marketId` with both duel tx hashes, the public deployment URL, and the recording require live human state. The repository contains no invented proof values; see the PENDING block in [`docs/VERIFICATION.md`](docs/VERIFICATION.md).
- **Testnet liquidity is thin.** A fill-or-kill accept can be refused by the pool when the opposite side cannot cover it. The UI now refuses that before spending gas and names the reason — but it cannot manufacture depth.
- **Dependency audit is disclosed, not zero.** `npm audit --omit=dev` reports 25 transitive findings (2 high, 23 moderate) through wagmi's connector tree. No critical findings. Complete remediation needs the breaking wagmi 3 migration, which was not forced into the judged build.
- **v1 has no on-chain enforcement of the duel itself.** It does not need any — the duel is derived from public fills — but that also means neither side can be compelled to accept.
- **No external users yet.** The product is real and runnable; it has not been used by anyone outside the team.

`npm test` and `npm run build` are the release gate; GitHub Actions runs both from a clean install and rejects critical production advisories.

---

## Sources

- [dreamDEX Event Contracts](https://docs.dreamdex.io/developers/event-contracts) · [recipes](https://docs.dreamdex.io/developers/event-contracts/recipes) · [gotchas](https://docs.dreamdex.io/developers/event-contracts/gotchas) · [contracts and addresses](https://docs.dreamdex.io/developers/event-contracts/contracts-and-addresses)
- [Somnia network info](https://docs.somnia.network/developer/network-info)

MIT licensed. Built for the Somnia × dreamDEX Event Contracts Hackathon.
