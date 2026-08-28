import { describe, expect, it } from "vitest";
import { outcomeBars, pulseReady, pushSample, sparkPath, tapeRows } from "./chart";
import type { MarketFill, Sample } from "../exchange/port";
import type { PastWindow } from "../exchange/port";

const M = "0x" + "ab".repeat(32);

describe("pushSample", () => {
  it("appends newest-last and caps the window", () => {
    let s: Sample[] = [];
    for (let i = 0; i < 130; i++) s = pushSample(s, { t: i, v: i }, 120);
    expect(s).toHaveLength(120);
    expect(s[0].t).toBe(10);
    expect(s[119].t).toBe(129);
  });

  it("drops a duplicate timestamp", () => {
    const s = pushSample(pushSample([], { t: 1, v: 1 }), { t: 1, v: 2 });
    expect(s).toEqual([{ t: 1, v: 2 }]);
  });
});

describe("sparkPath", () => {
  it("draws a normalized polyline inside the box", () => {
    const path = sparkPath(
      [
        { t: 0, v: 0 },
        { t: 1, v: 5 },
        { t: 2, v: 10 },
      ],
      100,
      50,
    );
    const xs = path.match(/L?([\d.]+)[ ,]([\d.]+)/g) ?? [];
    expect(path.startsWith("M")).toBe(true);
    expect(xs).toHaveLength(3);
  });

  it("flattens when the series is constant", () => {
    const path = sparkPath(
      [
        { t: 0, v: 7 },
        { t: 1, v: 7 },
      ],
      100,
      50,
    );
    expect(path).not.toContain("NaN");
  });

  it("returns empty for fewer than two points", () => {
    expect(sparkPath([{ t: 0, v: 1 }], 100, 50)).toBe("");
    expect(sparkPath([], 100, 50)).toBe("");
  });
});

describe("outcomeBars", () => {
  it("maps history newest-first into capped bars", () => {
    const history: PastWindow[] = Array.from({ length: 15 }, (_, i) => ({
      marketId: M as `0x${string}`,
      expiry: i,
      result: i % 2 === 0 ? "up" : "down",
      volumeQuote: i,
    }));
    const bars = outcomeBars(history, 12);
    expect(bars).toHaveLength(12);
    expect(bars[0].expiry).toBe(14);
  });
});

describe("tapeRows", () => {
  it("sorts newest first, colors by aggressor, caps length", () => {
    const fills: MarketFill[] = Array.from({ length: 10 }, (_, i) => ({
      id: `f${i}`,
      price: 0.5,
      quantity: 1,
      quote: 0.5,
      aggressor: i % 2 === 0 ? "up" : "down",
      ts: i,
      txHash: "0x1",
    }));
    const rows = tapeRows(fills, 6);
    expect(rows).toHaveLength(6);
    expect(rows[0].id).toBe("f9");
    expect(rows[0].aggressor).toBe("down");
  });

  it("keeps unknown aggressor rows neutral", () => {
    const rows = tapeRows([{ id: "a", price: 0.4, quantity: 2, quote: 0.8, aggressor: null, ts: 1, txHash: "0x1" }]);
    expect(rows[0].aggressor).toBeNull();
  });
});

describe("pulseReady", () => {
  it("is ready when series history has bars even with no ticks yet", () => {
    expect(
      pulseReady({
        priceSamples: [],
        impliedSamples: [],
        fills: [],
        history: [{ marketId: M as `0x${string}`, expiry: 1, result: "up" }],
      }),
    ).toBe(true);
  });

  it("stays collecting with a single sample and empty history", () => {
    expect(
      pulseReady({
        priceSamples: [{ t: 1, v: 1 }],
        impliedSamples: [],
        fills: [],
      }),
    ).toBe(false);
  });
});
