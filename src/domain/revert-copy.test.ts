import { describe, expect, it } from "vitest";
import { revertCopy } from "./revert-copy";

describe("RevertCopy", () => {
  it("maps known pool errors to a sentence", () => {
    expect(revertCopy(new Error("InvalidPrice"))).toMatch(/tick/i);
    expect(revertCopy(new Error("ERC20InsufficientBalance"))).toMatch(/collateral/i);
    expect(revertCopy(new Error("InsufficientBalance()"))).toMatch(/outcome/i);
    expect(revertCopy(new Error("FaucetCapExceeded"))).toMatch(/10,000/i);
  });

  it("maps a wallet rejection", () => {
    expect(revertCopy({ shortMessage: "User rejected the request." })).toMatch(/rejected/i);
  });

  it("falls back without dumping a selector", () => {
    expect(revertCopy("0x1234abcd")).not.toMatch(/^0x/);
  });
});
