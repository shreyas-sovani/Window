import { describe, expect, it } from "vitest";
import { approveAmount, gateLabel, nextGate } from "./wallet-gate";

describe("WalletGate", () => {
  const base = {
    connected: true,
    chainId: 50312,
    expectedChainId: 50312,
    allowance: 0n,
    stakeRaw: 1_000_000n,
    callable: true,
  };

  it("asks to connect first", () => {
    expect(nextGate({ ...base, connected: false, chainId: undefined }).action).toBe("connect");
  });

  it("asks to switch before approve", () => {
    expect(nextGate({ ...base, chainId: 1 }).action).toBe("switch");
  });

  it("asks to approve before Call", () => {
    expect(nextGate(base).action).toBe("approve");
  });

  it("is ready to Call when allowance covers the stake", () => {
    expect(nextGate({ ...base, allowance: 1_000_000n }).action).toBe("call");
  });

  it("blocks Call when the Window is not callable even if the wallet is ready", () => {
    const g = nextGate({ ...base, allowance: 1_000_000n, callable: false });
    expect(g.action).toBe("wait");
    expect(g.canCall).toBe(false);
  });
});

describe("approveAmount", () => {
  it("approves exactly the stake and refuses a zero or infinite fallback", () => {
    expect(approveAmount(10_000_000n)).toBe(10_000_000n);
    expect(approveAmount(0n)).toBe(0n);
    expect(approveAmount(-1n)).toBe(0n);
  });
});

describe("gateLabel", () => {
  it("names the Shannon switch while the wallet is switching", () => {
    expect(gateLabel("switch", { switching: true })).toBe("Switching…");
  });

  it("uses Window phase copy while waiting so the primary is not a dead Call", () => {
    expect(gateLabel("wait", {}, { kind: "too-close" })).toBe("Locking — new Calls closed");
    expect(gateLabel("wait", {}, { kind: "locked" })).toBe("Locked — waiting on the close");
    expect(gateLabel("wait")).toBe("Window not callable");
  });
});
