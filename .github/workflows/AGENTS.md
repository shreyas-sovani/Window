# AGENTS.md — .github/workflows

## Ownership
Release verification for the Window Duel repository.

## Purpose
Runs deterministic tests, the production TypeScript/Vite build, and a critical-severity production dependency audit on pushes and pull requests.

## What This Controls
Whether repository changes receive an automated green release signal before deployment or submission.

## Connections
- Depends on: `package.json`, `package-lock.json`, the Vitest suite under `src/`, and the Vite production build.
- Depended on by: GitHub pull-request and push checks.
- External systems touched: GitHub Actions and the npm advisory registry.

## Current State
Working configuration; local equivalents are `npm ci`, `npm test`, `npm run build`, and `npm audit --omit=dev --audit-level=critical`.

## Decision Log

### 2026-09-01 — Add a bounded release gate
- **Change**: Added `ci.yml` with Node 22, clean install, full tests, production build, and critical production advisory rejection.
- **Reasoning**: A hackathon submission needs reproducible evidence beyond a local `node_modules`; the ten-minute cap prevents a stuck network/toolchain job.
- **Rejected alternative(s)**: Failing on every moderate transitive advisory, because currently pinned wallet/SDK dependency trees contain upstream-only findings and would make all changes permanently red; omitting security checks entirely, because critical regressions must block release.
- **Task/session**: Winner-readiness pass.

## Known Gotchas
Default tests must remain offline. Do not add live Shannon/indexer smoke checks to this workflow; keep those optional because external availability would make CI nondeterministic.
