# AGENTS.md — docs/brand

## Ownership
Judge-facing brand assets for Window Duel (README, DoraHacks, submission paste).

## Purpose
Holds the 480×480 product mark and the animated SVGs the root README embeds. Not app runtime assets — `src/ui` still uses CSS tokens and inline SVG.

## What This Controls
If these files move or rename without a README/`submission.md` update, GitHub renders a broken logo and dead animations on the first screen judges see.

## Connections
- Depends on: product palette in `src/ui/styles.css` (`--paper`, `--ink`, `--clay`, `--up`, `--down`)
- Depended on by: `README.md`, `submission.md`
- External systems touched: none

## Current State
Working. `logo.png` is the Gemini-generated 480×480 mark (window, lock-ring, Line, Up/Down ticks). `lock-ring.svg`, `tagline.svg`, and `flow.svg` are SMIL-animated; GitHub renders them via `<img>`.

## Decision Log

### 2026-09-08 — Mark and living SVGs for the README
- **Change**: Added `logo.png` (480×480), `lock-ring.svg` (depleting clay ring + pulsing Up/Down), `tagline.svg` (three-beat fade), `flow.svg` (A/B → Window share path).
- **Reasoning**: A static wordmark alone is easy to skim past; the living ring is the same instrument the terminal uses, so the README and the product agree.
- **Rejected alternative(s)**: 4.9MB source PNG in `docs/final.png` (too heavy for GitHub); heroku typing-svg (third-party uptime on a judged first screen); inline SMIL in README HTML (GitHub sanitizes it — file `<img>` survives).
- **Task/session**: README polish + DoraHacks first screen.

## Known Gotchas
GitHub Camo sometimes caches an SVG on first fetch — a hard refresh after push is what shows motion. Do not inline these SVGs in markdown HTML; use `![…](docs/brand/….svg)`.
