import { describe, expect, it } from "vitest";
import { explorerAddress, explorerTx } from "./shannon";

describe("explorer proof", () => {
  it("points a Call tx at Shannon explorer", () => {
    expect(explorerTx("0xabc")).toBe("https://shannon-explorer.somnia.network/tx/0xabc");
  });

  it("points a wallet at Shannon explorer", () => {
    expect(explorerAddress("0x123")).toBe("https://shannon-explorer.somnia.network/address/0x123");
  });
});
