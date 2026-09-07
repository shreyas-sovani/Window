import { describe, expect, it } from "vitest";
import { envUrl, explorerAddress, explorerTx, oracleReceipt } from "./shannon";

describe("envUrl", () => {
  it("falls back when the env var is absent", () => {
    expect(envUrl(undefined, "https://default.test")).toBe("https://default.test");
  });

  it("falls back when the env var is set but blank — the Vercel empty-string trap", () => {
    expect(envUrl("", "https://default.test")).toBe("https://default.test");
    expect(envUrl("   ", "https://default.test")).toBe("https://default.test");
  });

  it("uses a real override as-is (trimmed)", () => {
    expect(envUrl(" https://override.test ", "https://default.test")).toBe("https://override.test");
  });
});

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
