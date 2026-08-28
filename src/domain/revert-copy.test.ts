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

  it("maps Call-path adapter errors to a sentence", () => {
    expect(revertCopy(new Error("below-lot"))).toBe("Stake is below one lot. Increase the amount.");
    expect(revertCopy(new Error("Window is not Trading"))).toBe("Window is not Trading.");
    expect(revertCopy(new Error("SignerRequiredError"))).toMatch(/wallet/i);
    expect(revertCopy(new Error("Call reverted on-chain"))).toMatch(/reverted/i);
  });
});
