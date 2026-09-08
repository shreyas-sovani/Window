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

  it("names the fill-or-kill refusal an accept actually hits", () => {
    // The shape the SDK throws: ContractRevertError, message from revertMessage().
    const err = new Error("placeBinaryOrder reverted: FillOrKillNotFillable()");
    err.name = "ContractRevertError";
    const copy = revertCopy(err);
    expect(copy).toMatch(/whole stake/i);
    expect(copy).toMatch(/smaller stake|depth/i);
    // The old copy sent people to check gas and the Window, which were both fine.
    expect(copy).not.toMatch(/STT/);
  });

  it("distinguishes a short allowance from a short balance", () => {
    expect(revertCopy(new Error("transferFrom reverted: ERC20InsufficientAllowance(0x…, 0, 12000000)"))).toMatch(
      /approve/i,
    );
    expect(revertCopy(new Error("ERC20InsufficientBalance"))).toMatch(/collateral/i);
  });

  it("names an unmapped pool error instead of blaming gas", () => {
    const err = new Error("placeBinaryOrder reverted: OrderExpiryBeyondMarket(1788000000)");
    err.name = "ContractRevertError";
    expect(revertCopy(err)).toContain("OrderExpiryBeyondMarket");
    // Still no internals: the args and the address do not reach the banner.
    expect(revertCopy(err)).not.toContain("1788000000");
  });

  it("maps Call-path adapter errors to a sentence", () => {
    expect(revertCopy(new Error("below-lot"))).toBe("Stake is below one lot. Increase the amount.");
    expect(revertCopy(new Error("Window is not Trading"))).toBe("Window is not Trading.");
    expect(revertCopy(new Error("SignerRequiredError"))).toMatch(/wallet/i);
    expect(revertCopy(new Error("Call reverted on-chain"))).toMatch(/reverted/i);
  });
});
