import { describe, expect, it } from "vitest";
import { settlePreview, settlePreviewCopy, parseSettlementFeeBps } from "./settle-preview";

describe("settlePreview", () => {
  it("is empty when the wallet holds no contracts", () => {
    const preview = settlePreview({ up: 0n, down: 0n });
    expect(preview.empty).toBe(true);
    expect(settlePreviewCopy(preview, 6)).toBe("");
  });

  it("pays the winning side 1:1 and both sides half on a Void", () => {
    const preview = settlePreview({ up: 10_000_000n, down: 4_000_000n });
    expect(preview).toMatchObject({ ifUp: 10_000_000n, ifDown: 4_000_000n, ifVoid: 7_000_000n, empty: false });
    expect(settlePreviewCopy(preview, 6)).toBe("If Up wins 10 · If Down wins 4 · If Void 7 tUSDC");
  });

  it("skims a settlement fee from the winner only", () => {
    const preview = settlePreview({ up: 10_000_000n, down: 0n, feeBps: 100n });
    expect(preview.ifUp).toBe(9_900_000n);
    expect(preview.ifDown).toBe(0n);
    expect(preview.ifVoid).toBe(5_000_000n);
    expect(settlePreviewCopy(preview, 6, 100n)).toBe(
      "If Up wins 9.9 · If Down wins 0 · If Void 5 tUSDC · venue fee 1% on wins",
    );
  });

  it("stays silent about the fee when it is zero", () => {
    const preview = settlePreview({ up: 10_000_000n, down: 0n });
    expect(settlePreviewCopy(preview, 6, 0n)).not.toContain("fee");
  });
});

describe("parseSettlementFeeBps", () => {
  it("treats a missing indexer fee as zero", () => {
    expect(parseSettlementFeeBps(null)).toBe(0n);
    expect(parseSettlementFeeBps(undefined)).toBe(0n);
    expect(parseSettlementFeeBps("")).toBe(0n);
  });

  it("reads standard bps from the indexer decimal string", () => {
    expect(parseSettlementFeeBps("100")).toBe(100n);
    expect(parseSettlementFeeBps("not-a-fee")).toBe(0n);
  });
});
