import { describe, expect, it } from "vitest";
import { boardNotice } from "./board-notice";

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
