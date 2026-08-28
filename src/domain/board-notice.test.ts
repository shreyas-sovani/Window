import { describe, expect, it } from "vitest";
import { boardNotice, crashNotice } from "./board-notice";

describe("boardNotice", () => {
  it("leads with a load error and a retry action", () => {
    expect(
      boardNotice({
        loadError: "Indexer timed out.",
        loading: true,
        live: false,
        thinBook: true,
        shortCollateral: true,
      }),
    ).toEqual({ kind: "err", text: "Indexer timed out.", action: "Retry" });
  });

  it("asks to switch series when nothing is live", () => {
    expect(
      boardNotice({
        loadError: null,
        loading: false,
        live: false,
        thinBook: false,
        shortCollateral: false,
      }),
    ).toEqual({
      kind: "info",
      text: "No Trading Window for this series right now. Try another cadence or wait for the roll.",
      action: "Switch series",
    });
  });

  it("points short collateral at Mint tUSDC before a thin-book note", () => {
    expect(
      boardNotice({
        loadError: null,
        loading: false,
        live: true,
        thinBook: true,
        shortCollateral: true,
      }),
    ).toEqual({
      kind: "info",
      text: "Not enough tUSDC in this wallet to cover this stake.",
      action: "Mint tUSDC",
    });
  });

  it("is silent when the board is healthy", () => {
    expect(
      boardNotice({
        loadError: null,
        loading: false,
        live: true,
        thinBook: false,
        shortCollateral: false,
      }),
    ).toBeNull();
  });
});

describe("crashNotice", () => {
  it("gives a render crash a Retry action without dumping a stack", () => {
    const n = crashNotice("Cannot read properties of undefined\n    at App (App.tsx:12)");
    expect(n.action).toBe("Retry");
    expect(n.kind).toBe("err");
    expect(n.text).toMatch(/positions are safe/i);
    expect(n.text).not.toMatch(/at App/);
  });
});
