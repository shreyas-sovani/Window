# ADR-0002 — markets-sdk, not the HTTP API

Status: accepted
Date: 2026-08-28
Source: https://docs.dreamdex.io/developers/event-contracts (MCP getPage / search)

## Decision

All Event Contract reads and writes go through `@somnia-chain/markets-sdk` ≥ 0.28.1. The dreamDEX HTTP API (`api.dreamdex.io` / `stg.api.dreamdex.io`) is documented as **spot only**.

## Why

There are no Event Contract HTTP endpoints. The SDK hydrates from the indexer then tails on-chain logs, exposes React hooks, and has unified + raw trader tiers (redeem needs the raw tier).

## Rejected

- Spot REST for binaries — missing endpoints.
- Direct pool `placeOrder` from the app without the SDK — we would re-implement tick/lot, watches, and decoded reverts. SDK 0.28.0 already snaps ticks.
