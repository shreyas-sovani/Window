import { describe, expect, it } from "vitest";
import { healthDetail, marketHealth } from "./market-health";
import type { BookDepth } from "./book-depth";
import type { BookTop } from "../exchange/port";

function depth(levels: { bid?: number; bidQty?: number; ask?: number; askQty?: number }[]): BookDepth {
  let cumB = 0;
  let cumA = 0;
  const bids = levels
    .filter((l) => l.bid !== undefined)
    .map((l) => {
      cumB += l.bidQty ?? 100;
      return { upPrice: l.bid!, downPrice: 1 - l.bid!, contracts: l.bidQty ?? 100, cumContracts: cumB };
    });
  const asks = levels
    .filter((l) => l.ask !== undefined)
    .map((l) => {
      cumA += l.askQty ?? 100;
      return { upPrice: l.ask!, downPrice: 1 - l.ask!, contracts: l.askQty ?? 100, cumContracts: cumA };
    });
  return { bids, asks, empty: bids.length === 0 && asks.length === 0 };
}

const NOW = 1_000_000;
const FAR_EXPIRY = NOW + 600;

describe("marketHealth", () => {
  it("grades a tight two-sided book with real depth as strong", () => {
    const h = marketHealth({
      book: { bid: 0.61, ask: 0.62 },
      depth: depth([{ bid: 0.61, bidQty: 200 }, { ask: 0.62, askQty: 200 }]),
      expirySec: FAR_EXPIRY,
      intervalSec: 900,
      nowSec: NOW,
    });
    expect(h.grade).toBe("strong");
    expect(h.spread).toBeCloseTo(0.01, 10);
    // Up ceiling 200 × 0.62 = 124; Down ceiling 200 × (1 − 0.61) = 78. min = 78.
    expect(h.executableStake).toBeCloseTo(78, 0);
    expect(h.copy).toContain("Strong");
    expect(h.copy).toContain("1.0 pt spread");
  });

  it("grades a wide spread as thin even with depth", () => {
    const h = marketHealth({
      book: { bid: 0.55, ask: 0.62 },
      depth: depth([{ bid: 0.55, bidQty: 500 }, { ask: 0.62, askQty: 500 }]),
      expirySec: FAR_EXPIRY,
      intervalSec: 900,
      nowSec: NOW,
    });
    expect(h.grade).toBe("thin");
  });

  it("grades shallow executable depth as thin", () => {
    const h = marketHealth({
      book: { bid: 0.61, ask: 0.615 },
      depth: depth([{ bid: 0.61, bidQty: 4 }, { ask: 0.615, askQty: 4 }]),
      expirySec: FAR_EXPIRY,
      intervalSec: 900,
      nowSec: NOW,
    });
    expect(h.grade).toBe("thin");
    expect(h.executableStake).toBeLessThan(5);
  });

  it("grades a moderate spread and depth as fair", () => {
    const h = marketHealth({
      book: { bid: 0.60, ask: 0.62 },
      depth: depth([{ bid: 0.6, bidQty: 100 }, { ask: 0.62, askQty: 100 }]),
      expirySec: FAR_EXPIRY,
      intervalSec: 900,
      nowSec: NOW,
    });
    expect(h.grade).toBe("fair");
  });

  it("returns none without executable levels on both sides", () => {
    const h = marketHealth({
      book: undefined,
      depth: depth([]),
      expirySec: FAR_EXPIRY,
      intervalSec: 900,
      nowSec: NOW,
    });
    expect(h.grade).toBe("none");
    expect(h.spread).toBeNull();
    expect(h.executableStake).toBe(0);
    expect(h.copy).toContain("No executable odds");
  });

  it("returns none when only one side has levels", () => {
    const h = marketHealth({
      book: { bid: 0.6 },
      depth: depth([{ bid: 0.6, bidQty: 500 }]),
      expirySec: FAR_EXPIRY,
      intervalSec: 900,
      nowSec: NOW,
    });
    expect(h.grade).toBe("none");
  });

  it("uses the smaller side as the executable ceiling", () => {
    const h = marketHealth({
      book: { bid: 0.5, ask: 0.5 },
      depth: depth([{ bid: 0.5, bidQty: 100 }, { ask: 0.5, askQty: 10 }]),
      expirySec: FAR_EXPIRY,
      intervalSec: 900,
      nowSec: NOW,
    });
    // Up ceiling: 10 * 0.5 = 5. Down ceiling: 100 * 0.5 = 50. min = 5.
    expect(h.executableStake).toBeCloseTo(5, 6);
  });

  it("names the time to lock when the Window is close to locking", () => {
    const h = marketHealth({
      book: { bid: 0.61, ask: 0.62 },
      depth: depth([{ bid: 0.61, bidQty: 200 }, { ask: 0.62, askQty: 200 }]),
      expirySec: NOW + 60,
      intervalSec: 900,
      nowSec: NOW,
    });
    expect(h.secondsToLock).toBe(60);
    expect(h.copy).toContain("locks in 1:00");
  });

  it("caps at thin inside lock headroom — depth you cannot reach is not health", () => {
    const h = marketHealth({
      book: { bid: 0.61, ask: 0.62 },
      depth: depth([{ bid: 0.61, bidQty: 200 }, { ask: 0.62, askQty: 200 }]),
      expirySec: NOW + 45,
      intervalSec: 900,
      nowSec: NOW,
    });
    expect(h.grade).toBe("thin");
  });

  it("omits the lock mention when there is plenty of time", () => {
    const h = marketHealth({
      book: { bid: 0.61, ask: 0.62 },
      depth: depth([{ bid: 0.61, bidQty: 200 }, { ask: 0.62, askQty: 200 }]),
      expirySec: NOW + 600,
      intervalSec: 900,
      nowSec: NOW,
    });
    expect(h.copy).not.toContain("locks in");
  });

  it("grades a two-sided top with a cold depth watch on spread alone — never claims depth", () => {
    const h = marketHealth({
      book: { bid: 0.61, ask: 0.62 },
      depth: depth([]),
      expirySec: FAR_EXPIRY,
      intervalSec: 900,
      nowSec: NOW,
    });
    expect(h.grade).toBe("fair");
    expect(h.executableStake).toBe(0);
    expect(h.copy).toContain("top of book");
    expect(h.copy).not.toContain("deep");
    expect(healthDetail(h)).toContain("top of book");
  });

  it("grades a wide two-sided top as thin even with a cold depth watch", () => {
    const h = marketHealth({
      book: { bid: 0.55, ask: 0.62 },
      depth: depth([]),
      expirySec: FAR_EXPIRY,
      intervalSec: 900,
      nowSec: NOW,
    });
    expect(h.grade).toBe("thin");
  });
});
