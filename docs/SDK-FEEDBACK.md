# SDK / docs feedback

Notes for dreamDEX while building Window on `@somnia-chain/markets-sdk` 0.28.1 + Shannon indexer. Not product requirements.

1. **`getOutcomeBalance` shape.** Types take `{ outcomeToken, account, id }`. Recipes still show positional `(outcomeToken, account, yesId)`. The object form is what TypeScript accepts.

2. **Derived `intervalSec` is not the label.** Live ETH 1h rows have arrived as `3598` (`expiry − tradingStart`). `listPastBinaryMarkets({ intervalSec: 3600 })` then misses them. Clients should snap to 60 / 300 / 900 / 3600 / 14400 / 86400, or the indexer should store the canonical cadence separately from the derived window.

3. **Recipes headroom is a fixed 300s.** That disables entire 5m series. Headroom as a fraction of `intervalSec` (clamped) keeps short Windows tradable.

4. **Two venues on one Shannon indexer.** 60s/5m vs 15m+ do not share `venueId`. Pinning venue from the first BTC row hides 15m.

5. **`quoteBinaryStake` needs a live store snapshot.** It walks the watch cache, not the indexer. A quote before the first `useLiveBinaryOrderBookByMarket` snapshot returns empty/null. Clients should fall back to a polled top-of-book size rather than disable the order.

6. **`getMarketFees` units.** `markets.ts` documents standard bps (1 = 0.01%, used as `estPayoutFor`'s `settlementFeeBps` over 10_000). `SomniaMarketsClient.getMarketFees` d.ts still says "bpsTimes1k". The implementation + `createClient.getClaimable` follow standard bps.

7. **Fills grouped by pool in `computeOpenPositionsPnL`.** The fold groups fills by pool while router actions group by market id. Recycled pools can leak cost basis across successor Windows. Window maps the tape from `getPortfolio(account).trades` (market-scoped) and positions from `getOpenPositionsWithPnL`. `fetchMyTrades` also requires a signer; `getPortfolio(account)` does not.

8. **Unified `createOrder` cannot set an explicit `expireTimestampNs` — but binary orders are bounded by the market anyway.** `CreateOrderParams` only has `timeInForce` / `postOnly` / slippage, while `trader.placeOrder` takes `expireTimestampNs`. Correction to an earlier draft of this note: the pool enforces `0 < expireNs <= pool.marketExpiryNs` and the default is the market expiry (not a ~50y GTC — that is the spot/perp default), so a post-only Rest placed through the unified helper cannot outlive its Window and the expiry sweeps can drain the book at lock. The remaining gap is only ergonomic: a client wanting a *shorter* order TTL than the Window still has to drop to `trader.placeOrder`.
