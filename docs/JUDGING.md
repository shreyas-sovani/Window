# Judge brief — Window Duel

This maps common hackathon criteria to inspectable repository evidence. It does not claim an unpublished scoring rubric or invent traction.

## 20-second pitch

Window Duel turns a filled dreamDEX Event Contract into a challenge link for another wallet. Both users take opposite sides of the same real market. Window then reconstructs the result from two public fill proofs and the finalized market—without a backend referee, custom contract, custody, or trusted outcome input.

## Why this is not another trading terminal

The official exchange already offers a CLOB. Rebuilding it would add little. Window adds a consumer and distribution layer:

1. It translates outcome tokens, tick/lot rules, liquidity, expiry, approval, and claims into one Up/Down decision.
2. It turns a verified fill into a shareable challenge, creating a credible path from chat activity to a second dreamDEX take.
3. It makes the social result independently inspectable: the completed link names both transactions, while tape and settlement data—not URL claims—dictate wallets, sides, fill sizes, and winner.

There is deliberately no pretend peer-to-peer pot. Each Call is an independent IOC take against dreamDEX. Unequal stakes remain visible. That constraint is a product truth, not fine print.

## Criterion-to-evidence map

| Criterion | What to judge | Repository / live evidence |
|---|---|---|
| Problem and product | Clear retail user, painful exchange-shaped flow, social reason to return | `docs/PRD.md`; landing hero; one-screen `src/ui/CallBoard.tsx` |
| Innovation | Public-market fills composed into a portable wallet challenge and deterministic replay | `src/domain/duel.ts`, `src/domain/challenge-link.ts`, `src/domain/replay.ts` |
| Somnia / dreamDEX use | Real Event Contract markets, books, stake quotes, IOC orders, portfolio tape, settlement, oracle receipts, claims | `src/exchange/somnia.ts`; ADR-0002; `docs/SDK-FEEDBACK.md` |
| Technical quality | Pure domain boundary, live/fake adapter parity, marketId isolation, bounded write and confirmation paths | `src/exchange/port.ts`; 319-test suite; `src/ui/App.integration.test.tsx` |
| Trust and safety | Wallet signs; no frontend key; exact approvals; no custom custody; fail-closed proofs; no invented odds | ADR-0001; `src/domain/wallet-gate.ts`; `src/domain/call-session.ts`; replay tests |
| UX and completeness | Opportunity-first Window, depleting lock ring, Risk → Win quote, one challenge CTA, receipts, result, rematch, claim | `#/app`; `src/ui/App.tsx`; `src/ui/Duel.tsx`; `docs/DEMO.md` |
| Ecosystem impact | Consumer abstraction and social invitation can add taker flow; SDK gaps documented from real integration work | README “Why the ecosystem needs this”; `docs/SDK-FEEDBACK.md` |
| Verifiability | Both fill transactions link to Shannon explorer; judge replay rejects contradictions and reads settlement itself | `#/docs?m=…&a=…&b=…`; `src/ui/Replay.tsx` |

## Adversarial proof checks

A judge should try these; they are intended behavior:

- Change a challenge URL's side or stake: the tape-derived fill wins.
- Omit the accepting tx while another wallet trades the opposite side: the challenge remains pending; public chronology is never treated as social intent.
- Name a nonexistent accepting tx: the completed proof is refused.
- Open the challenge with the challenger's wallet: acceptance is disabled.
- Use two hashes from one wallet or one side: replay refuses.
- Use a fill without its marketId or from a sibling Window: replay refuses.
- Replay before Finalized or try to select the winner manually: no verdict and no outcome control exists.
- Submit into an empty book: no verified fill means no receipt, no challenge, and no duel.
- Interrupt the indexer after a tx: Window says verification is unavailable instead of claiming no fill.

## Evidence readiness

Code and deterministic tests are ready. Three submission artifacts require human/external state and must be completed before judging:

- **Real proof tuple:** one finalized Shannon `marketId`, challenger fill tx, and opponent fill tx.
- **Deployment:** a public HTTPS URL built from the reviewed commit.
- **Recording:** a 2–5 minute video following `docs/DEMO.md`, with the real proof replay as fallback.

Do not replace these with fake hashes, seeded UI, screenshots without explorer links, or claims that a local test is a live transaction.
