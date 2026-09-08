# AGENTS.md — src

## Ownership
Window application source.

## Purpose
Vite React app: domain, chain, exchange adapter, UI.

## What This Controls
Entry is `main.tsx`. Domain must stay SDK-free.

## Connections
- Depends on: npm deps in package.json
- Depended on by: Vite
- External systems touched: Shannon, dreamDEX indexer

## Current State
P0 UI + domain tests + fake ExchangeAdapter. See subdirectory AGENTS.md files.

## Decision Log

### 2026-09-08 — Fragment-safe link bootstrap and one demo adapter per page
- **Change**: `main.tsx` lifts a fragment-stripped link's query into the terminal hash before the first render (`bootstrapSearchLink(location.search, location.hash)` → `history.replaceState`), takes its demo adapter from `demoExchangeFor(account)` instead of constructing one per render, and its demo odds hook now returns the real demo ladder (`demoDepthFor`/`demoBookFor`) rather than an empty depth.
- **Reasoning**: Some clients (chat previews, QR rewriters, scanners) drop everything after `#`, which landed a shared challenge on the landing page with its proof unread in the query string. Constructing the adapter in render meant the app's own hash rewrite after a verified accept reset the demo market. The empty depth made every demo book grade "top of book" and left the drawer blank.
- **Rejected alternative(s)**: Minting share URLs in query form (the hash router is the product's URL shape; supporting both is strictly safer); `useMemo` for the adapter (a remount still rebuilds it — the session belongs to the page, not the tree).
- **Task/session**: Demo-mode completion pass — BACKLOG W-117.

### 2026-08-28 — parseRoute exact path
- **Change**: `parseRoute` matches `/app` and `/docs` (optional trailing slash), not `startsWith("#/app")`. Covered by `src/ui/router.test.ts`.
- **Reasoning**: `#/apps` must not mount wagmi + SomniaMarketsProvider.
- **Rejected alternative(s)**: Keeping prefix match because the nav only has three links.
- **Task/session**: Loop tick 25 — W-042.

### 2026-08-28 — Three-page hash router
- **Change**: `src/ui/router.ts` (tiny `useRoute` on `location.hash`): `#/` landing, `#/docs` docs, `#/app` terminal. `main.tsx` renders the route; wagmi/query/SDK providers mount only on the app route. Landing/docs sit inside `ErrorBoundary` alone.
- **Reasoning**: Zero-dependency routing that works on any static host (no server rewrites for deep links). Providers only on `#/app` keeps the marketing/docs surfaces light and a wallet-provider crash cannot take down the landing page.
- **Rejected alternative(s)**: react-router (dependency + history-API needs server config on static hosts). Three separate HTML entries (fights the single SDK singleton in `exchange/somnia.ts`). Querystring routing (uglier, same work).
- **Task/session**: Three-page redesign session.

### 2026-08-28 — ErrorBoundary + vendor chunking
- **Change**: `main.tsx` wraps `App` in `ErrorBoundary` (renders a recovery banner, never a blank root). `vite.config.ts` adds `manualChunks` for react/wagmi+viem/markets-sdk.
- **Reasoning**: One crash in a provider child used to blank the whole terminal during a demo; 965 kB single bundle became three cacheable chunks (largest 383 kB).
- **Rejected alternative(s)**: Error boundaries per section (overkill — the board is one screen). Route-based code splitting (no routes).
- **Task/session**: Hackathon hardening session.

### 2026-08-28 — SomniaMarketsProvider at the root
- **Change**: `main.tsx` wraps `App` with `SomniaMarketsProvider` using `getExchange().client`.
- **Reasoning**: SDK React watches require the provider; Call odds should not poll-only.
- **Rejected alternative(s)**: Instantiating a second SomniaMarkets in the UI (two tails, two sockets).
- **Task/session**: Live book watches.

### 2026-08-28 — Vite not Scaffold-ETH 2
- **Change**: Vite + wagmi + markets-sdk. No Foundry.
- **Reasoning**: ADR-0001 zero contracts; SE2's forge path is unused weight.
- **Rejected alternative(s)**: Next.js SSR (fights wallet dApps); forge suite from leftover root conventions.
- **Task/session**: Initial Window build.

## Known Gotchas
`npm run build` typechecks `src` excluding `*.test.ts`. Tests: `npm test`.
