import { describe, expect, it } from "vitest";
import { quantizePrice, quantizeSize } from "./grid";

describe("Grid", () => {
  it("snaps a probability onto the tick grid by rounding", () => {
    const tick = 1000n; // 0.001 on 6 decimals
    expect(quantizePrice(51_200n, tick)).toBe(51_000n);
    expect(quantizePrice(51_600n, tick)).toBe(52_000n);
  });

  it("floors size to the lot grid", () => {
    const lot = 1000n;
    expect(quantizeSize(137_400n, lot)).toBe(137_000n);
  });

  it("returns zero size when the request is below one lot", () => {
    expect(quantizeSize(400n, 1000n)).toBe(0n);
  });
});
