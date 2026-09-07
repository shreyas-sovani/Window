# VERIFICATION — Window Duel

How to check every claim this submission makes. Nothing below requires trusting us; each row names the command or the public URL that reproduces it. Items that need live human state are marked **PENDING** and are never faked.

## Reproduce the engineering claims

| Claim | How to verify |
|---|---|
| Deterministic test suite — 391 tests, offline | `npm install && npm test` (Vitest; no indexer calls in the default run) |
| Typecheck + production build | `npm run build` (`tsc --noEmit` + Vite) |
| CI runs both from a clean install and rejects critical advisories | `.github/workflows/ci.yml` |
| Zero custom contracts | No Solidity anywhere in this repo; every write goes through `@somnia-chain/markets-sdk` (ADR-0002). Only the dreamDEX `BinaryMarketsModule` and pools are touched |
| No key material in the client | `grep -ri "private" src/` — the browser wallet signs every write; `.env` is gitignored and unused by the bundle |
| Dependency disclosure is honest | `npm audit --omit=dev` — 25 transitive findings (2 high, 23 moderate) through wagmi's connector tree, disclosed in README; complete remediation needs the breaking wagmi 3 migration |

## Verify a duel independently (no trust in this app)

The judge replay at `#/docs?m=<marketId>&a=<challengerTx>&b=<acceptTx>` reconstructs both legs from the pool's public fill tape and reads settlement from the Finalized market. It refuses: non-finalized markets, hashes that are not fills on that exact market, one wallet on both ends, same-side fills, and mixed/conflicting rows. There is no outcome input.

Adversarial checks that are intended behavior (see `docs/JUDGING.md` for the full list):

- Change a link's side, stake, or floor: the tape-derived fill wins; a tampered-down `minStake` cannot admit an undersized accept (the floor is the challenger's tape escrow at minimum, and the accept CTA disables below it before anything is sent).
- Open any challenge link cold: it says **verifying** while the market/tape reads are in flight — never a refusal it has no evidence for.
- Name the challenger's *other* fill on the same market: refused (`wrong-fill`) — the named transaction is the challenge.
- Omit the accepting tx: the challenge stays pending; unrelated opposite fills never complete it.

Both fill transactions link to the Shannon explorer from every duel view, so wallets, sides, sizes, and the winner can be checked against chain data directly.

## Measured numbers

| Number | Value | Source |
|---|---|---|
| Deterministic tests | 391 passing | `npm test` |
| Cold direct `#/app` entry | ~10–15 s to a live question (Shannon indexer `loadMarkets(true)`) | measured during the 2026-08-30 warm-start pass |
| Landing-warmed entry | ~5 s | same session |
| SDK feedback items | 9, evidence-backed | `docs/SDK-FEEDBACK.md` |

## Live evidence (PENDING — human state, never fabricated)

The repository intentionally contains no invented proof values. Until each lands, it is an explicit blocker, not a claim:

- **PENDING** — one finalized Shannon `marketId` plus both duel fill tx hashes, from a real two-wallet duel.
- **PENDING** — public HTTPS deployment URL of the reviewed commit.
- **PENDING** — 2–5 minute recording following `docs/DEMO.md`.

When they exist, the proof tuple plugs directly into the replay URL above.
