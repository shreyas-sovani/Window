import { describe, expect, it } from "vitest";
import type { LiveWindow } from "../exchange/port";
import { autoSeries, hottestCadence, seriesScore } from "./auto-series";

const win = (over: Partial<LiveWindow> = {}): LiveWindow => ({
  marketId: "0x" + "00".repeat(32),
  symbol: "BTC-15m",
  upSymbol: "BTC#YES",
  downSymbol: "BTC#NO",
  asset: "BTC",
  intervalSec: 900,
  expiry: 2_000,
  venueId: "0xvenue",
  pool: "0x0000000000000000000000000000000000000001",
  status: 1,
  openingPrice: "67,000",
  tick: 1000n,
  lot: 1000n,
  decimals: 6,
  ...over,
});

describe("seriesScore", () => {
  it("scores a Trading Window with a Line above everything else", () => {
    const good = seriesScore(win(), 1_000);
    expect(good).toBeGreaterThan(0);
    expect(seriesScore(win({ status: 2 }), 1_000)).toBe(-1);
    expect(seriesScore(win({ openingPrice: undefined }), 1_000)).toBe(-1);
  });

  it("refuses a Window inside lock headroom", () => {
    expect(seriesScore(win({ expiry: 1_050, intervalSec: 900 }), 1_000)).toBe(-1);
  });

  it("prefers the longest safe headroom", () => {
    const short = seriesScore(win({ expiry: 1_400 }), 1_000);
    const long = seriesScore(win({ marketId: "0xb", expiry: 3_000 }), 1_000);
    expect(long).toBeGreaterThan(short);
  });
});

describe("autoSeries", () => {
  it("returns null when nothing is tradable", () => {
    expect(autoSeries([], 1_000)).toBeNull();
    expect(autoSeries([win({ status: 4 })], 1_000)).toBeNull();
  });

  it("picks the best-scoring series across assets and cadences", () => {
    const btc = win({ asset: "BTC", intervalSec: 900, expiry: 1_400 });
    const eth = win({ asset: "ETH", intervalSec: 300, marketId: "0xe", expiry: 3_000 });
    expect(autoSeries([btc, eth], 1_000)).toEqual({ asset: "ETH", intervalSec: 300 });
  });

  it("sees through venue boundaries — opportunity beats the pin", () => {
    const otherVenue = win({ venueId: "0xother", asset: "ETH", intervalSec: 300, marketId: "0xe", expiry: 3_000 });
    expect(autoSeries([otherVenue], 1_000)).toEqual({ asset: "ETH", intervalSec: 300 });
  });
});

describe("hottestCadence", () => {
  it("returns the cadence with the highest live score for the asset", () => {
    const m15 = win({ intervalSec: 900, expiry: 1_400 });
    const h1 = win({ intervalSec: 3600, marketId: "0xh", expiry: 3_000 });
    expect(hottestCadence([m15, h1], "BTC", 1_000)).toBe(3600);
  });

  it("ignores other assets and uncallable Windows", () => {
    const eth = win({ asset: "ETH", intervalSec: 3600, marketId: "0xe", expiry: 3_000 });
    const locked = win({ intervalSec: 900, status: 2, marketId: "0xl" });
    expect(hottestCadence([eth, locked], "BTC", 1_000)).toBeNull();
  });

  it("breaks score ties to the shorter cadence", () => {
    const a = win({ intervalSec: 900, marketId: "0xa", expiry: 3_000 });
    const b = win({ intervalSec: 3600, marketId: "0xb", expiry: 3_000 });
    expect(hottestCadence([a, b], "BTC", 1_000)).toBe(900);
  });

  it("snaps indexer interval drift to the canonical cadence", () => {
    const drifted = win({ intervalSec: 3598, marketId: "0xd", expiry: 3_000 });
    expect(hottestCadence([drifted], "BTC", 1_000)).toBe(3600);
  });
});
