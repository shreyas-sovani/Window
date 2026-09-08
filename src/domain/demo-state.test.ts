import { describe, expect, it } from "vitest";
import { decodeDemoFills, encodeDemoFills } from "./demo-state";

const row = {
  id: "mk_1",
  price: 0.52,
  quantity: 19,
  quote: 9.88,
  aggressor: "up" as const,
  ts: 1_788_100_000,
  txHash: "0xfake1",
  marketId: "0x" + "ab".repeat(32),
  taker: "0x00000000000000000000000000000000000000aa",
};

describe("demo fills blob", () => {
  it("round-trips fill rows without loss", () => {
    const blob = encodeDemoFills([row, { ...row, id: "mk_2", aggressor: "down", taker: "0x00000000000000000000000000000000000000bb" }]);
    const back = decodeDemoFills(blob);
    expect(back).not.toBeNull();
    expect(back).toHaveLength(2);
    expect(back![0]).toEqual(row);
  });

  it("fails closed on garbage, truncation, or non-base64url characters", () => {
    expect(decodeDemoFills("")).toBeNull();
    expect(decodeDemoFills("!!!")).toBeNull();
    expect(decodeDemoFills(encodeDemoFills([row]).slice(0, 8))).toBeNull();
  });

  it("fails closed on a row with a bad shape — no half-trusted fill enters the tape", () => {
    const good = encodeDemoFills([row]);
    expect(decodeDemoFills(good)).not.toBeNull();
    // Hand-mangle: negative quantity smuggled into the payload.
    const bad = encodeDemoFills([{ ...row, quantity: -5 }]);
    expect(decodeDemoFills(bad)).toBeNull();
  });

  it("rejects absurd payloads — a link is not a database", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ ...row, id: `mk_${i}` }));
    expect(() => encodeDemoFills(many)).toThrow(/at most/);
    const forged = "1." + btoa(JSON.stringify({ v: 1, fills: many })).replace(/=+$/, "");
    expect(decodeDemoFills(forged)).toBeNull();
  });
});
