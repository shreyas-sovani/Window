import { describe, expect, it } from "vitest";
import { bookTopFromRaw, impliedUp } from "./implied";

describe("impliedUp", () => {
  it("prefers the ask as the market's live Up chance", () => {
    expect(impliedUp({ bid: 0.4, ask: 0.62 })).toBe(0.62);
  });

  it("falls back to the bid when there is no ask", () => {
    expect(impliedUp({ bid: 0.55 })).toBe(0.55);
  });

  it("is undefined on an empty book", () => {
    expect(impliedUp({})).toBeUndefined();
  });
});

describe("bookTopFromRaw", () => {
  it("scales 6-decimal collateral into an Up probability", () => {
    expect(bookTopFromRaw({ bidRaw: 400_000n, askRaw: 620_000n, decimals: 6 })).toEqual({
      bid: 0.4,
      ask: 0.62,
    });
  });
});
