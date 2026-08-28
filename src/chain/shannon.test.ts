import { describe, expect, it } from "vitest";
import { explorerAddress, explorerTx, oracleReceipt } from "./shannon";

describe("explorer proof", () => {
  it("points a Call tx at Shannon explorer", () => {
    expect(explorerTx("0xabc")).toBe("https://shannon-explorer.somnia.network/tx/0xabc");
  });

  it("points a wallet at Shannon explorer", () => {
    expect(explorerAddress("0x123")).toBe("https://shannon-explorer.somnia.network/address/0x123");
  });

  it("points a settled Window at the public oracle graph", () => {
    expect(oracleReceipt("42")).toBe("https://prd.oracle.somnia.host/questions/42?view=graph");
  });
});
