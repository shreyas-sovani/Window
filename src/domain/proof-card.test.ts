import { describe, expect, it } from "vitest";
import { proofCard, settledProofCard } from "./proof-card";

const receipt = {
  asset: "BTC",
  intervalSec: 900,
  side: "up" as const,
  line: "67214.50",
  expiry: 1_700_000_000,
  stake: 10,
  contracts: 15.2,
  avgOdds: 0.61,
  payoutIfWin: 15.2,
  maxLoss: 9.2,
  txHash: "0xabc123",
  marketId: "0x" + "aa".repeat(32) as `0x${string}`,
  ts: 1_699_999_000,
};

describe("proofCard", () => {
  it("carries the decision, the math, and the explorer proof", () => {
    const text = proofCard(receipt);
    expect(text).toContain("BTC 15m");
    expect(text).toContain("UP");
    expect(text).toContain("67214.50");
    expect(text).toContain("10");
    expect(text).toContain("15.2");
    expect(text).toContain("61");
    expect(text).toContain("shannon-explorer.somnia.network/tx/0xabc123");
  });

  it("states the risk and payout scenario in plain language", () => {
    const text = proofCard(receipt);
    expect(text).toMatch(/if right/i);
    expect(text).toMatch(/at risk/i);
  });

  it("omits a missing Line rather than inventing one", () => {
    const text = proofCard({ ...receipt, line: undefined });
    expect(text).not.toContain("NaN");
    expect(text).toContain("Line —");
  });
});

describe("settledProofCard", () => {
  it("appends the result and the oracle receipt when known", () => {
    const text = settledProofCard(receipt, "up", "https://oracle.example/q/1?view=graph");
    expect(text).toContain("Result: UP");
    expect(text).toContain("oracle.example");
  });

  it("names a void honestly", () => {
    const text = settledProofCard(receipt, "void");
    expect(text).toContain("VOID");
    expect(text).toContain("half");
  });

  it("still works while the result is unknown", () => {
    const text = settledProofCard(receipt, "unknown");
    expect(text).toContain("settling");
  });
});
