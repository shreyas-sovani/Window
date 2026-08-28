# ADR-0003 — Domain modules stay SDK-free

Status: accepted
Date: 2026-08-28

## Decision

Grid, Lifecycle, CallTicket, ClaimPlan, WalletGate, and RevertCopy take plain data and return plain data. Only ExchangeAdapter imports `@somnia-chain/markets-sdk`.

## Why

Tick/lot, claim selection, and wallet sequencing are where bugs hide. They must be testable offline. The SDK's live watches and signer are I/O.

## Rejected

- Putting `createOrder` inside CallTicket — couples stake math to a wallet.
- Testing React components for lot snapping — those tests would break on restyles.
