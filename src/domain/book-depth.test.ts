import { describe, expect, it } from "vitest";
import { readBookDepth, summarizeDepth } from "./book-depth";

describe("readBookDepth", () => {
  it("is empty when nothing is resting", () => {
    const depth = readBookDepth({ bids: [], asks: [], decimals: 6 });
    expect(depth.empty).toBe(true);
    expect(summarizeDepth(depth)).toBe("empty");
  });

  it("scales raw Up levels and sets Down as 1 minus Up", () => {
    const depth = readBookDepth({
      bids: [{ price: 400_000n, quantity: 2_000_000n }],
      asks: [{ price: 550_000n, quantity: 3_000_000n }],
      decimals: 6,
    });
    expect(depth.empty).toBe(false);
    expect(depth.bids[0]).toMatchObject({ upPrice: 0.4, downPrice: 0.6, contracts: 2, cumContracts: 2 });
    expect(depth.asks[0]).toMatchObject({ upPrice: 0.55, downPrice: 0.45, contracts: 3, cumContracts: 3 });
    expect(summarizeDepth(depth)).toBe("1 bid · 1 ask");
  });

  it("skips zero size and prices that are not a live Up probability", () => {
    const depth = readBookDepth({
      bids: [
        { price: 0n, quantity: 1_000_000n },
        { price: 1_000_000n, quantity: 1_000_000n },
        { price: 400_000n, quantity: 0n },
        { price: 420_000n, quantity: 1_000_000n },
      ],
      asks: [],
      decimals: 6,
    });
    expect(depth.bids).toHaveLength(1);
    expect(depth.bids[0]?.upPrice).toBe(0.42);
  });

  it("keeps the five best levels and accumulates size", () => {
    const asks = Array.from({ length: 8 }, (_, i) => ({
      price: BigInt(500_000 + i * 1_000),
      quantity: 1_000_000n,
    }));
    const depth = readBookDepth({ bids: [], asks, decimals: 6 });
    expect(depth.asks).toHaveLength(5);
    expect(depth.asks[4]?.cumContracts).toBe(5);
  });
});
