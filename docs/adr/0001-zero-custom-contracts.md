# ADR-0001 — Zero custom contracts

Status: accepted
Date: 2026-08-28

## Decision

Window deploys no Solidity. All value transfer uses dreamDEX Event Contracts already live on Somnia (BinaryMarketsModule `0x3ecC694Cef705358864a646142ac17A90E29e388` on 5031 and 50312).

## Why

Event Contracts already provide binary markets, CLOB matching, mint/merge, oracle resolution, and redeem. Extra contracts would add audit surface and would not use the hackathon SDK.

## Rejected

- Custom AMM or off-chain matcher — fights the venue and fails “meaningful use of Event Contracts”.
- Wrapper vault for auto-claim — nice later; not needed for a Claim button the user (or a bot loop) can press.
