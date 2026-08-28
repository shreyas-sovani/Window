import { describe, expect, it } from "vitest";
import { historyLine, readSeriesRecord, seriesRecordCopy } from "./series-record";
import type { PastWindow } from "../exchange/port";

const past = (over: Partial<PastWindow>): PastWindow => ({
  marketId: "0x1",
  expiry: 1_000,
  result: "up",
  ...over,
});

describe("readSeriesRecord", () => {
  it("is empty when nothing has settled", () => {
    const record = readSeriesRecord([]);
    expect(record.total).toBe(0);
    expect(seriesRecordCopy(record)).toBe("No settled Windows yet.");
  });

  it("counts Up Down and Void and names the newest expiry as last", () => {
    const record = readSeriesRecord([
      past({ marketId: "0xold", expiry: 100, result: "down" }),
      past({ marketId: "0xnew", expiry: 300, result: "up" }),
      past({ marketId: "0xmid", expiry: 200, result: "void" }),
    ]);
    expect(record).toMatchObject({ up: 1, down: 1, voided: 1, total: 3, last: "up" });
    expect(seriesRecordCopy(record)).toBe("1 Up · 1 Down · 1 Void · last Up");
  });
});

describe("historyLine", () => {
  it("returns the Line when opening price is a positive number", () => {
    expect(historyLine("67432.51")).toBe(67432.51);
  });

  it("skips missing or zero so a chip does not invent a Line", () => {
    expect(historyLine(undefined)).toBeUndefined();
    expect(historyLine("")).toBeUndefined();
    expect(historyLine("0")).toBeUndefined();
    expect(historyLine("nope")).toBeUndefined();
  });
});
